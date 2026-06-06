import { execAsync } from "ags/process";

import type { ColorData } from "./types";

export function broadcastTerminalColors(data: ColorData): void {
	const parts: string[] = [];

	for (let i = 0; i <= 15; i++) {
		const key = `color${i}` as keyof typeof data.colors;
		if (data.colors[key]) parts.push(`\\033]4;${i};${data.colors[key]}\\007`);
	}

	parts.push(`\\033]10;${data.special.foreground}\\007`);
	parts.push(`\\033]12;${data.special.cursor}\\007`);

	const seq = parts.join("");

	execAsync([
		"python3",
		`${SOURCE_DIR}/scripts/broadcast-terminal-colors.py`,
		seq,
	])
		.then(() => {})
		.catch((e) => console.error(`ColorUtils: Broadcast failed: ${e}`));
}
