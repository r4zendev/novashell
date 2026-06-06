import Gio from "gi://Gio?version=2.0";

import { createBinding } from "ags";
import { Gdk, Gtk } from "ags/gtk4";

import { generalConfig } from "~/config";
import { time } from "~/modules/utils";
import { Windows } from "~/windows";

export const Clock = () => (
	<Gtk.Button
		class={createBinding(Windows.getDefault(), "openWindows").as(
			(wins) => `clock ${wins.includes("center-window") ? "open" : ""}`,
		)}
		onClicked={() => Windows.getDefault().toggle("center-window")}
		label={time(
			(dt) =>
				dt.format(generalConfig.getProperty("clock.date_format", "string")) ??
				"An error occurred",
		)}
		$={(self) => {
			const gesture = Gtk.GestureClick.new();
			gesture.set_button(Gdk.BUTTON_SECONDARY);

			gesture.connect("released", () => {
				const calendarUrl = generalConfig.getProperty(
					"clock.calendar_url",
					"string",
				);
				if (calendarUrl) {
					Gio.AppInfo.launch_default_for_uri_async(
						calendarUrl,
						null,
						null,
						null,
					);
				}
			});

			self.add_controller(gesture);
		}}
	/>
);
