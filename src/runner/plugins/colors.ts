import { execAsync } from "ags/process";

import type { Runner } from "~/runner/Runner";

type RGBA = [number, number, number, number];

// --- Utility ---
function clamp01(v: number): number {
	return Math.max(0, Math.min(1, v));
}

function round(v: number, decimals: number): number {
	const f = 10 ** decimals;
	return Math.round(v * f) / f;
}

// --- Parsing ---
function parseHex(s: string): RGBA | null {
	const m = s.match(/^(?:#|0x)?([0-9a-f]{3,8})$/i);
	if (!m) return null;
	const hex = m[1];
	let r: number,
		g: number,
		b: number,
		a = 1;

	if (hex.length === 3) {
		r = parseInt(hex[0] + hex[0], 16) / 255;
		g = parseInt(hex[1] + hex[1], 16) / 255;
		b = parseInt(hex[2] + hex[2], 16) / 255;
	} else if (hex.length === 4) {
		r = parseInt(hex[0] + hex[0], 16) / 255;
		g = parseInt(hex[1] + hex[1], 16) / 255;
		b = parseInt(hex[2] + hex[2], 16) / 255;
		a = parseInt(hex[3] + hex[3], 16) / 255;
	} else if (hex.length === 6) {
		r = parseInt(hex.substring(0, 2), 16) / 255;
		g = parseInt(hex.substring(2, 4), 16) / 255;
		b = parseInt(hex.substring(4, 6), 16) / 255;
	} else if (hex.length === 8) {
		r = parseInt(hex.substring(0, 2), 16) / 255;
		g = parseInt(hex.substring(2, 4), 16) / 255;
		b = parseInt(hex.substring(4, 6), 16) / 255;
		a = parseInt(hex.substring(6, 8), 16) / 255;
	} else {
		return null;
	}

	return [r, g, b, a];
}

function parseFnArgs(raw: string): number[] {
	return raw
		.split(/[\s,/]+/)
		.filter(Boolean)
		.map((v) => {
			if (v === "none") return 0;
			if (v.endsWith("%")) return parseFloat(v) / 100;
			if (v.endsWith("deg")) return parseFloat(v);
			if (v.endsWith("rad")) return (parseFloat(v) * 180) / Math.PI;
			if (v.endsWith("turn")) return parseFloat(v) * 360;
			if (v.endsWith("grad")) return parseFloat(v) * 0.9;
			return parseFloat(v);
		});
}

function parseColor(input: string): RGBA | null {
	input = input.trim();

	const hex = parseHex(input);
	if (hex) return hex;

	const m = input.match(/^(\w[\w-]*)\(\s*(.+?)\s*\)$/);
	if (!m) return null;

	const fn = m[1].toLowerCase();
	const args = parseFnArgs(m[2]);
	if (args.some(isNaN)) return null;

	switch (fn) {
		case "rgb":
		case "rgba": {
			let [r, g, b] = args;
			const a = args[3] ?? 1;
			if (r > 1 || g > 1 || b > 1) {
				r /= 255;
				g /= 255;
				b /= 255;
			}
			return [clamp01(r), clamp01(g), clamp01(b), clamp01(a)];
		}
		case "hsl":
		case "hsla": {
			const [h, s, l] = args;
			const a = args[3] ?? 1;
			return [...hslToRgb(h, s, l), clamp01(a)] as RGBA;
		}
		case "hsv":
		case "hsb": {
			const [h, s, v] = args;
			const a = args[3] ?? 1;
			return [...hsvToRgb(h, s, v), clamp01(a)] as RGBA;
		}
		case "hwb": {
			const [h, w, bl] = args;
			const a = args[3] ?? 1;
			return [...hwbToRgb(h, w, bl), clamp01(a)] as RGBA;
		}
		case "oklch": {
			const [l, c, h] = args;
			const a = args[3] ?? 1;
			return [...oklchToRgb(l, c, h), clamp01(a)] as RGBA;
		}
		case "oklab": {
			const [l, ab, bb] = args;
			const a = args[3] ?? 1;
			return [...oklabToRgb(l, ab, bb), clamp01(a)] as RGBA;
		}
		case "cmyk":
		case "device-cmyk": {
			const [c, m_, y, k] = args;
			return [
				clamp01((1 - c) * (1 - k)),
				clamp01((1 - m_) * (1 - k)),
				clamp01((1 - y) * (1 - k)),
				1,
			];
		}
		default:
			return null;
	}
}

// --- Conversions TO RGB ---
function hslToRgb(h: number, s: number, l: number): [number, number, number] {
	h = ((h % 360) + 360) % 360;
	const c = (1 - Math.abs(2 * l - 1)) * s;
	const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
	const m = l - c / 2;
	let r = 0,
		g = 0,
		b = 0;
	if (h < 60) {
		r = c;
		g = x;
	} else if (h < 120) {
		r = x;
		g = c;
	} else if (h < 180) {
		g = c;
		b = x;
	} else if (h < 240) {
		g = x;
		b = c;
	} else if (h < 300) {
		r = x;
		b = c;
	} else {
		r = c;
		b = x;
	}
	return [clamp01(r + m), clamp01(g + m), clamp01(b + m)];
}

function hsvToRgb(h: number, s: number, v: number): [number, number, number] {
	h = ((h % 360) + 360) % 360;
	const c = v * s;
	const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
	const m = v - c;
	let r = 0,
		g = 0,
		b = 0;
	if (h < 60) {
		r = c;
		g = x;
	} else if (h < 120) {
		r = x;
		g = c;
	} else if (h < 180) {
		g = c;
		b = x;
	} else if (h < 240) {
		g = x;
		b = c;
	} else if (h < 300) {
		r = x;
		b = c;
	} else {
		r = c;
		b = x;
	}
	return [clamp01(r + m), clamp01(g + m), clamp01(b + m)];
}

function hwbToRgb(h: number, w: number, bl: number): [number, number, number] {
	if (w + bl >= 1) {
		const gray = w / (w + bl);
		return [gray, gray, gray];
	}
	return hsvToRgb(h, 1 - w / (1 - bl), 1 - bl);
}

function oklabToRgb(L: number, a: number, b: number): [number, number, number] {
	const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
	const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
	const s_ = L - 0.0894841775 * a - 1.291485548 * b;

	const l = l_ * l_ * l_;
	const m = m_ * m_ * m_;
	const s = s_ * s_ * s_;

	const r = +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
	const g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
	const bl = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;

	return [
		clamp01(delinearize(r)),
		clamp01(delinearize(g)),
		clamp01(delinearize(bl)),
	];
}

function oklchToRgb(L: number, C: number, H: number): [number, number, number] {
	const hRad = (H * Math.PI) / 180;
	return oklabToRgb(L, C * Math.cos(hRad), C * Math.sin(hRad));
}

// --- Conversions FROM RGB ---
function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
	const max = Math.max(r, g, b),
		min = Math.min(r, g, b);
	const l = (max + min) / 2;
	if (max === min) return [0, 0, l];
	const d = max - min;
	const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
	let h = 0;
	if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
	else if (max === g) h = ((b - r) / d + 2) / 6;
	else h = ((r - g) / d + 4) / 6;
	return [round(h * 360, 1), round(s, 3), round(l, 3)];
}

function rgbToHsv(r: number, g: number, b: number): [number, number, number] {
	const max = Math.max(r, g, b),
		min = Math.min(r, g, b);
	const d = max - min;
	const v = max;
	const s = max === 0 ? 0 : d / max;
	let h = 0;
	if (d !== 0) {
		if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
		else if (max === g) h = ((b - r) / d + 2) / 6;
		else h = ((r - g) / d + 4) / 6;
	}
	return [round(h * 360, 1), round(s, 3), round(v, 3)];
}

function rgbToHwb(r: number, g: number, b: number): [number, number, number] {
	const [h] = rgbToHsv(r, g, b);
	return [h, round(Math.min(r, g, b), 3), round(1 - Math.max(r, g, b), 3)];
}

function rgbToCmyk(
	r: number,
	g: number,
	b: number,
): [number, number, number, number] {
	const k = 1 - Math.max(r, g, b);
	if (k === 1) return [0, 0, 0, 1];
	return [
		round((1 - r - k) / (1 - k), 3),
		round((1 - g - k) / (1 - k), 3),
		round((1 - b - k) / (1 - k), 3),
		round(k, 3),
	];
}

function linearize(c: number): number {
	return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function delinearize(c: number): number {
	return c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055;
}

function rgbToOklab(r: number, g: number, b: number): [number, number, number] {
	const lr = linearize(r),
		lg = linearize(g),
		lb = linearize(b);
	const l_ = Math.cbrt(
		0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb,
	);
	const m_ = Math.cbrt(
		0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb,
	);
	const s_ = Math.cbrt(
		0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb,
	);
	return [
		round(0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_, 4),
		round(1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_, 4),
		round(0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_, 4),
	];
}

function rgbToOklch(r: number, g: number, b: number): [number, number, number] {
	const [L, a, b_] = rgbToOklab(r, g, b);
	const C = Math.sqrt(a * a + b_ * b_);
	let H = (Math.atan2(b_, a) * 180) / Math.PI;
	if (H < 0) H += 360;
	return [L, round(C, 4), round(H, 1)];
}

// --- Formatting ---
function fmtHex(r: number, g: number, b: number, a: number): string {
	const hex = (v: number) =>
		Math.round(v * 255)
			.toString(16)
			.padStart(2, "0");
	const base = `#${hex(r)}${hex(g)}${hex(b)}`;
	return a < 1 ? `${base}${hex(a)}` : base;
}

function fmtRgb(r: number, g: number, b: number, a: number): string {
	const r8 = Math.round(r * 255),
		g8 = Math.round(g * 255),
		b8 = Math.round(b * 255);
	return a < 1
		? `rgba(${r8}, ${g8}, ${b8}, ${round(a, 2)})`
		: `rgb(${r8}, ${g8}, ${b8})`;
}

function fmtHsl(r: number, g: number, b: number, a: number): string {
	const [h, s, l] = rgbToHsl(r, g, b);
	const body = `${h}, ${round(s * 100, 1)}%, ${round(l * 100, 1)}%`;
	return a < 1 ? `hsla(${body}, ${round(a, 2)})` : `hsl(${body})`;
}

function fmtHsv(r: number, g: number, b: number): string {
	const [h, s, v] = rgbToHsv(r, g, b);
	return `hsv(${h}, ${round(s * 100, 1)}%, ${round(v * 100, 1)}%)`;
}

function fmtHwb(r: number, g: number, b: number, a: number): string {
	const [h, w, bl] = rgbToHwb(r, g, b);
	const body = `${h} ${round(w * 100, 1)}% ${round(bl * 100, 1)}%`;
	return a < 1 ? `hwb(${body} / ${round(a, 2)})` : `hwb(${body})`;
}

function fmtOklch(r: number, g: number, b: number, a: number): string {
	const [L, C, H] = rgbToOklch(r, g, b);
	const body = `${L} ${C} ${H}`;
	return a < 1 ? `oklch(${body} / ${round(a, 2)})` : `oklch(${body})`;
}

function fmtOklab(r: number, g: number, b: number, a: number): string {
	const [L, a_, b_] = rgbToOklab(r, g, b);
	const body = `${L} ${a_} ${b_}`;
	return a < 1 ? `oklab(${body} / ${round(a, 2)})` : `oklab(${body})`;
}

function fmtCmyk(r: number, g: number, b: number): string {
	const [c, m, y, k] = rgbToCmyk(r, g, b);
	return `cmyk(${round(c * 100, 1)}%, ${round(m * 100, 1)}%, ${round(y * 100, 1)}%, ${round(k * 100, 1)}%)`;
}

// --- Plugin ---
export const PluginColors = (() => {
	return {
		prefix: "~",
		name: "Colors",
		prioritize: true,

		handle: (input) => {
			input = input.trim();
			if (!input)
				return {
					icon: "preferences-color-symbolic",
					title: "Enter a color value",
					description: "Supports hex, rgb, hsl, hsv, hwb, oklch, oklab, cmyk",
				};

			const rgba = parseColor(input);
			if (!rgba)
				return {
					icon: "dialog-error-symbolic",
					title: "Couldn't parse color",
					description:
						"Try: #ff5500, rgb(255 85 0), hsl(20 100% 50%), oklch(0.7 0.15 50)",
				};

			const [r, g, b, a] = rgba;
			const formats = [
				{ label: "HEX", value: fmtHex(r, g, b, a) },
				{ label: "RGB", value: fmtRgb(r, g, b, a) },
				{ label: "HSL", value: fmtHsl(r, g, b, a) },
				{ label: "OKLCH", value: fmtOklch(r, g, b, a) },
				{ label: "OKLAB", value: fmtOklab(r, g, b, a) },
				{ label: "HWB", value: fmtHwb(r, g, b, a) },
				{ label: "HSV", value: fmtHsv(r, g, b) },
				{ label: "CMYK", value: fmtCmyk(r, g, b) },
			];

			return formats.map((f) => ({
				icon: "preferences-color-symbolic",
				title: f.value,
				description: `${f.label} — click to copy`,
				actionClick: () => {
					execAsync(["wl-copy", f.value]).catch(() => {});
				},
			}));
		},
	} as Runner.Plugin;
})();
