import AstalNotifd from "gi://AstalNotifd";
import GLib from "gi://GLib?version=2.0";

import { onCleanup } from "ags";
import GObject, {
	getter,
	type ParamSpec,
	property,
	register,
	signal,
} from "ags/gobject";
import { execAsync } from "ags/process";

import { generalConfig } from "~/config";
import { pathToURI } from "~/modules/utils";

export type HistoryNotification = {
	id: number;
	appName: string;
	body: string;
	summary: string;
	urgency: AstalNotifd.Urgency;
	appIcon?: string;
	time: number;
	image?: string;
};

export class NotificationTimeout {
	#source?: GLib.Source;
	#args?: Array<any>;
	#millis: number;
	#lastRemained: number = 0;

	readonly callback: () => void;
	get millis(): number {
		return this.#millis;
	}
	get remaining(): number {
		return this.source ? this.source.get_time() : 0;
	}
	get lastRemained(): number {
		return this.#lastRemained;
	}
	get running(): boolean {
		return Boolean(this.source && !this.source.is_destroyed());
	}
	get source(): GLib.Source | undefined {
		return this.#source;
	}

	constructor(
		millis: number,
		callback: () => void,
		start: boolean = true,
		...args: Array<any>
	) {
		this.#millis = millis;
		this.callback = callback;
		this.#args = args;

		if (!start) return;
		this.start();
	}

