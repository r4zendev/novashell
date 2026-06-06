import { createBinding } from "ags";
import { Gtk } from "ags/gtk4";

import { Windows } from "~/windows";

export const Apps = () => (
	<Gtk.Button
		class={createBinding(Windows.getDefault(), "openWindows").as(
			(openWindows) =>
				`apps ${Object.hasOwn(openWindows, "apps-window") ? "open" : ""}`,
		)}
		iconName={"view-app-grid-symbolic"}
		halign={Gtk.Align.CENTER}
		hexpand
		tooltipText={"Applications"}
		onClicked={() => Windows.getDefault().open("apps-window")}
	/>
);
