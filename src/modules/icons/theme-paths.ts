import GLib from "gi://GLib?version=2.0";

import { execAsync } from "ags/process";

import { generalConfig } from "~/config";
import {
	ICON_THEME_OVERLAY_SOURCE,
	ICON_THEME_SOURCE_CANDIDATES,
	NOVASHELL_ICON_THEME_NAME,
	SYSTEM_ICON_DIR,
} from "./theme-config";
import type { IconThemeSource } from "./theme-types";

function trimQuotes(value: string): string {
	return value.trim().replace(/^'/, "").replace(/'$/, "");
}

export function getIconThemePath(themeName: string): string | null {
	const userTheme = `${GLib.get_user_data_dir()}/icons/${themeName}`;
	if (GLib.file_test(userTheme, GLib.FileTest.IS_DIR)) return userTheme;

	const systemTheme = `${SYSTEM_ICON_DIR}/${themeName}`;
	if (GLib.file_test(systemTheme, GLib.FileTest.IS_DIR)) return systemTheme;

	return null;
}

export function getIconThemePaths(themeName: string): Array<string> {
	const paths: Array<string> = [];

	const userTheme = `${GLib.get_user_data_dir()}/icons/${themeName}`;
	if (GLib.file_test(userTheme, GLib.FileTest.IS_DIR)) paths.push(userTheme);

	const systemTheme = `${SYSTEM_ICON_DIR}/${themeName}`;
	if (
		GLib.file_test(systemTheme, GLib.FileTest.IS_DIR) &&
		!paths.includes(systemTheme)
	) {
		paths.push(systemTheme);
	}

	return paths;
}

export async function getCurrentGtkIconTheme(): Promise<string | null> {
	try {
		const output = await execAsync([
			"gsettings",
			"get",
			"org.gnome.desktop.interface",
			"icon-theme",
		]);
		return trimQuotes(output);
	} catch {
		return null;
	}
}

export async function resolveSourceTheme(): Promise<IconThemeSource> {
	const checked = new Set<string>();
	const candidates: string[] = [...ICON_THEME_SOURCE_CANDIDATES];

	const current = await getCurrentGtkIconTheme();
	if (
		current &&
		current !== NOVASHELL_ICON_THEME_NAME &&
		!candidates.includes(current)
	) {
		candidates.push(current);
	}

	for (const themeName of candidates) {
		if (
			checked.has(themeName) ||
			themeName.trim().length === 0 ||
			themeName === NOVASHELL_ICON_THEME_NAME
		) {
			continue;
		}

		checked.add(themeName);
		const path = getIconThemePath(themeName);
		if (path) return { name: themeName, path };
	}

	throw new Error(
		`IconUtils: Couldn't locate source icon theme. Checked: ${candidates.join(", ")}`,
	);
}

export async function resolveRegularThemeName(): Promise<string> {
	const configured = generalConfig.getProperty(
		"theme.icon_theme_regular",
		"string",
	) as string | null;
	if (configured && getIconThemePath(configured)) return configured;

	const current = await getCurrentGtkIconTheme();
	if (
		current &&
		current !== NOVASHELL_ICON_THEME_NAME &&
		getIconThemePath(current)
	) {
		return current;
	}

	const fallbacks = [
		ICON_THEME_OVERLAY_SOURCE,
		...ICON_THEME_SOURCE_CANDIDATES,
		"hicolor",
	];

	for (const name of fallbacks) {
		if (getIconThemePath(name)) return name;
	}

	return "hicolor";
}
