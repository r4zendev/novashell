import Gio from "gi://Gio?version=2.0";
import GLib from "gi://GLib?version=2.0";
import GObject from "gi://GObject?version=2.0";

import { writeFileAsync } from "ags/file";
import { property, register } from "ags/gobject";

import { generalConfig } from "~/config";
import { Notifications } from "~/modules/notifications";
import { Stylesheet } from "~/modules/stylesheet";
import type { ThemeData } from "~/modules/themes/types";
import { ensureDirectory } from "~/modules/themes/utils";
import { decoder } from "~/modules/utils";
import { Wallpaper } from "~/modules/wallpaper";

type AvailableTheme = {
	id: string;
	name: string;
	isPywal: boolean;
};

const THEMES_RESOURCE_PATH = "/io/github/razen/novashell/themes";
const WAL_COLORS_PATH = `${GLib.get_user_cache_dir()}/wal/colors.json`;

@register({ GTypeName: "ThemeService" })
export class ThemeService extends GObject.Object {
	private static instance: ThemeService;

	@property(String)
	currentTheme: string = "pywal";

	constructor() {
		super();

		// Initialize from config
		this.currentTheme =
			generalConfig.getProperty("theme.current", "string") || "pywal";
	}

	public static getDefault(): ThemeService {
		if (!ThemeService.instance) ThemeService.instance = new ThemeService();

		return ThemeService.instance;
	}

	private sendThemeNotification(summary: string, body: string): void {
		Notifications.getDefault().sendNotification({
			appName: "novashell",
			summary,
			body,
			transient: true,
		});
	}

	/** Get list of available themes */
	public getAvailableThemes(): AvailableTheme[] {
		const themes: AvailableTheme[] = [
			{ id: "pywal", name: "System (pywal)", isPywal: true },
		];

		// Get bundled themes from resources
		try {
			const themeFiles = Gio.resources_enumerate_children(
				THEMES_RESOURCE_PATH,
				Gio.ResourceLookupFlags.NONE,
			);
			for (const file of themeFiles) {
				const themeId = file.replace(".json", "");
				const data = this.loadThemeFromResource(themeId);
				if (data) {
					themes.push({
						id: themeId,
						name: data.name || themeId,
						isPywal: false,
					});
				}
			}
		} catch (e) {
			console.warn(`ThemeService: Could not enumerate themes: ${e}`);
		}

		return themes;
	}

	/** Load theme data from bundled resource */
	private loadThemeFromResource(themeId: string): ThemeData | null {
		try {
			const path = `${THEMES_RESOURCE_PATH}/${themeId}`;
			const data = Gio.resources_lookup_data(
				path,
				Gio.ResourceLookupFlags.NONE,
			);
			const content = decoder.decode(data.get_data()!);
			return JSON.parse(content) as ThemeData;
		} catch (e) {
			console.error(`ThemeService: Could not load theme "${themeId}": ${e}`);
			return null;
		}
	}

	/** Apply a theme by ID */
	public async applyTheme(themeId: string): Promise<boolean> {
		if (themeId === "pywal") {
			// For pywal, sync colors from current wallpaper
			this.currentTheme = "pywal";
			generalConfig.setProperty("theme.current", "pywal", true);
			this.notify("current-theme");

			const wallpaper = Wallpaper.getDefault();
			if (wallpaper.wallpaper) {
				wallpaper.syncColorsFromWallpaper();
			} else {
				console.warn(
					"ThemeService: no wallpaper set, can't regenerate pywal colors",
				);
			}

			this.sendThemeNotification(
				"Theme changed",
				"Switched to System (pywal) - colors sync from wallpaper",
			);

			return true;
		}

		// Load static theme
		const themeData = this.loadThemeFromResource(themeId);
		if (!themeData) {
			this.sendThemeNotification(
				"Theme error",
				`Could not load theme "${themeId}"`,
			);
			return false;
		}

		// Write theme to wal colors.json, then explicitly reload stylesheet + external colors.
		try {
			const currentWallpaper = Wallpaper.getDefault().wallpaper;
			if (currentWallpaper) {
				themeData.wallpaper = currentWallpaper;
			}

			// Ensure wal cache directory exists
			ensureDirectory(`${GLib.get_user_cache_dir()}/wal`);

			const json = JSON.stringify(themeData, null, 4);
			await writeFileAsync(WAL_COLORS_PATH, json);

			// Explicitly reload — file monitors are unreliable for same-process writes
			Stylesheet.getDefault().reloadColors();

			this.currentTheme = themeId;
			generalConfig.setProperty("theme.current", themeId, true);
			this.notify("current-theme");

			this.sendThemeNotification(
				"Theme changed",
				`Applied "${themeData.name}" theme`,
			);

			return true;
		} catch (e) {
			console.error(`ThemeService: Could not apply theme: ${e}`);
			this.sendThemeNotification(
				"Theme error",
				`Failed to apply theme: ${(e as Error).message}`,
			);
			return false;
		}
	}

	/** Get current theme ID */
	public getCurrentTheme(): string {
		return this.currentTheme;
	}

	/** Check if current theme is pywal (colors sync with wallpaper) */
	public isPywalMode(): boolean {
		return this.currentTheme === "pywal";
	}
}
