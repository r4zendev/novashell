import GLib from "gi://GLib?version=2.0";
import Gio from "gi://Gio?version=2.0";

import { Compositor } from "~/modules/compositors/base";
import { CompositorHyprland } from "~/modules/compositors/hyprland";

function hyprlandSocketExists(): boolean {
	const sig = GLib.getenv("HYPRLAND_INSTANCE_SIGNATURE");
	if (!sig) return false;
	const path = `${GLib.get_user_runtime_dir()}/hypr/${sig}/.socket.sock`;
	return Gio.File.new_for_path(path).query_exists(null);
}

const desktopName = GLib.getenv("XDG_CURRENT_DESKTOP")?.toLowerCase();
switch (desktopName) {
	case "hyprland":
		if (!hyprlandSocketExists()) {
			console.error("Compositor: Hyprland socket not found — stale session?");
			break;
		}
		Compositor.instance = new CompositorHyprland();
		break;

	default:
		console.error(`This compositor(${desktopName}) is not yet implemented to novashell. \
Please contribute by implementing it if you can! :)`);
		// TODO implement a common wayland compositor support using the proposed AstalWl library
		break;
}
