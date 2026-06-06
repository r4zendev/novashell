import AstalApps from "gi://AstalApps";
import Gio from "gi://Gio?version=2.0";
import GLib from "gi://GLib?version=2.0";

import { Gdk, Gtk } from "ags/gtk4";
import { execAsync } from "ags/process";

import { generalConfig } from "~/config";
import type { ColorData } from "~/modules/themes/types";
import { ensureDirectory } from "~/modules/themes/utils";
import { invalidateIconLookupCache } from "./resolver";
import {
	ICON_THEME_LOCK_DIR,
	ICON_THEME_META_FILE,
	ICON_THEME_OVERLAY_SOURCE,
	NOVASHELL_ICON_THEME_NAME,
} from "./theme-config";
import { loadThemeMeta, saveThemeMeta } from "./theme-meta";
import {
	getIconThemePaths,
	resolveRegularThemeName,
	resolveSourceTheme,
} from "./theme-paths";
import { runIconScript, updateThemeInherits } from "./theme-scripts";
import type { IconThemeSource } from "./theme-types";

const astalApps = new AstalApps.Apps();
let iconThemeUpdateQueue: Promise<void> = Promise.resolve();

function getDesktopId(app: AstalApps.Application): string {
	const withDesktopId = app as AstalApps.Application & {
		get_desktop_id?: () => string | null;
	};

	if (typeof withDesktopId.get_desktop_id === "function") {
		return withDesktopId.get_desktop_id() ?? "";
	}

	return "";
}

function isIconGenerationEnabled(): boolean {
	return (
		(generalConfig.getProperty("theme.icon_generation_enabled", "boolean") as
			| boolean
			| null) !== false
	);
}

function expandIconNameAliases(name: string, into: Set<string>): void {
	const normalized = name.trim();
	if (!normalized) return;
	if (normalized.includes("/") || normalized.includes("\\")) return;

	const noDesktop = normalized.replace(/\.desktop$/i, "");
	const variants = [
		normalized,
		normalized.toLowerCase(),
		noDesktop,
		noDesktop.toLowerCase(),
		noDesktop.replaceAll("_", "-"),
		noDesktop.replaceAll("-", "_"),
	];

	if (noDesktop.includes(".")) {
		const split = noDesktop.split(".").filter(Boolean);
		variants.push(split[split.length - 1]);
	}

	for (const variant of variants) {
		const trimmed = variant.trim();
		if (trimmed) into.add(trimmed);
	}
}

function getOverlayIconNames(): Array<string> {
	const names = new Set<string>();

	const overrides = generalConfig.getProperty(
		"apps.icon_overrides",
		"object",
	) as Record<string, string> | null;

	if (overrides) {
		for (const iconName of Object.values(overrides)) {
			expandIconNameAliases(iconName, names);
		}
	}

	for (const app of astalApps.get_list()) {
		expandIconNameAliases(app.iconName ?? "", names);
		expandIconNameAliases(app.wmClass ?? "", names);
		expandIconNameAliases(getDesktopId(app), names);
	}

	return [...names].sort();
}

function getOverlaySignature(names: Array<string>): string {
	return names.map((name) => name.toLowerCase()).join(",");
}

async function applyThemeSelection(themeName: string): Promise<void> {
	await execAsync([
		"gsettings",
		"set",
		"org.gnome.desktop.interface",
		"icon-theme",
		themeName,
	]).catch((e: Error) => {
		console.error(`IconUtils: Failed to set GTK icon theme: ${e.message}`);
	});

	await execAsync([
		"kwriteconfig6",
		"--file",
		"kdeglobals",
		"--group",
		"Icons",
		"--key",
		"Theme",
		themeName,
	]).catch((e: Error) => {
		console.error(`IconUtils: Failed to set KDE icon theme: ${e.message}`);
	});

	await execAsync([
		"bash",
		"-c",
		"command -v kbuildsycoca6 >/dev/null && kbuildsycoca6 >/dev/null 2>&1 || true",
	]).catch(() => {});

	const display = Gdk.Display.get_default();
	if (display) {
		const iconTheme = Gtk.IconTheme.get_for_display(display);
		if (iconTheme.get_theme_name() === themeName)
			iconTheme.set_theme_name("hicolor");
		iconTheme.set_theme_name(themeName);
	}

	invalidateIconLookupCache();
}

async function applyRegularTheme(): Promise<void> {
	const regularTheme = await resolveRegularThemeName();
	await applyThemeSelection(regularTheme);
}

async function cleanupTempThemes(iconsRoot: string): Promise<void> {
	await execAsync(["rm", "-rf", `${iconsRoot}/${ICON_THEME_LOCK_DIR}`]).catch(
		() => {},
	);

	const dir = Gio.File.new_for_path(iconsRoot);
	if (!dir.query_exists(null)) return;

	try {
		const enumerator = dir.enumerate_children(
			"standard::name,standard::type",
			Gio.FileQueryInfoFlags.NONE,
			null,
		);

		while (true) {
			const info = enumerator.next_file(null);
			if (!info) break;

			const name = info.get_name();
			if (
				name.startsWith(`${NOVASHELL_ICON_THEME_NAME}.tmp-`) ||
				name.startsWith(`${NOVASHELL_ICON_THEME_NAME}.bak-`)
			) {
				await execAsync(["rm", "-rf", `${iconsRoot}/${name}`]).catch(() => {});
			}
		}
	} catch {}
}

