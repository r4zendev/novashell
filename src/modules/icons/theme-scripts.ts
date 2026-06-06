import Gio from "gi://Gio?version=2.0";

import { writeFileAsync } from "ags/file";
import { execAsync } from "ags/process";

import {
	SCRIPT_ALIASES,
	SCRIPT_CACHE_DIR,
	SCRIPT_RESOURCE_PREFIX,
} from "./theme-config";

const cachedScriptPaths = new Map<string, string>();

function decodeResource(path: string): string {
	const bytes = Gio.resources_lookup_data(path, null).get_data();
	if (!bytes) return "";
	return new TextDecoder().decode(bytes);
}

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

function ensureScriptCacheDir(): void {
	const dir = Gio.File.new_for_path(SCRIPT_CACHE_DIR);
	if (!dir.query_exists(null)) {
		dir.make_directory_with_parents(null);
	}
}

async function ensureScript(alias: string): Promise<string> {
	const cached = cachedScriptPaths.get(alias);
	if (cached && Gio.File.new_for_path(cached).query_exists(null)) {
		return cached;
	}

	ensureScriptCacheDir();

	const scriptPath = `${SCRIPT_CACHE_DIR}/${alias}`;
	const resourcePath = `${SCRIPT_RESOURCE_PREFIX}/${alias}`;
	const resourceContent = decodeResource(resourcePath);
	const currentContent = readTextFile(scriptPath);

	if (resourceContent !== currentContent) {
		await writeFileAsync(scriptPath, resourceContent);
	}

	cachedScriptPaths.set(alias, scriptPath);
	return scriptPath;
}

export async function runIconScript(
	alias: keyof typeof SCRIPT_ALIASES,
	args: Array<string>,
): Promise<void> {
	const scriptPath = await ensureScript(SCRIPT_ALIASES[alias]);
	await execAsync(["python3", scriptPath, ...args]);
}

export async function updateThemeInherits(themePath: string): Promise<void> {
	const indexPath = `${themePath}/index.theme`;
	const content = readTextFile(indexPath);
	if (!content) return;

	const desired = ["Novashell-Icons", "Papirus-Dark", "Papirus", "hicolor"];
	let updated = content;

	if (/^Inherits=/m.test(updated)) {
		updated = updated.replace(/^Inherits=.*$/m, (line) => {
			const existing = line
				.replace(/^Inherits=/, "")
				.split(",")
				.map((name) => name.trim())
				.filter((name) => name.length > 0);
			const merged = [
				...desired,
				...existing.filter((n) => !desired.includes(n)),
			];
			return `Inherits=${merged.join(",")}`;
		});
	} else {
		updated = updated.replace(
			/^\[Icon Theme\]$/m,
			`[Icon Theme]\nInherits=${desired.join(",")}`,
		);
	}

	if (updated !== content) {
		await writeFileAsync(indexPath, updated).catch(() => {});
	}
}
