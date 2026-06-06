import { Astal, Gtk } from "ags/gtk4";

import { Apps } from "~/window/bar/widgets/Apps";
import { Clock } from "~/window/bar/widgets/Clock";
import { Cpu } from "~/window/bar/widgets/Cpu";
import { FocusedClient } from "~/window/bar/widgets/FocusedClient";
import { Media } from "~/window/bar/widgets/Media";
import { Memory } from "~/window/bar/widgets/Memory";
import { Status } from "~/window/bar/widgets/Status";
import { Tray } from "~/window/bar/widgets/Tray";
import { Workspaces } from "~/window/bar/widgets/Workspaces";

export const Bar = (mon: number) => {
	const widgetSpacing = 0;
	return (
		<Astal.Window
			namespace={"top-bar"}
			layer={Astal.Layer.TOP}
			anchor={
				Astal.WindowAnchor.TOP |
				Astal.WindowAnchor.LEFT |
				Astal.WindowAnchor.RIGHT
			}
			exclusivity={Astal.Exclusivity.EXCLUSIVE}
			heightRequest={46}
			monitor={mon}
			canFocus={false}
		>
			<Gtk.Box class={"bar-container"}>
				<Gtk.CenterBox class={"bar-centerbox"} hexpand>
					<Gtk.Box
						class={"widgets-left"}
						homogeneous={false}
						halign={Gtk.Align.START}
						spacing={widgetSpacing}
						$type="start"
					>
						<Apps />
						<Workspaces />
						<FocusedClient />
					</Gtk.Box>
					<Gtk.Box
						class={"widgets-center"}
						homogeneous={false}
						spacing={widgetSpacing}
						halign={Gtk.Align.CENTER}
						$type="center"
					>
						<Clock />
						<Media />
					</Gtk.Box>
					<Gtk.Box
						class={"widgets-right"}
						homogeneous={false}
						spacing={widgetSpacing}
						halign={Gtk.Align.END}
						$type="end"
					>
						<Cpu />
						<Memory />
						<Tray />
						<Status />
					</Gtk.Box>
				</Gtk.CenterBox>
			</Gtk.Box>
		</Astal.Window>
	);
};
