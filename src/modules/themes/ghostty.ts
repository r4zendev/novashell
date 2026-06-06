import GLib from "gi://GLib?version=2.0";

import { execAsync } from "ags/process";

import type { ColorData } from "./types";
import { copyContentInPlace } from "./utils";

function reloadGhostty(): void {
	execAsync([
		"bash",
		"-c",
		`hyprctl clients -j | jq -r '.[] | select(.class == "com.mitchellh.ghostty") | .address' | while read addr; do hyprctl dispatch sendshortcut "CTRL SHIFT, comma, address:$addr" 2>/dev/null; done`,
	])
		.then(() => {})
		.catch(() => {});
}

export async function updateGhosttyColors(data: ColorData): Promise<void> {
	const colors = data.colors;
	const special = data.special;

	const lines: string[] = [];

	for (let i = 0; i <= 15; i++) {
		const colorKey = `color${i}` as keyof typeof colors;
		if (colors[colorKey]) {
			lines.push(`palette = ${i}=${colors[colorKey]}`);
		}
	}

	lines.push(``);
	lines.push(`background = ${special.background}`);
	lines.push(`foreground = ${special.foreground}`);
	lines.push(`cursor-color = ${special.cursor}`);
	lines.push(`selection-background = ${colors.color8}`);
	lines.push(`selection-foreground = ${special.foreground}`);

	const content = lines.join("\n") + "\n";
	const ghosttyColorsPath = `${GLib.get_user_config_dir()}/ghostty/colors`;

	await copyContentInPlace(
		content,
		ghosttyColorsPath,
		"novashell-ghostty-colors",
	).catch((e: Error) => {
		console.error(`ColorUtils: Failed to cp ghostty colors: ${e.message}`);
	});

	reloadGhostty();
}
