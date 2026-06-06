import GLib from "gi://GLib?version=2.0";

import { Config } from "~/modules/config";
import type { WallpaperPositioning, WalMode } from "~/modules/wallpaper";

const generalConfigDefaults = {
	notifications: {
		/** low-priority notification timeout
		 * @default 4000 */
		timeout_low: 4000,
		/** regular notification timeout
		 * @default 6000 */
		timeout_normal: 6000,
		/** critical/very important notification timeout
		 * @default 0 */
		timeout_critical: 0,
		/** notification popup horizontal position. can be "left" or "right"
		 * @default "right" */
		position_h: "right",
		/** vertical notification popup position. can be "top" or "bottom"
		 * @default "top" */
		position_v: "top",
		/** dismiss notification popup when it gets unhovered.
		 * breaks hold_on_hover a bit, notification will instantly be dismissed after unhover
		 * @default false */
		dismiss_on_unhover: false,
		/** hold the notification popup while hovering it.
		 * @default true */
		hold_on_hover: true,
		/** enable notification sounds
		 * @default true */
		sound_enabled: true,
		/** sound ID for normal notifications (canberra sound theme)
		 * @default "message-new-instant" */
		sound_normal: "message-new-instant",
		/** sound ID for critical notifications (canberra sound theme)
		 * @default "dialog-error" */
		sound_critical: "dialog-error",
	},

	night_light: {
		enabled: true,
		/** color temperature in Kelvin (lower = warmer)
		 * @default 4500 */
		temperature: 4500,
		/** gamma percentage (0-100)
		 * @default 100 */
		gamma: 100,
		/** hour of day (0-23) when night light activates
		 * @default 20 */
		start_hour: 20,
		/** hour of day (0-23) when night light deactivates
		 * @default 7 */
		end_hour: 7,
	},

	wallpaper: {
		/** wallpaper positioning mode (hyprpaper) */
		positioning: "cover" satisfies WallpaperPositioning,
		/** color generation mode.
		 * darken: picks darker colors; lighten: picks brighter colors */
		color_mode: "darken" satisfies WalMode,
		/** whether to enable Hyprland's random splash text pn the wallpaper.
		 * only takes effect after a hyprpaper restart. (`systemctl restart --user hyprpaper`) */
		splash: true,
	},

	theme: {
		/** current theme. "pywal" syncs colors from wallpaper, others are static themes
		 * @default "pywal" */
		current: "pywal" as string,
		/** generate and apply monochrome icon theme from accent color
		 * @default true */
		icon_generation_enabled: true,
		/** icon theme used when monochrome generation is disabled
		 * @default "Novashell-Icons" */
		icon_theme_regular: "Novashell-Icons",
		/** whether to sync colors when wallpaper changes (only applies when theme is "pywal")
		 * @default true */
		sync_with_wallpaper: true,
		/** path to curated wallpapers folder for theme-safe wallpaper selection
		 * @default "~/wallpapers/curated" */
		curated_wallpapers_path: `${GLib.get_home_dir()}/wallpapers/curated`,
	},

	workspaces: {
		/** breaks `enable_helper`, makes all workspaces show their respective ID
		 * by default */
		always_show_id: false,
		/** this is the function that shows the Workspace's IDs
		 * around the current workspace if one breaks the crescent order.
		 * It basically helps keyboard navigation between workspaces.
		 * ---
		 * Example: 1(empty, current, shows ID), 2(empty, does not appear(makes
		 * the previous not to be in a crescent order)), 3(not empty, shows ID) */
		enable_helper: true,
		/** hide workspace indicator if there's only one active workspace */
		hide_if_single: false,
	},

	apps: {
		/** list of app names or .desktop filenames to exclude from app launcher
		 * @example ["Avahi SSH Server Browser", "qt5ct", "electron29"] */
		exclude: [] as string[],
		/** whitelist of app names or .desktop filenames for the runner.
		 * when non-empty, only matching apps appear in the runner.
		 * @example ["Zen Browser", "Ghostty", "Discord"] */
		runner: [] as string[],
		/** WM class → icon name overrides for apps whose icons aren't resolved automatically.
		 * keys are WM class names (from `hyprctl clients`), values are icon names.
		 * @example { "com.github.th_ch.youtube_music": "pear-desktop" } */
		icon_overrides: {} as Record<string, string>,
	},

	clock: {
		/** use the same format as gnu's `date` command
		 * @default "%A %d, %H:%M" // -> "tuesday, 11, 15:44" */
		date_format: "%a %b %-d, %H:%M",
		/** URL to open on right-click (e.g., Google Calendar)
		 * @default "https://calendar.google.com" */
		calendar_url: "https://calendar.google.com",
	},

	misc: {
		/** plays a system-bell sound effect using canberra-gtk-play on volume change
		 * @default true */
		play_bell_on_volume_change: true,
	},
};

const userDataDefaults = {
	/** last default adapter */
	bluetooth_default_adapter: undefined as unknown as string,

	control_center: {
		/** last default backlight */
		default_backlight: undefined as unknown as string,
	},
};

export const userData = new Config<
	keyof typeof userDataDefaults,
	(typeof userDataDefaults)[keyof typeof userDataDefaults]
>(`${GLib.get_user_data_dir()}/novashell/data.json`, userDataDefaults, false);

export const generalConfig = new Config<
	keyof typeof generalConfigDefaults,
	(typeof generalConfigDefaults)[keyof typeof generalConfigDefaults]
>(`${GLib.get_user_config_dir()}/novashell/config.json`, generalConfigDefaults);
