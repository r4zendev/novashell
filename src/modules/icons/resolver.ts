import type AstalApps from "gi://AstalApps";

import { Gdk, Gtk } from "ags/gtk4";

import { generalConfig } from "~/config";
import { getAppsByName } from "~/modules/apps-registry";

export type ResolvedIcon = { name: string; symbolic: boolean };

const iconLookupCache = new Map<string, boolean>();
let cacheThemeName = "";

const builtInOverrides: Record<string, string> = {
	"org.telegram.desktop": "telegram-desktop",
	telegram: "telegram-desktop",
	telegramdesktop: "telegram-desktop",
	helium: "helium-browser",
};

const forcedRegularIconAliases: Record<string, string> = {
	ghostty: "com.mitchellh.ghostty",
	"com.mitchellh.ghostty": "com.mitchellh.ghostty",
};

function getDesktopId(app: AstalApps.Application): string {
	const withDesktopId = app as AstalApps.Application & {
		get_desktop_id?: () => string | null;
	};

	if (typeof withDesktopId.get_desktop_id === "function") {
		return withDesktopId.get_desktop_id() ?? "";
	}

	return "";
}

function normalizeOverrideKey(value: string): string {
	return value
		.trim()
		.toLowerCase()
		.replace(/\.desktop$/i, "")
		.replace(/-/g, "_");
}

function buildOverrideAliases(value: string): Set<string> {
	const normalized = normalizeOverrideKey(value);
	const aliases = new Set<string>([normalized]);

	for (const token of normalized.split(/[._\s]+/g)) {
		if (token) aliases.add(token);
	}

	return aliases;
}

function resolveForcedRegularIcon(
	candidates: Array<string | null | undefined>,
): string | undefined {
	for (const candidate of candidates) {
		if (!candidate) continue;
		for (const alias of buildOverrideAliases(candidate)) {
			const forced = forcedRegularIconAliases[alias];
			if (forced && lookupIcon(forced)) return forced;
		}
	}

	return undefined;
}

function findConfiguredOverrideIcon(
	candidates: Array<string | null | undefined>,
): string | undefined {
	const aliases = new Set<string>();
	for (const candidate of candidates) {
		if (!candidate) continue;
		for (const alias of buildOverrideAliases(candidate)) aliases.add(alias);
	}

	if (aliases.size === 0) return undefined;

	const overrides = generalConfig.getProperty(
		"apps.icon_overrides",
		"object",
	) as Record<string, string> | null;

	if (overrides) {
		for (const [key, value] of Object.entries(overrides)) {
			if (!aliases.has(normalizeOverrideKey(key))) continue;
			if (lookupIcon(value)) return value;
		}
	}

	for (const [key, value] of Object.entries(builtInOverrides)) {
		if (!aliases.has(normalizeOverrideKey(key))) continue;
		if (lookupIcon(value)) return value;
	}

	return undefined;
}

function shouldSkipSymbolic(
	app: string | AstalApps.Application,
	iconName: string,
): boolean {
	const candidates: string[] = [iconName];

	if (typeof app === "string") {
		candidates.push(app);
	} else {
		candidates.push(app.wmClass ?? "", getDesktopId(app), app.name ?? "");
	}

	return resolveForcedRegularIcon(candidates) !== undefined;
}

function refreshLookupCacheIfThemeChanged(): void {
	const display = Gdk.Display.get_default();
	if (!display) return;

	const iconTheme = Gtk.IconTheme.get_for_display(display);
	const themeName = iconTheme.get_theme_name() ?? "";
	if (themeName === cacheThemeName) return;

	cacheThemeName = themeName;
	iconLookupCache.clear();
}

export function invalidateIconLookupCache(): void {
	cacheThemeName = "";
	iconLookupCache.clear();
}

