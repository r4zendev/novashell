import type AstalNotifd from "gi://AstalNotifd";

import { createBinding, For } from "ags";
import { Gdk, Gtk } from "ags/gtk4";

import {
	type HistoryNotification,
	Notifications,
} from "~/modules/notifications";
import { Notification } from "~/widget/Notification";
import { Windows } from "~/windows";

export const NotifHistory = () =>
	(
		<Gtk.Box
			orientation={Gtk.Orientation.VERTICAL}
			class={createBinding(Notifications.getDefault(), "history").as(
				(history) => `notif-history ${history.length < 1 ? "hide" : ""}`,
			)}
			vexpand={false}
		>
			<Gtk.ScrolledWindow
				class={"history-scrollable"}
				hscrollbarPolicy={Gtk.PolicyType.NEVER}
				vscrollbarPolicy={Gtk.PolicyType.AUTOMATIC}
				propagateNaturalHeight={true}
				onShow={(self) => {
					if (!(self.get_child()! as Gtk.Viewport).get_child()) return;

					self.minContentHeight =
						((self.get_child()! as Gtk.Viewport).get_child() as Gtk.Box)
							.get_first_child()!
							.get_allocation().height || 0;
				}}
			>
				<Gtk.Box
					class={"notifications"}
					hexpand={true}
					orientation={Gtk.Orientation.VERTICAL}
					spacing={4}
					valign={Gtk.Align.START}
				>
					<For each={createBinding(Notifications.getDefault(), "history")}>
						{(notif: AstalNotifd.Notification | HistoryNotification) => (
							<Notification
								summary={notif.summary}
								body={notif.body}
								time={notif.time}
								appName={notif.appName}
								appIcon={notif.appIcon}
								image={Notifications.getDefault().getNotificationImage(notif)}
								onDismissed={() =>
									Notifications.getDefault().removeHistory(notif, true)
								}
								id={notif.id}
							>
								<Gtk.GestureClick
									onReleased={(gesture) => {
										if (gesture.get_current_button() !== Gdk.BUTTON_PRIMARY)
											return;

										Windows.getDefault().close("control-center");
										const invoked =
											Notifications.getDefault().invokeHistoryAction(notif);
										Notifications.getDefault().removeHistory(notif, !invoked);
									}}
								/>
							</Notification>
						)}
					</For>
				</Gtk.Box>
			</Gtk.ScrolledWindow>

			<Gtk.Box class={"button-row"} hexpand>
				<Gtk.Button
					class={"clear-all"}
					halign={Gtk.Align.END}
					onClicked={() => Notifications.getDefault().clearHistory()}
				>
					<Gtk.Box hexpand>
						<Gtk.Image
							class={"icon"}
							iconName={"edit-clear-all-symbolic"}
							css={"margin-right: 6px;"}
						/>
						<Gtk.Label label={"Clear"} />
					</Gtk.Box>
				</Gtk.Button>
			</Gtk.Box>
		</Gtk.Box>
	) as Gtk.Box;
