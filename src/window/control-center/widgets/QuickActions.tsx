import Gio from "gi://Gio?version=2.0";
import GLib from "gi://GLib?version=2.0";

import type { Accessor } from "ags";
import { Gtk } from "ags/gtk4";
import { execAsync } from "ags/process";
import { createPoll } from "ags/time";

import { execApp } from "~/modules/apps";
import { Windows } from "~/windows";

const userFace: Gio.File = Gio.File.new_for_path(
	`${GLib.get_home_dir()}/.face`,
);
const uptime: Accessor<string> = createPoll(
	"Just turned on",
	1000,
	"uptime -p",
);

const quickActionButtons: Array<{ icon: string; action: () => void }> = [
	{ icon: "system-lock-screen-symbolic", action: () => execApp("hyprlock") },
	{
		icon: "color-select-symbolic",
		action: () => {
			execAsync(["bash", "-c", "~/.config/hypr/scripts/color-picker.sh"]).catch(
				() => {},
			);
		},
	},
	{
		icon: "applets-screenshooter-symbolic",
		action: () => {
			execAsync([
				"bash",
				"-c",
				'SELECTION=$(slurp) && grim -g "$SELECTION" - | wl-copy && notify-send -a "Screenshot" -e "Copied to clipboard"',
			]).catch(() => {});
		},
	},
	{
		icon: "system-shutdown-symbolic",
		action: () => Windows.getDefault().open("logout-menu"),
	},
];

export const QuickActions = () =>
	(
		<Gtk.Box class={"quickactions"}>
			<Gtk.Box halign={Gtk.Align.START} class={"left"} hexpand>
				{userFace.query_exists(null) && (
					<Gtk.Box
						class={"user-face"}
						css={`background-image: url("file://${userFace.get_path()!}");`}
					/>
				)}
				<Gtk.Box orientation={Gtk.Orientation.VERTICAL}>
					<Gtk.Box class={"user-host"}>
						<Gtk.Label class={"user"} xalign={0} label={GLib.get_user_name()} />
						<Gtk.Label
							class={"host"}
							xalign={0}
							yalign={0.8}
							label={`@${GLib.get_host_name()}`}
						/>
					</Gtk.Box>

					<Gtk.Box>
						<Gtk.Image iconName={"hourglass-symbolic"} />
						<Gtk.Label
							class={"uptime"}
							xalign={0}
							tooltipText={"Up time"}
							label={uptime.as((str) => str.replace(/^up /, ""))}
						/>
					</Gtk.Box>
				</Gtk.Box>
			</Gtk.Box>

			<Gtk.Box class={"right button-row"} halign={Gtk.Align.END} hexpand>
				{quickActionButtons.map(({ icon, action }) => (
					<Gtk.Button
						iconName={icon}
						onClicked={() => {
							Windows.getDefault().close("control-center");
							action();
						}}
					/>
				))}
			</Gtk.Box>
		</Gtk.Box>
	) as Gtk.Box;