export function lookupIcon(name: string): boolean {
	if (!name.trim()) return false;

	refreshLookupCacheIfThemeChanged();
	const key = `${cacheThemeName}::${name}`;
	if (iconLookupCache.has(key)) {
		return iconLookupCache.get(key) ?? false;
	}

	const display = Gdk.Display.get_default();
	if (!display) return false;

	const hasIcon = Gtk.IconTheme.get_for_display(display)?.has_icon(name);
	iconLookupCache.set(key, Boolean(hasIcon));

	return Boolean(hasIcon);
}

export function getIconByAppName(appName: string): string | undefined {
	if (!appName) return undefined;

	const forced = resolveForcedRegularIcon([appName]);
	if (forced) return forced;

	const override = findConfiguredOverrideIcon([appName]);
	if (override) return override;

	if (lookupIcon(appName)) return appName;

	if (lookupIcon(appName.toLowerCase())) return appName.toLowerCase();

	const nameReverseDNS = appName.split(".");
	const lastItem = nameReverseDNS[nameReverseDNS.length - 1];
	const lastPretty = `${lastItem.charAt(0).toUpperCase()}${lastItem.substring(
		1,
		lastItem.length,
	)}`;

	const uppercaseRDNS = nameReverseDNS
		.slice(0, nameReverseDNS.length - 1)
		.concat(lastPretty)
		.join(".");

	if (lookupIcon(uppercaseRDNS)) return uppercaseRDNS;

	if (lookupIcon(nameReverseDNS[nameReverseDNS.length - 1])) {
		return nameReverseDNS[nameReverseDNS.length - 1];
	}

	const found = getAppsByName(appName)?.[0];
	if (found) return found.iconName;

	return undefined;
}

export function getAppIcon(
	app: string | AstalApps.Application,
): string | undefined {
	if (!app) return undefined;

	if (typeof app === "string") return getIconByAppName(app);

	const forced = resolveForcedRegularIcon([
		app.wmClass,
		app.iconName,
		app.name,
		getDesktopId(app),
	]);
	if (forced) return forced;

	const override = findConfiguredOverrideIcon([
		app.wmClass,
		getDesktopId(app),
		app.iconName,
		app.name,
	]);
	if (override) return override;

	if (app.iconName && lookupIcon(app.iconName)) return app.iconName;
	if (app.wmClass) return getIconByAppName(app.wmClass);

	return getIconByAppName(app.name);
}

export function getSymbolicIcon(
	app: string | AstalApps.Application,
): string | undefined {
	const icon = getAppIcon(app);
	if (!icon || shouldSkipSymbolic(app, icon)) return undefined;

	return lookupIcon(`${icon}-symbolic`) ? `${icon}-symbolic` : undefined;
}

export function resolveIcon(
	app: string | AstalApps.Application,
	fallback = "application-x-executable-symbolic",
): ResolvedIcon {
	const forced =
		typeof app === "string"
			? resolveForcedRegularIcon([app])
			: resolveForcedRegularIcon([
					app.wmClass,
					app.iconName,
					app.name,
					getDesktopId(app),
				]);
	if (forced) return { name: forced, symbolic: false };

	const symbolic = getSymbolicIcon(app);
	if (symbolic) return { name: symbolic, symbolic: true };

	const regular = getAppIcon(app);
	if (regular) return { name: regular, symbolic: false };

	return { name: fallback, symbolic: fallback.endsWith("-symbolic") };
}

export function resolveIconFromClasses(
	className?: string | null,
	initialClass?: string | null,
	fallback = "application-x-executable-symbolic",
): ResolvedIcon {
	const normalize = (value?: string | null) => (value ?? "").trim();
	const cls = normalize(className);
	const init = normalize(initialClass);

	const forced = resolveForcedRegularIcon([cls, init]);
	if (forced) return { name: forced, symbolic: false };

	if (cls) {
		const resolved = resolveIcon(cls, fallback);
		if (resolved.name !== fallback) return resolved;
	}

	if (init) return resolveIcon(init, fallback);

	return resolveIcon(cls || init, fallback);
}
