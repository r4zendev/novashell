import Gio from "gi://Gio?version=2.0";
import GLib from "gi://GLib?version=2.0";

import { createRoot } from "ags";
import { readFile, writeFileAsync } from "ags/file";
import GObject, {
	getter,
	gtype,
	property,
	register,
	setter,
	signal,
} from "ags/gobject";
import { exec, execAsync } from "ags/process";

import { generalConfig } from "~/config";
import { Notifications } from "~/modules/notifications";
import { derivePalette, updateTelegramTheme } from "~/modules/themes";
import type { WalData } from "~/modules/themes/types";
import { createSubscription } from "~/modules/utils";

export type WalMode = "darken" | "lighten";

type HSL = { h: number; s: number; l: number };

function hexToRgb(hex: string): [number, number, number] {
	return [
		parseInt(hex.slice(1, 3), 16),
		parseInt(hex.slice(3, 5), 16),
		parseInt(hex.slice(5, 7), 16),
	];
}

function rgbToHex(r: number, g: number, b: number): string {
	const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
	return `#${clamp(r).toString(16).padStart(2, "0")}${clamp(g).toString(16).padStart(2, "0")}${clamp(b).toString(16).padStart(2, "0")}`.toUpperCase();
}

function rgbToHsl(r: number, g: number, b: number): HSL {
	r /= 255;
	g /= 255;
	b /= 255;
	const max = Math.max(r, g, b),
		min = Math.min(r, g, b);
	const l = (max + min) / 2;
	if (max === min) return { h: 0, s: 0, l };
	const d = max - min;
	const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
	let h = 0;
	if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
	else if (max === g) h = ((b - r) / d + 2) / 6;
	else h = ((r - g) / d + 4) / 6;
	return { h, s, l };
}

function hslToHex(h: number, s: number, l: number): string {
	if (s === 0) {
		const v = Math.round(l * 255);
		return rgbToHex(v, v, v);
	}
	const hue2rgb = (p: number, q: number, t: number) => {
		if (t < 0) t += 1;
		if (t > 1) t -= 1;
		if (t < 1 / 6) return p + (q - p) * 6 * t;
		if (t < 1 / 2) return q;
		if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
		return p;
	};
	const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
	const p = 2 * l - q;
	return rgbToHex(
		hue2rgb(p, q, h + 1 / 3) * 255,
		hue2rgb(p, q, h) * 255,
		hue2rgb(p, q, h - 1 / 3) * 255,
	);
}

function luminance(hex: string): number {
	const [r, g, b] = hexToRgb(hex);
	return 0.299 * r + 0.587 * g + 0.114 * b;
}

function lightenHex(hex: string, amount: number): string {
	const [r, g, b] = hexToRgb(hex);
	return rgbToHex(
		r + (255 - r) * amount,
		g + (255 - g) * amount,
		b + (255 - b) * amount,
	);
}

function saturateHex(hex: string, amount: number): string {
	const [r, g, b] = hexToRgb(hex);
	const hsl = rgbToHsl(r, g, b);
	return hslToHex(hsl.h, Math.min(1, hsl.s + amount), hsl.l);
}

function blendHex(hex1: string, hex2: string, ratio: number): string {
	const [r1, g1, b1] = hexToRgb(hex1);
	const [r2, g2, b2] = hexToRgb(hex2);
	return rgbToHex(
		r1 * (1 - ratio) + r2 * ratio,
		g1 * (1 - ratio) + g2 * ratio,
		b1 * (1 - ratio) + b2 * ratio,
	);
}

/** Ensure a color is readable against a dark background by enforcing
 *  minimum lightness and saturation in HSL space. */
function ensureReadable(
	hex: string,
	minLightness = 0.5,
	minSaturation = 0.3,
): string {
	const [r, g, b] = hexToRgb(hex);
	const hsl = rgbToHsl(r, g, b);
	const l = Math.max(hsl.l, minLightness);
	const s = hsl.s > 0.05 ? Math.max(hsl.s, minSaturation) : hsl.s;
	return hslToHex(hsl.h, s, l);
}

/** wallpaper tiling mode */
export type WallpaperPositioning = "contain" | "tile" | "cover" | "fill";

@register({ GTypeName: "Wallpaper" })
export class Wallpaper extends GObject.Object {
	private static instance: Wallpaper;
	#wallpaper: string | undefined;
	#splash: boolean = false;
	#wallpapersPath: string;
	#stateMonitor: Gio.FileMonitor | undefined;
	#colorGeneration = 0;

