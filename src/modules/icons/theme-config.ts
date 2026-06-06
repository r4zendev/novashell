import GLib from "gi://GLib?version=2.0";

export const NOVASHELL_ICON_THEME_NAME = "Novashell-Mono";

export const ICON_THEME_SOURCE_CANDIDATES = [
	"Papirus-Dark",
	"Papirus",
	"Novashell-Icons",
];

export const ICON_THEME_OVERLAY_SOURCE = "Novashell-Icons";

export const ICON_THEME_META_FILE = ".novashell-icon-meta.json";

export const ICON_THEME_LOCK_DIR = ".novashell-mono.lock";

export const SYSTEM_ICON_DIR = "/usr/share/icons";

export const SCRIPT_RESOURCE_PREFIX = "/io/github/razen/novashell/scripts";

export const SCRIPT_CACHE_DIR = `${GLib.get_user_cache_dir()}/novashell/scripts`;

export const SCRIPT_ALIASES = {
	recolor: "icons-recolor.py",
	overlayApps: "icons-overlay-apps.py",
	overlayCategories: "icons-overlay-categories.py",
} as const;
