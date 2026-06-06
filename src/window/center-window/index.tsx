import AstalMpris from "gi://AstalMpris";

import { createBinding } from "ags";
import { Gdk, Gtk } from "ags/gtk4";
import { execAsync } from "ags/process";

import { generalConfig } from "~/config";
import Media from "~/modules/media";
import { time, variableToBoolean } from "~/modules/utils";
import { PopupWindow } from "~/widget/PopupWindow";
import { Separator } from "~/widget/Separator";
import { BigMedia } from "~/window/center-window/widgets/BigMedia";
import { Windows } from "~/windows";

export const CenterWindow = (mon: number) => {
	const notifPopupHPos = generalConfig.getProperty(
		"notifications.position_h",
		"string",
	);

	return (
		<PopupWindow
			namespace={"center-window"}
			marginTop={10}
			monitor={mon}
			halign={Gtk.Align.CENTER}
			valign={Gtk.Align.START}
			actionKeyPressed={(_, keyval) => {
				if (keyval === Gdk.KEY_space) {
					Media.getDefault().player.available &&
						Media.getDefault().player.play_pause();
					return true;
				}
			}}
			$={() => {
				if (notifPopupHPos !== "center") return;

				generalConfig.setProperty("notifications.position_h", "left", false);
			}}
			actionClosed={() => {
				const currentNotifPopupHPos = generalConfig.getProperty(
					"notifications.position_h",
					"string",
				);
				if (currentNotifPopupHPos === notifPopupHPos) return;

				generalConfig.setProperty(
					"notifications.position_h",
					notifPopupHPos,
					false,
				);
			}}
		>
			<Gtk.Box class={"center-window-container"} spacing={6}>
				<Gtk.Box class={"left"} orientation={Gtk.Orientation.VERTICAL}>
					<Gtk.Box
						class={"datetime"}
						orientation={Gtk.Orientation.VERTICAL}
						halign={Gtk.Align.CENTER}
						valign={Gtk.Align.CENTER}
						vexpand
					>
						<Gtk.Label class={"time"} label={time((t) => t.format("%H:%M")!)} />
						<Gtk.Label
							class={"date"}
							label={time((d) => d.format("%A, %B %d")!)}
						/>
					</Gtk.Box>
					<Gtk.Box
						class={"calendar-box"}
						hexpand={true}
						valign={Gtk.Align.START}
					>
						<Gtk.Calendar
							showHeading={true}
							showDayNames={true}
							showWeekNumbers={false}
							onDaySelected={(cal) => {
								const dt = cal.get_date();
								const y = dt.get_year();
								const m = dt.get_month();
								const d = dt.get_day_of_month();
								const baseUrl = generalConfig.getProperty(
									"clock.calendar_url",
									"string",
								);
								let url: string | null = null;
								if (baseUrl?.includes("calendar.google.com")) {
									url = `https://calendar.google.com/calendar/r/day/${y}/${m}/${d}`;
								} else if (baseUrl) {
									url = baseUrl;
								}
								if (url) {
									execAsync([
										"bash",
										"-c",
										`desktop=$(xdg-settings get default-web-browser) && ` +
											`grep -m1 "^Exec=" /usr/share/applications/$desktop 2>/dev/null | ` +
											`sed 's/^Exec=//' | sed 's/ %[uUfFiI]//g'`,
									])
										.then((cmd) => {
											const browser = cmd.trim();
											if (!browser) return;
											// Extract domain for Hyprland windowrule matching.
											// [float] in exec dispatch doesn't work when browser
											// reuses an existing process, so we add a dynamic
											// windowrulev2 that matches the --app= window class
											// (Chromium embeds the domain in the window class).
											const domainMatch = url!.match(/^https?:\/\/([^/]+)/);
											if (domainMatch) {
												const domain = domainMatch[1].replace(/\./g, "\\.");
												execAsync([
													"hyprctl",
													"--batch",
													`keyword windowrulev2 float,class:(${domain}) ; ` +
														`keyword windowrulev2 size 950 700,class:(${domain})`,
												]).catch(() => {});
											}
											execAsync([browser, `--app=${url}`]).catch(() => {});
										})
										.catch(() => {});
								}
								Windows.getDefault().close("center-window");
							}}
						/>
					</Gtk.Box>
				</Gtk.Box>

				<Separator
					orientation={Gtk.Orientation.HORIZONTAL}
					cssColor="gray"
					margin={5}
					spacing={8}
					alpha={0.3}
					visible={variableToBoolean(
						createBinding(AstalMpris.get_default(), "players"),
					)}
				/>
				<BigMedia />
			</Gtk.Box>
		</PopupWindow>
	);
};
