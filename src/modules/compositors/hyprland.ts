import AstalHyprland from "gi://AstalHyprland";
import Gio from "gi://Gio?version=2.0";
import GLib from "gi://GLib?version=2.0";

import { register } from "ags/gobject";

import { Socket } from "~/modules/socket";
import { Compositor } from "./base";

@register({ GTypeName: "ClshCompositorHyprland" })
export class CompositorHyprland extends Compositor {
	#eventSock: Socket;
	hyprland: AstalHyprland.Hyprland = AstalHyprland.get_default();

	constructor() {
		super();

		const instSignature = GLib.getenv("HYPRLAND_INSTANCE_SIGNATURE");
		if (instSignature === null || instSignature.trim() === "")
			throw new Error("Compositor: Hyprland: Couldn't get instance signature");

		this.#eventSock = new Socket(
			Socket.Type.CLIENT,
			`${GLib.get_user_runtime_dir()}/hypr/${instSignature}/.socket2.sock`,
			true,
		);

		const clients = this.getClients();
		if (clients && clients.length > 0) {
			this._clients = clients.map(
				(c) =>
					new Compositor.Client({
						title: c.title,
						position: c.at,
						mapped: c.mapped,
						address: c.address,
						initialClass: c.initialClass,
						class: c.class,
					}),
			);
			this.notify("clients");
		}

		const focusedClientAddress = this.getActiveClient()?.address;
		if (focusedClientAddress) {
			this._focusedClient = this.clients.find(
				(client) => client.address === focusedClientAddress,
			)!;
			this.notify("focused-client");
		}

		this.#eventSock.scopeConnect("received", (data: string) => {
			let [event] = data.split(">>") as [CompositorHyprland.Event];

			if (/^.*>>$/.test(event))
				event = event.replace(/^(.*)>>$/, "$1") as CompositorHyprland.Event;

			this.handleEvents(event, data);
		});
	}

	private handleEvents(event: CompositorHyprland.Event, data: string): void {
		switch (event as CompositorHyprland.Event) {
			case "activewindowv2": {
				const address = data;
				const focusedClient = this.getActiveClient();

				if (focusedClient) {
					this._focusedClient = new Compositor.Client({
						address: address,
						class: focusedClient.class ?? "",
						initialClass: focusedClient.initialClass ?? "",
						mapped: focusedClient.mapped,
						position: [focusedClient.at[0], focusedClient.at[1]],
						title: focusedClient.title ?? "",
					});

					this.notify("focused-client");
					return;
				}

				this._focusedClient = null;
				this.notify("focused-client");
				break;
			}
		}
	}

	// hyprctl passes through raw window titles, which for XWayland apps can be
	// non-UTF-8 (e.g. Latin-1). `exec`/communicate_utf8 hard-fails on the first
	// invalid byte, so read raw bytes and decode lossily instead.
	private hyprctl(...args: Array<string>): string {
		const proc = Gio.Subprocess.new(
			["hyprctl", ...args],
			Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE,
		);
		const [, stdout, stderr] = proc.communicate(null, null);
		if (!proc.get_successful())
			throw new Error(new TextDecoder().decode(stderr.get_data() ?? undefined));
		return new TextDecoder().decode(stdout.get_data() ?? undefined);
	}

	private getClients(): Array<CompositorHyprland.Client> {
		return JSON.parse(
			this.hyprctl("clients", "-j"),
		) as Array<CompositorHyprland.Client>;
	}

	private getActiveClient(): CompositorHyprland.Client | null {
		const client = JSON.parse(this.hyprctl("-j", "activewindow")) as
			| CompositorHyprland.Client
			| {};

		if (Object.keys(client).length === 0) return null;

		return client as CompositorHyprland.Client;
	}
}

export namespace CompositorHyprland {
	export type Event =
		| "activewindow"
		| "activewindowv2"
		| "workspace"
		| "windowtitle"
		| "windowtitlev2"
		| "workspacev2"
		| "focusedmon"
		| "focusedmonv2";

	export type Client = {
		address: string;
		mapped: boolean;
		hidden: boolean;
		at: [number, number];
		size: [number, number];
		workspace: {
			id: number;
			name: number;
		};
		floating: boolean;
		pseudo: boolean;
		monitor: number;
		class: string;
		title: string;
		initialClass: string;
		initialTitle: string;
		pid: number;
		xwayland: boolean;
		pinned: boolean;
		fullscreen: number;
		fullscreenClient: number;
		grouped: Array<Client>;
		tags: Array<string>;
		swallowing: string;
		focusHistoryID: number;
		inhibitingIdle: boolean;
		xdgTag: string;
		xdgDescription: string;
		contentType: string;
	};
}
