import Gio from "gi://Gio?version=2.0";

import { writeFileAsync } from "ags/file";

import type { IconThemeMeta } from "./theme-types";

function readTextFile(path: string): string | null {
	const file = Gio.File.new_for_path(path);
	if (!file.query_exists(null)) return null;

	try {
		const [ok, bytes] = file.load_contents(null);
		if (!ok) return null;
		return new TextDecoder().decode(bytes);
	} catch {
		return null;
	}
}

export function loadThemeMeta(metaPath: string): IconThemeMeta | null {
	const text = readTextFile(metaPath);
	if (!text) return null;

	try {
		const parsed = JSON.parse(text) as Partial<IconThemeMeta>;
		if (
			typeof parsed.accent !== "string" ||
			typeof parsed.sourceTheme !== "string"
		) {
			return null;
		}

		return {
			accent: parsed.accent,
			sourceTheme: parsed.sourceTheme,
			overridesSignature:
				typeof parsed.overridesSignature === "string"
					? parsed.overridesSignature
					: "",
		};
	} catch {
		return null;
	}
}

export async function saveThemeMeta(
	metaPath: string,
	meta: IconThemeMeta,
): Promise<void> {
	await writeFileAsync(metaPath, `${JSON.stringify(meta, null, "\t")}\n`).catch(
		(e: Error) => {
			console.error(`IconUtils: Failed to write icon metadata: ${e.message}`);
		},
	);
}
