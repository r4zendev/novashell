import type { ColorData, DerivedPalette } from "./types";
import { adjustLightness } from "./utils";

export function derivePalette(data: ColorData): DerivedPalette {
	const bg = data.special.background;
	const fg = data.special.foreground;

	return {
		accent: data.accent || data.colors.color4,
		surface0: adjustLightness(bg, 15),
		surface1: adjustLightness(bg, 25),
		surface2: adjustLightness(bg, 40),
		mantle: adjustLightness(bg, -5),
		crust: adjustLightness(bg, -10),
		overlay0: adjustLightness(fg, -80),
		overlay1: adjustLightness(fg, -65),
		overlay2: adjustLightness(fg, -50),
		subtext0: adjustLightness(fg, -30),
		subtext1: adjustLightness(fg, -15),
	};
}