async function copyThemeSource(
	source: string,
	destination: string,
): Promise<void> {
	await execAsync(["mkdir", "-p", destination]);
	await execAsync(["cp", "-a", `${source}/.`, destination]);
}

async function copyOverlayCategories(destination: string): Promise<void> {
	for (const overlayPath of getIconThemePaths(ICON_THEME_OVERLAY_SOURCE)) {
		await runIconScript("overlayCategories", [destination, overlayPath]);
	}
}

async function copyOverlayIcons(
	destination: string,
	iconNames: Array<string>,
	accent: string,
): Promise<void> {
	if (iconNames.length === 0) return;

	for (const sourceName of [ICON_THEME_OVERLAY_SOURCE, "hicolor"]) {
		for (const overlayPath of getIconThemePaths(sourceName)) {
			await runIconScript("overlayApps", [
				destination,
				overlayPath,
				iconNames.join(","),
				accent,
			]);
		}
	}
}

async function recolorTheme(
	destination: string,
	accent: string,
): Promise<void> {
	await runIconScript("recolor", [destination, accent]);
}

async function refreshIconCache(themePath: string): Promise<void> {
	await execAsync(["gtk4-update-icon-cache", "-f", "-t", themePath]).catch(
		(e: Error) => {
			console.error(`IconUtils: gtk4-update-icon-cache failed: ${e.message}`);
		},
	);
}

async function applyIconThemeUpdate(data: ColorData): Promise<void> {
	if (!isIconGenerationEnabled()) {
		await applyRegularTheme();
		return;
	}

	const accent = (data.accent || data.colors.color4).toLowerCase();
	const overlayIconNames = getOverlayIconNames();
	const overlaySignature = getOverlaySignature(overlayIconNames);

	const iconsRoot = `${GLib.get_user_data_dir()}/icons`;
	const generatedThemePath = `${iconsRoot}/${NOVASHELL_ICON_THEME_NAME}`;
	const generatedIndexPath = `${generatedThemePath}/index.theme`;
	const metadataPath = `${generatedThemePath}/${ICON_THEME_META_FILE}`;

	ensureDirectory(iconsRoot);
	await cleanupTempThemes(iconsRoot);

	let source: IconThemeSource;
	try {
		source = await resolveSourceTheme();
	} catch (e) {
		console.error(`${e}`);
		if (!GLib.file_test(generatedIndexPath, GLib.FileTest.EXISTS)) {
			await applyRegularTheme();
		}
		return;
	}

	const themeExists = GLib.file_test(generatedThemePath, GLib.FileTest.IS_DIR);
	const existingMeta = loadThemeMeta(metadataPath);
	const needsRegeneration =
		!themeExists ||
		!existingMeta ||
		existingMeta.accent !== accent ||
		existingMeta.sourceTheme !== source.name ||
		existingMeta.overridesSignature !== overlaySignature;

	if (needsRegeneration) {
		const tempThemePath = `${iconsRoot}/${NOVASHELL_ICON_THEME_NAME}.tmp-${GLib.get_monotonic_time()}`;
		const tempMetaPath = `${tempThemePath}/${ICON_THEME_META_FILE}`;
		const backupThemePath = `${iconsRoot}/${NOVASHELL_ICON_THEME_NAME}.bak-${GLib.get_monotonic_time()}`;

		try {
			await execAsync(["rm", "-rf", tempThemePath]);
			await execAsync(["rm", "-rf", backupThemePath]);

			await copyThemeSource(source.path, tempThemePath);
			await updateThemeInherits(tempThemePath);
			await copyOverlayCategories(tempThemePath);
			await copyOverlayIcons(tempThemePath, overlayIconNames, accent);
			await recolorTheme(tempThemePath, accent);
			await refreshIconCache(tempThemePath);
			await saveThemeMeta(tempMetaPath, {
				accent,
				sourceTheme: source.name,
				overridesSignature: overlaySignature,
			});

			if (GLib.file_test(generatedThemePath, GLib.FileTest.IS_DIR)) {
				await execAsync(["mv", generatedThemePath, backupThemePath]);
			}

			await execAsync(["mv", tempThemePath, generatedThemePath]);
			await execAsync(["rm", "-rf", backupThemePath]).catch(() => {});
		} catch (e) {
			if (
				GLib.file_test(backupThemePath, GLib.FileTest.IS_DIR) &&
				!GLib.file_test(generatedThemePath, GLib.FileTest.IS_DIR)
			) {
				await execAsync(["mv", backupThemePath, generatedThemePath]).catch(
					() => {},
				);
			}
			await execAsync(["rm", "-rf", tempThemePath]).catch(() => {});
			console.error(`IconUtils: Failed to build icon theme: ${e}`);
			return;
		}
	}

	if (GLib.file_test(generatedIndexPath, GLib.FileTest.EXISTS)) {
		await applyThemeSelection(NOVASHELL_ICON_THEME_NAME);
	} else {
		await applyThemeSelection(source.name);
	}
}

export async function updateIconTheme(data: ColorData): Promise<void> {
	iconThemeUpdateQueue = iconThemeUpdateQueue
		.then(() => applyIconThemeUpdate(data))
		.catch((e) => {
			console.error(`IconUtils: Queued update failed: ${e}`);
		});

	return iconThemeUpdateQueue;
}

export function shouldUseGeneratedIconTheme(): boolean {
	return isIconGenerationEnabled();
}

export function getGeneratedIconThemeName(): string {
	return NOVASHELL_ICON_THEME_NAME;
}
