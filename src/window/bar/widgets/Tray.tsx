import AstalTray from "gi://AstalTray";
import Gio from "gi://Gio?version=2.0";
import type GObject from "gi://GObject?version=2.0";

import { createBinding, createComputed, For, With } from "ags";
import { Gdk, Gtk } from "ags/gtk4";

import { getAppIcon, getSymbolicIcon } from "~/modules/apps";

const astalTray = AstalTray.get_default();

type TrayIcon = { gicon: Gio.Icon; symbolic: boolean };

function extractTrayIdentifiers(item: AstalTray.TrayItem): string[] {
	const ids = [item.id, item.iconName, item.title];

	const tooltip = item.tooltipMarkup || item.tooltipText || "";
	if (tooltip) ids.push(tooltip.replace(/<[^>]*>/g, "").trim());

	if (item.gicon instanceof Gio.ThemedIcon) {
		const names = item.gicon.get_names();
		if (names) ids.push(...names);
	}

	return ids.filter((id): id is string => !!id && id !== "null");
}

function resolveTrayIcon(item: AstalTray.TrayItem): TrayIcon {
	const identifiers = extractTrayIdentifiers(item);

	for (const id of identifiers) {
		const symbolic = getSymbolicIcon(id);
		if (symbolic)
			return { gicon: Gio.ThemedIcon.new(symbolic), symbolic: true };
	}

	for (const id of identifiers) {
		const icon = getAppIcon(id);
		if (icon) return { gicon: Gio.ThemedIcon.new(icon), symbolic: false };
	}

	return {
		gicon:
			item.gicon ?? Gio.ThemedIcon.new("application-x-executable-symbolic"),
		symbolic: false,
	};
}

export const Tray = () => {
	const items = createBinding(astalTray, "items").as((items) =>
		items.filter((item) => item?.gicon),
	);

	return (
		<Gtk.Box class={"tray"} spacing={10}>
			<For each={items}>
				{(item: AstalTray.TrayItem) => (
					<Gtk.Box class={"item"}>
						<With
							value={createComputed([
								createBinding(item, "actionGroup"),
								createBinding(item, "menuModel"),
							])}
						>
							{([actionGroup, menuModel]: [Gio.ActionGroup, Gio.MenuModel]) => {
								const popover = Gtk.PopoverMenu.new_from_model(menuModel);
								popover.insert_action_group("dbusmenu", actionGroup);
								popover.hasArrow = false;

								return (
									<Gtk.Box
										class={"item"}
										tooltipMarkup={createBinding(item, "tooltipMarkup")}
										tooltipText={createBinding(item, "tooltipText")}
										$={(self) => {
											const conns: Map<GObject.Object, number> = new Map();
											const gestureClick = Gtk.GestureClick.new();
											gestureClick.set_button(0);

											self.add_controller(gestureClick);

											conns.set(
												gestureClick,
												gestureClick.connect("released", (gesture, _, x, y) => {
													if (
														gesture.get_current_button() === Gdk.BUTTON_PRIMARY
													) {
														item.activate(x, y);
														return;
													}

													if (
														gesture.get_current_button() ===
														Gdk.BUTTON_SECONDARY
													) {
														item.about_to_show();
														popover.popup();
													}
												}),
											);
										}}
									>
										<Gtk.Image
											gicon={createBinding(item, "gicon").as(
												() => resolveTrayIcon(item).gicon,
											)}
											cssClasses={createBinding(item, "gicon").as(() =>
												resolveTrayIcon(item).symbolic
													? ["icon-symbolic"]
													: ["icon-regular"],
											)}
											pixelSize={16}
										/>
										{popover}
									</Gtk.Box>
								);
							}}
						</With>
					</Gtk.Box>
				)}
			</For>
		</Gtk.Box>
	);
};