	@getter(Boolean)
	public get splash() {
		return this.#splash;
	}
	public set splash(showSplash: boolean) {
		this.#splash = showSplash;
		this.notify("splash");
	}

	/** current wallpaper's complete path. can be an empty string if undefined */
	@getter(String)
	get wallpaper() {
		return this.#wallpaper ?? "";
	}

	@setter(String)
	set wallpaper(newValue: string) {
		this.setWallpaper(newValue);
	}

	get wallpapersPath() {
		return this.#wallpapersPath;
	}

	@property(gtype<WallpaperPositioning>(String))
	positioning: WallpaperPositioning = "cover";

	@property(gtype<WalMode>(String))
	colorMode: WalMode = "darken";

	@signal() colorsReloaded() {}

	constructor() {
		super();

		this.#wallpapersPath =
			GLib.getenv("WALLPAPERS") ?? `${GLib.get_home_dir()}/wallpapers`;

		this.getWallpaper().then((wall) => {
			if (wall?.trim()) {
				this.#wallpaper = wall.trim();

				const currentTheme = generalConfig.getProperty(
					"theme.current",
					"string",
				);
				if (!currentTheme || currentTheme === "pywal") {
					this.reloadColors();
				}
			}
		});

		// Monitor the DIRECTORY (not the file) for wallpaper state changes.
		// wallpaper-state uses mv (temp+rename) which replaces the file inode,
		// killing any inotify watch on the file itself. Directory watches survive.
		const stateDir = `${GLib.get_home_dir()}/.config/hypr`;
		const stateFilename = ".wallpaper-state";
		let stateDebounce: number | null = null;
		const stateDirFile = Gio.File.new_for_path(stateDir);
		this.#stateMonitor = stateDirFile.monitor_directory(
			Gio.FileMonitorFlags.WATCH_MOVES,
			null,
		);
		const monitor = this.#stateMonitor;
		monitor.connect("changed", (_mon, file, _other, _event) => {
			const path = file.get_path();
			if (!path?.endsWith(stateFilename)) return;
			if (stateDebounce !== null) GLib.source_remove(stateDebounce);
			stateDebounce = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 300, () => {
				stateDebounce = null;
				try {
					const newPath = exec("wallpaper-state get current_image").trim();
					if (
						newPath &&
						newPath !== this.#wallpaper &&
						GLib.file_test(newPath, GLib.FileTest.EXISTS)
					) {
						this.#wallpaper = newPath;
						this.notify("wallpaper");
						if (this.shouldSyncColors()) {
							this.reloadColors();
						} else {
							this.updateTelegramThemeWallpaper(newPath);
						}
					}
				} catch (e) {
					console.warn(`Wallpaper: state file read error: ${e}`);
				}
				return GLib.SOURCE_REMOVE;
			});
		});

		createRoot(() => {
			createSubscription(
				generalConfig.bindProperty("wallpaper.color_mode", "string"),
				() => {
					const mode = generalConfig.getProperty(
						"wallpaper.color_mode",
						"string",
					);

					if (this.colorMode === mode) return;

					if (!mode || (mode !== "darken" && mode !== "lighten")) {
						Notifications.getDefault().sendNotification({
							appName: "novashell",
							summary: "Couldn't update color mode",
							body: 'Invalid mode. Possible values are: "darken" or "lighten"',
							transient: true,
						});
						return;
					}

					this.colorMode = mode as WalMode;
					this.reloadColors();
				},
			);

			createSubscription(
				generalConfig.bindProperty("wallpaper.positioning", "string"),
				() => {
					const positioning = generalConfig.getProperty(
						"wallpaper.positioning",
						"string",
					) as WallpaperPositioning;

					if (this.positioning === positioning) return;

					if (
						!positioning ||
						(positioning !== "contain" &&
							positioning !== "cover" &&
							positioning !== "tile" &&
							positioning !== "fill")
					) {
						Notifications.getDefault().sendNotification({
							appName: "novashell",
							summary: "Couldn't update wallpaper position",
							body: 'Invalid position value. Possible values are: "cover"(default), "contain", "tile" or "fill"',
							transient: true,
						});
						return;
					}

					this.positioning = positioning;
					this.reloadWallpaper().catch((e) => {
						Notifications.getDefault().sendNotification({
							appName: "novashell",
							summary: "Couldn't update wallpaper position",
							body: `An error occurred while updating wallpaper's position: ${e.message}`,
							transient: true,
						});
					});
				},
			);
		});
	}

	public static getDefault(): Wallpaper {
		if (!Wallpaper.instance) Wallpaper.instance = new Wallpaper();

		return Wallpaper.instance;
	}

	private writeState(): void {
		if (!this.#wallpaper) return;

		execAsync(`wallpaper-state set current_image "${this.#wallpaper}"`).catch(
			(e) => {
				console.error(`Wallpaper: couldn't write state: ${e}`);
			},
		);
	}

	public getData(): WalData {
		const cacheDir =
			GLib.getenv("XDG_CACHE_HOME") ?? `${GLib.get_home_dir()}/.cache`;
		const content = readFile(`${cacheDir}/wal/colors.json`);
		return JSON.parse(content) as WalData;
	}

	public async getWallpaper(): Promise<string | undefined> {
		try {
			const path = exec("wallpaper-state get current_image").trim();
			if (path && GLib.file_test(path, GLib.FileTest.EXISTS)) {
				return path;
			}
		} catch {}

		try {
			const output = exec("swww query");
			const match = output.match(/image:\s*(.+)$/m);
			if (match && match[1]) {
				return match[1].trim();
			}
		} catch (e) {
			console.warn(`Wallpaper: Couldn't query swww: ${e}`);
		}

		return undefined;
	}

	public reloadColors(): void {
		if (!this.#wallpaper) {
			console.warn("Wallpaper: No wallpaper set, can't reload colors");
			return;
		}

		const gen = ++this.#colorGeneration;
		const light = this.colorMode === "lighten";
		this.generateColorsFromImage(this.#wallpaper, light)
			.then(async (data) => {
				if (gen !== this.#colorGeneration) return;
				const cacheDir =
					GLib.getenv("XDG_CACHE_HOME") ?? `${GLib.get_home_dir()}/.cache`;
				const walDir = `${cacheDir}/wal`;
				const dirFile = Gio.File.new_for_path(walDir);
				if (!dirFile.query_exists(null)) {
					dirFile.make_directory_with_parents(null);
				}
				await writeFileAsync(
					`${walDir}/colors.json`,
					JSON.stringify(data, null, 4),
				);
				if (gen !== this.#colorGeneration) return;
				this.emit("colors-reloaded");
			})
			.catch((e: Error) => {
				console.error(
					`Wallpaper: Couldn't generate colors: ${e.message}\n${e.stack}`,
				);
			});
	}

	private async generateColorsFromImage(
		imagePath: string,
		light: boolean,
	): Promise<WalData> {
		const output = await execAsync(
			`magick "${imagePath}[0]" -resize 25% -colors 16 -unique-colors txt:-`,
		);

		const hexes: string[] = [];
		for (const line of output.split("\n")) {
			const m = line.match(/#[0-9A-Fa-f]{6}/);
			if (m) hexes.push(m[0].toUpperCase());
		}

		if (hexes.length === 0) {
			throw new Error("No colors extracted from image");
		}

		hexes.sort((a, b) => luminance(a) - luminance(b));

		let bg = light ? hexes[hexes.length - 1] : hexes[0];
		let fg = light ? hexes[0] : hexes[hexes.length - 1];

		if (!light) {
			const [r, g, b] = hexToRgb(bg);
			const hsl = rgbToHsl(r, g, b);
			bg = hslToHex(hsl.h, hsl.s, Math.min(hsl.l, 0.12));
		}

		const pool = hexes.slice(1, -1);
		const step = Math.max(1, pool.length / 6);
		const accents: string[] = [];
		for (let i = 0; i < 6; i++) {
			accents.push(pool[Math.min(Math.round(i * step), pool.length - 1)]);
		}

		while (accents.length < 6) {
			accents.push(accents[accents.length - 1] || fg);
		}

		const readable = accents.map((c) => ensureReadable(saturateHex(c, 0.2)));

		if (!light && luminance(fg) < 180) {
			fg = lightenHex(fg, 0.3);
		}

		const accent = readable[3]; // color4 position = primary accent
		const color8 = blendHex(lightenHex(bg, 0.35), accent, 0.15);
		const color7 = blendHex(lightenHex(bg, 0.75), accent, 0.08);

		return {
			checksum: "",
			wallpaper: imagePath,
			alpha: 100,
			special: { background: bg, foreground: fg, cursor: fg },
			colors: {
				color0: bg,
				color1: readable[0],
				color2: readable[1],
				color3: readable[2],
				color4: readable[3],
				color5: readable[4],
				color6: readable[5],
				color7,
				color8,
				color9: ensureReadable(lightenHex(readable[0], 0.25), 0.6),
				color10: ensureReadable(lightenHex(readable[1], 0.25), 0.6),
				color11: ensureReadable(lightenHex(readable[2], 0.25), 0.6),
				color12: ensureReadable(lightenHex(readable[3], 0.25), 0.6),
				color13: ensureReadable(lightenHex(readable[4], 0.25), 0.6),
				color14: ensureReadable(lightenHex(readable[5], 0.25), 0.6),
				color15: fg,
			},
		};
	}

	public async reloadWallpaper(write: boolean = true): Promise<void> {
		if (!this.#wallpaper?.trim()) return;

		const resizeMap: Record<WallpaperPositioning, string> = {
			cover: "crop",
			contain: "fit",
			fill: "crop",
			tile: "no",
		};
		const resize = resizeMap[this.positioning] ?? "crop";

		await execAsync(
			`swww img "${this.#wallpaper}" --resize ${resize} --transition-type fade --transition-duration 0.3`,
		);

		write && this.writeState();
	}

	/** Check if colors should sync based on theme settings */
	private shouldSyncColors(): boolean {
		const currentTheme = generalConfig.getProperty("theme.current", "string");
		const syncEnabled = generalConfig.getProperty(
			"theme.sync_with_wallpaper",
			"boolean",
		);
		const result = currentTheme === "pywal" && syncEnabled;
		return result;
	}

	private normalizeWallpaperPath(path: string | Gio.File): string {
		return typeof path === "string" ? path : path.peek_path()!;
	}

	private updateTelegramThemeWallpaper(path: string): void {
		let data: WalData;

		try {
			data = this.getData();
		} catch (e) {
			console.warn(
				`Wallpaper: couldn't read current colors for Telegram theme update: ${e}`,
			);
			return;
		}

		const nextData: WalData = {
			...data,
			wallpaper: path,
		};

		updateTelegramTheme(nextData, derivePalette(nextData)).catch((e: Error) => {
			console.error(
				`Wallpaper: couldn't refresh Telegram theme wallpaper: ${e.message}`,
			);
		});
	}

	private applyWallpaperPath(
		path: string | Gio.File,
		write: boolean,
		syncColors: boolean,
	): void {
		const normalizedPath = this.normalizeWallpaperPath(path);

		if (!GLib.file_test(normalizedPath, GLib.FileTest.EXISTS)) {
			console.error("Wallpaper: file does not exist, skipped");
			return;
		}

		const wallpaperChanged = this.#wallpaper !== normalizedPath;
		this.#wallpaper = normalizedPath;
		this.notify("wallpaper");

		this.reloadWallpaper(write)
			.then(() => {
				if (syncColors && wallpaperChanged && this.shouldSyncColors()) {
					this.reloadColors();
				} else if (wallpaperChanged) {
					this.updateTelegramThemeWallpaper(normalizedPath);
				}
			})
			.catch((e: Error) => {
				console.error(
					`Wallpaper: Couldn't set wallpaper. Stderr: ${e.message}`,
				);
			});
	}

	/** Set wallpaper with optional color sync (respects theme settings) */
	public setWallpaper(path: string | Gio.File, write: boolean = true): void {
		this.applyWallpaperPath(path, write, true);
	}

	/** Set wallpaper WITHOUT triggering any color changes (for theme-independent wallpaper selection) */
	public setWallpaperOnly(
		path: string | Gio.File,
		write: boolean = true,
	): void {
		this.applyWallpaperPath(path, write, false);
	}

	/** Manually trigger color sync from current wallpaper (useful when switching to pywal theme) */
	public syncColorsFromWallpaper(): void {
		try {
			const latest = exec("wallpaper-state get current_image").trim();
			if (latest && GLib.file_test(latest, GLib.FileTest.EXISTS)) {
				if (latest !== this.#wallpaper) {
					this.#wallpaper = latest;
					this.notify("wallpaper");
				}
			}
		} catch {}

		if (!this.#wallpaper) {
			console.warn("Wallpaper: No wallpaper set, can't sync colors");
			return;
		}
		this.reloadColors();
	}

	public async pickWallpaper(): Promise<string | undefined> {
		return await execAsync(`zenity --file-selection`)
			.then((wall) => {
				if (!wall.trim()) return undefined;

				this.setWallpaper(wall);
				return wall;
			})
			.catch((e: Error) => {
				console.error(
					`Wallpaper: Couldn't pick wallpaper, is \`zenity\` installed? Stderr: ${e.message}`,
				);
				return undefined;
			});
	}
}
