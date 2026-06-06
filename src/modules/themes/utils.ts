import Gio from "gi://Gio?version=2.0";
import GLib from "gi://GLib?version=2.0";

import { writeFileAsync } from "ags/file";
import { execAsync } from "ags/process";

export const stripHash = (hex: string) => hex.replace(/^#/, "");

export function ensureDirectory(path: string): void {
	const dir = Gio.File.new_for_path(path);
	if (!dir.query_exists(null)) {
		dir.make_directory_with_parents(null);
	}
}

export async function copyContentInPlace(
	content: string,
	targetPath: string,
	tmpPrefix: string,
): Promise<void> {
	const tmpPath = `${GLib.get_tmp_dir()}/${tmpPrefix}-${GLib.get_monotonic_time()}`;
	await writeFileAsync(tmpPath, content);
	await execAsync(["cp", "--", tmpPath, targetPath]);
}

export function adjustLightness(hex: string, amount: number): string {
	const h = hex.replace(/^#/, "");
	const r = Math.max(
		0,
		Math.min(255, parseInt(h.substring(0, 2), 16) + amount),
	);
	const g = Math.max(
		0,
		Math.min(255, parseInt(h.substring(2, 4), 16) + amount),
	);
	const b = Math.max(
		0,
		Math.min(255, parseInt(h.substring(4, 6), 16) + amount),
	);
	return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}