	cancel(): void {
		// use lastRemained to calculate on what time the user hold the notification, so it
		// can be released by the remaining time (works like a timeout "pause")
		if (!this.#source) return;

		this.#lastRemained = Math.floor(
			Math.max(this.#source.get_ready_time() - GLib.get_monotonic_time()) /
				1000,
		);
		this.#source.destroy();
		this.#source = undefined;
	}

	start(newMillis?: number): GLib.Source {
		if (this.running || this.#source)
			throw new Error(
				"Notifications: Can't start a new counter if it's already running!",
			);

		if (newMillis !== undefined) this.#millis = newMillis;

		this.#source = setTimeout(this.callback, this.#millis, this.#args);

		this.#lastRemained = Math.floor(
			Math.max(this.#source.get_ready_time() - GLib.get_monotonic_time()) /
				1000,
		);

		return this.#source;
	}
}

@register({ GTypeName: "Notifications" })
export class Notifications extends GObject.Object {
	private static instance: Notifications | null = null;

	declare $signals: GObject.Object.SignalSignatures & {
		"history-added": (notification: HistoryNotification) => void;
		"history-removed": (notificationId: number) => void;
		"history-cleared": () => void;
		"notification-added": (notification: AstalNotifd.Notification) => void;
		"notification-removed": (notificationId: number) => void;
		"notification-replaced": (notificationId: number) => void;
	};

	#notifications = new Map<
		number,
		[AstalNotifd.Notification, NotificationTimeout]
	>();
	#history: Array<HistoryNotification> = [];
	#connections: Array<number> = [];
	#selfDismissed = new Set<number>();

	@getter(Array<AstalNotifd.Notification>)
	public get notifications() {
		return [...this.#notifications.values()].map(([n]) => n);
	}

	@getter(Array<HistoryNotification>)
	public get history() {
		return this.#history;
	}

	@getter(Array<AstalNotifd.Notification>)
	public get notificationsOnHold() {
		return [...this.#notifications.values()]
			.filter(([_, timeout]) => !timeout?.running)
			.map(([n]) => n);
	}

	@property(Number)
	public historyLimit: number = 10;

	/** skip notifications directly to notification history */
	@property(Boolean)
	public ignoreNotifications: boolean = false;

	@signal(AstalNotifd.Notification) notificationAdded(
		_notification: AstalNotifd.Notification,
	) {}
	@signal(Number) notificationRemoved(_id: number) {}
	@signal(Object as unknown as ParamSpec<HistoryNotification>) historyAdded(
		_notification: Object,
	) {}
	@signal() historyCleared() {}
	@signal(Number) historyRemoved(_id: number) {}
	@signal(Number) notificationReplaced(_id: number) {}

	private dismissDaemonNotification(notifId: number): void {
		try {
			const liveNotif = this.getNotifd().get_notification(notifId);
			if (!liveNotif) return;

			this.#selfDismissed.add(notifId);
			liveNotif.dismiss();
		} catch {
			/* notification may already be gone */
		}
	}

	private removeActiveNotificationById(id: number): void {
		const data = this.#notifications.get(id);
		if (!data) return;

		const [, timeout] = data;
		timeout?.running && timeout.cancel();
		this.#notifications.delete(id);
		this.notify("notifications");
		this.emit("notification-removed", id);
	}

	constructor() {
		super();
		const notifd = this.getNotifd();

		// Prevent daemon from expiring notifications on its own timeout.
		// We handle UI timeouts ourselves and need notifications to stay alive
		// in the daemon so history items can invoke their actions.
		notifd.ignoreTimeout = true;

		this.#connections.push(
			notifd.connect("notified", (_notifd, id) => {
				const notification = notifd.get_notification(id);
				if (!notification) return;

				if (notifd.dontDisturb || this.ignoreNotifications) {
					if (!notification.transient) {
						this.addHistory(notification, () => notification.dismiss());
					} else {
						this.#selfDismissed.add(notification.id);
						notification.dismiss();
					}
					return;
				}

				this.addNotification(
					notification,
					this.getNotificationTimeout(notification) > 0,
				);
			}),

			notifd.connect("resolved", (_notifd, id, reason) => {
				this.removeActiveNotificationById(id);

				if (this.#selfDismissed.has(id)) {
					this.#selfDismissed.delete(id);
					return;
				}

				// Remove from history when the notification is closed externally
				// (e.g., user read the Telegram message, or app calls CloseNotification).
				// Our own dismiss() calls are filtered by #selfDismissed above.
				if (
					reason === AstalNotifd.ClosedReason.CLOSED ||
					reason === AstalNotifd.ClosedReason.DISMISSED_BY_USER
				) {
					this.removeHistory(id);
				}
			}),
		);

		onCleanup(() => {
			this.#connections.forEach((id) => {
				notifd.disconnect(id);
			});
		});
	}

	public static getDefault(): Notifications {
		if (!Notifications.instance) Notifications.instance = new Notifications();

		return Notifications.instance;
	}

	public async sendNotification(props: {
		urgency?: AstalNotifd.Urgency;
		appName?: string;
		image?: string;
		summary: string;
		body?: string;
		replaceId?: number;
		transient?: boolean;
		actions?: Array<{
			id?: string | number;
			text: string;
			onAction?: () => void;
		}>;
	}): Promise<{
		id?: string | number;
		text: string;
		onAction?: () => void;
	} | null | void> {
		return await execAsync([
			"notify-send",
			...(props.urgency ? ["-u", this.getUrgencyString(props.urgency)] : []),
			...(props.appName ? ["-a", props.appName] : []),
			...(props.image ? ["-i", props.image] : []),
			...(props.transient ? ["-e"] : []),
			...(props.actions
				? props.actions.map((action) => ["-A", action.text]).flat(2)
				: []),
			...(props.replaceId ? ["-r", props.replaceId.toString()] : []),
			props.summary,
			props.body ? props.body : "",
		])
			.then((stdout) => {
				stdout = stdout.trim();
				if (!stdout) {
					if (props.actions && props.actions.length > 0) return null;

					return;
				}

				if (props.actions && props.actions.length > 0) {
					const action = props.actions[Number.parseInt(stdout)];
					action?.onAction?.();

					return action ?? undefined;
				}
			})
			.catch((err: Error) => {
				console.error(
					`Notifications: Couldn't send notification! Is the daemon running? Stderr:\n${
						err.message ? `${err.message}\n` : ""
					}Stack: ${err.stack}`,
				);
			});
	}

	public getUrgencyString(
		urgency: AstalNotifd.Notification | AstalNotifd.Urgency,
	) {
		switch (
			urgency instanceof AstalNotifd.Notification ? urgency.urgency : urgency
		) {
			case AstalNotifd.Urgency.LOW:
				return "low";
			case AstalNotifd.Urgency.CRITICAL:
				return "critical";
		}

		return "normal";
	}

	private addHistory(
		notif: AstalNotifd.Notification,
		onAdded?: (notif: AstalNotifd.Notification) => void,
	): void {
		if (!notif || notif.transient) return;

		const oldestNotif = this.#history.at(-1);
		if (this.#history.length === this.historyLimit && oldestNotif) {
			this.removeHistory(oldestNotif, true);
		}

		this.#history.map(
			(notifb, i) => notifb.id === notif.id && this.#history.splice(i, 1),
		);

		this.#history.unshift({
			id: notif.id,
			appName: notif.app_name,
			body: notif.body,
			summary: notif.summary,
			urgency: notif.urgency,
			appIcon: notif.app_icon,
			time: notif.time,
			image: notif.image ? notif.image : undefined,
		} as HistoryNotification);

		this.notify("history");
		this.emit("history-added", this.#history[0]);
		onAdded?.(notif);
	}

	public async clearHistory(): Promise<void> {
		for (const notif of [...this.#history].reverse()) {
			this.dismissDaemonNotification(notif.id);
			this.#history = this.history.filter((n) => n.id !== notif.id);
			this.emit("history-removed", notif.id);
		}

		this.emit("history-cleared");
		this.notify("history");
	}

	public removeHistory(
		notif: HistoryNotification | number,
		dismissFromDaemon: boolean = false,
	): void {
		const notifId = typeof notif === "number" ? notif : notif.id;
		this.#history = this.#history.filter(
			(item: HistoryNotification) => item.id !== notifId,
		);

		if (dismissFromDaemon) {
			this.dismissDaemonNotification(notifId);
		}

		this.notify("history");
		this.emit("history-removed", notifId);
	}

	private addNotification(
		notif: AstalNotifd.Notification,
		removeOnTimeout: boolean = true,
		onTimeoutEnd?: () => void,
	): void {
		const replaced = this.#notifications.has(notif.id);
		const notifTimeout = this.getNotificationTimeout(notif);
		const onEnd = () => {
			// Don't dismiss from daemon on timeout — let the app resolve it later
			// (e.g., user reads message in Telegram → app closes notification → removed from history)
			removeOnTimeout && this.removeNotification(notif, true, false);
			onTimeoutEnd?.();
		};

		// destroy timer of replaced notification(if there's any)
		if (replaced) {
			const data = this.#notifications.get(notif.id)!;
			data?.[1] instanceof NotificationTimeout && data[1].cancel();
		}

		this.#notifications.set(notif.id, [
			notif,
			new NotificationTimeout(notifTimeout, onEnd, notifTimeout > 0),
		]);

		if (!replaced) this.playNotificationSound(notif);

		replaced && this.emit("notification-replaced", notif.id);

		this.notify("notifications");
		this.emit("notification-added", notif);

		if (notifTimeout <= 0) onEnd?.();
	}

	private playNotificationSound(notif: AstalNotifd.Notification): void {
		if (notif.suppressSound) return;
		if (!generalConfig.getProperty("notifications.sound_enabled", "boolean"))
			return;

		// Only play sounds the app explicitly provides via D-Bus hints
		if (notif.soundFile) {
			execAsync(["canberra-gtk-play", "-f", notif.soundFile]).catch(() => {});
		} else if (notif.soundName) {
			execAsync(["canberra-gtk-play", "-i", notif.soundName]).catch(() => {});
		}
	}

	public getNotificationTimeout(notif: AstalNotifd.Notification): number {
		return generalConfig.getProperty(
			`notifications.timeout_${this.getUrgencyString(notif.urgency)}`,
			"number",
		);
	}

	public removeNotification(
		notif: AstalNotifd.Notification | number,
		addToHistory: boolean = true,
		dismiss: boolean = true,
	): void {
		const notification =
			typeof notif === "number" ? this.#notifications.get(notif)?.[0] : notif;
		if (!notification) return;

		const timeout = this.#notifications.get(notification.id)?.[1];
		timeout?.running && timeout.cancel();

		const willEnterHistory = addToHistory && !notification.transient;
		this.#notifications.delete(notification.id);
		willEnterHistory && this.addHistory(notification);

		// Only dismiss from daemon if the notification won't live in history.
		// History items need the daemon reference alive for action invocation.
		if (dismiss && !willEnterHistory) {
			this.#selfDismissed.add(notification.id);
			notification.dismiss();
		}

		this.notify("notifications");
		this.emit("notification-removed", notification.id);
	}

	public holdNotification(notif: AstalNotifd.Notification | number): void {
		const id = typeof notif === "number" ? notif : notif.id;
		const data = this.#notifications.get(id);

		if (!data) return;

		data[1]?.cancel();
		this.notify("notifications-on-hold");
	}

	public releaseNotification(notif: AstalNotifd.Notification | number): void {
		const id = typeof notif === "number" ? notif : notif.id;
		const data = this.#notifications.get(id);

		if (!data) return;
		data[1]?.start(data[1].lastRemained);

		this.notify("notifications-on-hold");
	}

	public getNotificationImage(
		notif: AstalNotifd.Notification | HistoryNotification,
	): string | undefined {
		const img = notif.image || notif.appIcon;

		if (!img || !img.includes("/")) return undefined;

		return pathToURI(img).replace("file://", "");
	}

	public removeDuplicateActions(
		actions: Array<AstalNotifd.Action>,
	): Array<AstalNotifd.Action> {
		const seen = new Set<string>();
		const finalActions: Array<AstalNotifd.Action> = [];

		for (const action of actions) {
			if (seen.has(action.id)) continue;

			seen.add(action.id);
			finalActions.push(action);
		}

		return finalActions;
	}

	/** Try to invoke the default/view action of a history notification.
	 * Returns true if the notification was still alive in the daemon and an action was invoked. */
	public invokeHistoryAction(notif: HistoryNotification): boolean {
		try {
			const liveNotif = this.getNotifd().get_notification(notif.id);
			if (!liveNotif) return false;

			const actions = liveNotif.actions;

			// Priority: "default" > "view" > first available
			const action =
				actions.find((a: AstalNotifd.Action) => a.id === "default") ??
				actions.find(
					(a: AstalNotifd.Action) =>
						/^view$/i.test(a.id) || /^view$/i.test(a.label),
				) ??
				actions[0];

			if (action) {
				liveNotif.invoke(action.id);
				return true;
			}
		} catch (e: any) {
			console.error(`[history-click] error: ${e.message}`);
		}

		return false;
	}

	public toggleDoNotDisturb(value?: boolean): boolean {
		const notifd = this.getNotifd();
		value = value ?? !notifd.dontDisturb;
		notifd.dontDisturb = value;

		return value;
	}

	public getNotifd(): AstalNotifd.Notifd {
		return AstalNotifd.get_default();
	}

	public emit<Signal extends keyof typeof this.$signals>(
		signal: Signal,
		...args: Parameters<(typeof this.$signals)[Signal]>
	): void {
		super.emit(signal, ...args);
	}

	public connect<Signal extends keyof typeof this.$signals>(
		signal: Signal,
		callback: (
			self: typeof this,
			...params: Parameters<(typeof this.$signals)[Signal]>
		) => ReturnType<(typeof this.$signals)[Signal]>,
	): number {
		return super.connect(signal, callback);
	}
}
