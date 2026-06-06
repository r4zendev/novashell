import { execAsync } from "ags/process";

import type { ColorData } from "./types";

export function updateHyprlandColors(data: ColorData): void {
	const accent = (data.accent || data.colors.color4).replace(/^#/, "");
	const inactive = data.colors.color8.replace(/^#/, "");

	execAsync(`hyprctl keyword general:col.active_border "rgb(${accent})"`).catch(
		() => {},
	);

	execAsync(
		`hyprctl keyword general:col.inactive_border "rgb(${inactive})"`,
	).catch(() => {});
}
