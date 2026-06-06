import type AstalApps from "gi://AstalApps";
import Pango from "gi://Pango?version=1.0";

import { createState, For } from "ags";
import { Astal, Gdk, Gtk } from "ags/gtk4";

import {
	execApp,
	filterExcludedApps,
	getAppIcon,
	getApps,
	queryApps,
} from "~/modules/apps";
import { escapeUnintendedMarkup } from "~/modules/utils";
import { getPopupWindowContainer, PopupWindow } from "~/widget/PopupWindow";

const ignoredKeys = new Set([
	Gdk.KEY_Right,
	Gdk.KEY_Down,
	Gdk.KEY_Up,
	Gdk.KEY_Shift_L,
	Gdk.KEY_Shift_R,
	Gdk.KEY_Shift_Lock,
	Gdk.KEY_Left,
	Gdk.KEY_Return,
	Gdk.KEY_space,
]);

export const AppsWindow = (mon: number) => {
	const getSortedApps = () =>
		[...getApps()].sort((a, b) => b.frequency - a.frequency);
	const getFilteredApps = (items: Array<AstalApps.Application>) =>
		filterExcludedApps(items);

	const [results, setResults] = createState(
		getFilteredApps(getSortedApps()) as Array<AstalApps.Application>,
	);

	return (
		<PopupWindow
			namespace="apps-window"
			layer={Astal.Layer.OVERLAY}
			exclusivity={Astal.Exclusivity.IGNORE}
			monitor={mon}
			marginTop={64}
			class={"apps-window"}
			orientation={Gtk.Orientation.VERTICAL}
			cssBackgroundWindow="background: rgba(0, 0, 0, .2);"
			actionKeyPressed={(self, key) => {
				const entry = getPopupWindowContainer(self)
					.get_first_child()!
					.get_first_child()!
					.get_first_child()! as Gtk.SearchEntry;

				if (ignoredKeys.has(key)) return;

				entry.grab_focus();
			}}
		>
			<Gtk.Box hexpand={false} halign={Gtk.Align.CENTER}>
				<Gtk.SearchEntry
					hexpand={false}
					onSearchChanged={(self) => {
						const text = self.text.trim();
						setResults(
							getFilteredApps(text ? queryApps(text) : getSortedApps()),
						);
					}}
					onStopSearch={(self) => (self.get_root() as Astal.Window)?.close()}
				/>
			</Gtk.Box>

			<Gtk.ScrolledWindow
				vscrollbarPolicy={Gtk.PolicyType.AUTOMATIC}
				hscrollbarPolicy={Gtk.PolicyType.NEVER}
				overlayScrolling
				propagateNaturalHeight={false}
				hexpand
				vexpand
			>
				<Gtk.Box hexpand={false} vexpand={false}>
					<Gtk.FlowBox
						rowSpacing={60}
						columnSpacing={60}
						activateOnSingleClick
						minChildrenPerLine={1}
						homogeneous
						onChildActivated={
							(_, child) => child.get_child()!.activate() // pass activation to button
						}
					>
						<For each={results}>
							{(app) => (
								<Gtk.Button
									heightRequest={150}
									tooltipMarkup={`${escapeUnintendedMarkup(app.name)}${
										app.description
											? `\n<span foreground="#7f7f7f">${escapeUnintendedMarkup(
													app.description,
												)}</span>`
											: ""
									}`}
									onActivate={(self) => {
										execApp(app);
										(self.get_root() as Astal.Window)?.close();
									}}
									onClicked={(self) => {
										execApp(app);
										(self.get_root() as Astal.Window)?.close();
									}}
								>
									<Gtk.Box
										orientation={Gtk.Orientation.VERTICAL}
										valign={Gtk.Align.CENTER}
										hexpand={false}
										vexpand={false}
									>
										<Gtk.Image
											iconName={getAppIcon(app) ?? "application-x-executable"}
											iconSize={Gtk.IconSize.LARGE}
											vexpand={false}
											class={"app-icon"}
										/>
										<Gtk.Label
											ellipsize={Pango.EllipsizeMode.END}
											label={app.name}
											valign={Gtk.Align.END}
											maxWidthChars={30}
											class={"app-name"}
										/>
									</Gtk.Box>
								</Gtk.Button>
							)}
						</For>
					</Gtk.FlowBox>
				</Gtk.Box>
			</Gtk.ScrolledWindow>
		</PopupWindow>
	);
};
