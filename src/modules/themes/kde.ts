import GLib from "gi://GLib?version=2.0";

import { writeFileAsync } from "ags/file";

import type { ColorData, DerivedPalette } from "./types";
import { adjustLightness, ensureDirectory } from "./utils";

function hexToRgb(hex: string): string {
	const h = hex.replace(/^#/, "");
	return `${parseInt(h.substring(0, 2), 16)}, ${parseInt(h.substring(2, 4), 16)}, ${parseInt(h.substring(4, 6), 16)}`;
}

export async function updateKdeColorScheme(
	data: ColorData,
	p: DerivedPalette,
): Promise<void> {
	const s = data.special;
	const c = data.colors;

	const bg = hexToRgb(s.background);
	const fg = hexToRgb(s.foreground);
	const accent = hexToRgb(p.accent);
	const surface0 = hexToRgb(p.surface0);
	const surface1 = hexToRgb(p.surface1);
	const mantle = hexToRgb(p.mantle);
	const subtext0 = hexToRgb(p.subtext0);
	const color1 = hexToRgb(c.color1);
	const color2 = hexToRgb(c.color2);
	const color3 = hexToRgb(c.color3);
	const visited = hexToRgb(adjustLightness(p.accent, -30));
	const altBg = hexToRgb(adjustLightness(s.background, 8));
	const viewBg = hexToRgb(adjustLightness(s.background, 5));
	const viewAltBg = hexToRgb(adjustLightness(s.background, 10));
	const buttonBg = hexToRgb(p.surface0);
	const buttonAltBg = hexToRgb(p.surface1);
	const tooltipBg = hexToRgb(p.mantle);
	const tooltipAltBg = hexToRgb(p.crust);

	const scheme = `[ColorEffects:Disabled]
Color=${bg}
ColorAmount=0.3
ColorEffect=2
ContrastAmount=0.1
ContrastEffect=0
IntensityAmount=-1
IntensityEffect=0

[ColorEffects:Inactive]
ChangeSelectionColor=true
Color=${bg}
ColorAmount=0.5
ColorEffect=3
ContrastAmount=0
ContrastEffect=0
Enable=true
IntensityAmount=0
IntensityEffect=0

[Colors:Button]
BackgroundAlternate=${buttonAltBg}
BackgroundNormal=${buttonBg}
DecorationFocus=${accent}
DecorationHover=${surface1}
ForegroundActive=${accent}
ForegroundInactive=${subtext0}
ForegroundLink=${accent}
ForegroundNegative=${color1}
ForegroundNeutral=${color3}
ForegroundNormal=${fg}
ForegroundPositive=${color2}
ForegroundVisited=${visited}

[Colors:Complementary]
BackgroundAlternate=${altBg}
BackgroundNormal=${bg}
DecorationFocus=${accent}
DecorationHover=${surface0}
ForegroundActive=${accent}
ForegroundInactive=${subtext0}
ForegroundLink=${accent}
ForegroundNegative=${color1}
ForegroundNeutral=${color3}
ForegroundNormal=${fg}
ForegroundPositive=${color2}
ForegroundVisited=${visited}

[Colors:Header]
BackgroundAlternate=${mantle}
BackgroundNormal=${bg}
DecorationFocus=${accent}
DecorationHover=${surface0}
ForegroundActive=${accent}
ForegroundInactive=${subtext0}
ForegroundLink=${accent}
ForegroundNegative=${color1}
ForegroundNeutral=${color3}
ForegroundNormal=${fg}
ForegroundPositive=${color2}
ForegroundVisited=${visited}

[Colors:Selection]
BackgroundAlternate=${accent}
BackgroundNormal=${accent}
DecorationFocus=${accent}
DecorationHover=${accent}
ForegroundActive=${accent}
ForegroundInactive=${subtext0}
ForegroundLink=${accent}
ForegroundNegative=${color1}
ForegroundNeutral=${color3}
ForegroundNormal=${bg}
ForegroundPositive=${color2}
ForegroundVisited=${visited}

[Colors:Tooltip]
BackgroundAlternate=${tooltipAltBg}
BackgroundNormal=${tooltipBg}
DecorationFocus=${accent}
DecorationHover=${surface0}
ForegroundActive=${accent}
ForegroundInactive=${subtext0}
ForegroundLink=${accent}
ForegroundNegative=${color1}
ForegroundNeutral=${color3}
ForegroundNormal=${fg}
ForegroundPositive=${color2}
ForegroundVisited=${visited}

[Colors:View]
BackgroundAlternate=${viewAltBg}
BackgroundNormal=${viewBg}
DecorationFocus=${accent}
DecorationHover=${surface0}
ForegroundActive=${accent}
ForegroundInactive=${subtext0}
ForegroundLink=${accent}
ForegroundNegative=${color1}
ForegroundNeutral=${color3}
ForegroundNormal=${fg}
ForegroundPositive=${color2}
ForegroundVisited=${visited}

[Colors:Window]
BackgroundAlternate=${mantle}
BackgroundNormal=${bg}
DecorationFocus=${accent}
DecorationHover=${surface0}
ForegroundActive=${accent}
ForegroundInactive=${subtext0}
ForegroundLink=${accent}
ForegroundNegative=${color1}
ForegroundNeutral=${color3}
ForegroundNormal=${fg}
ForegroundPositive=${color2}
ForegroundVisited=${visited}

[General]
ColorScheme=novashell
Name=novashell

[KDE]
contrast=4

[WM]
activeBackground=${bg}
activeBlend=${fg}
activeForeground=${fg}
inactiveBackground=${mantle}
inactiveBlend=${subtext0}
inactiveForeground=${subtext0}
`;

	const colorSchemesDir = `${GLib.get_user_data_dir()}/color-schemes`;
	ensureDirectory(colorSchemesDir);

	await writeFileAsync(`${colorSchemesDir}/novashell.colors`, scheme).catch(
		(e: Error) => {
			console.error(
				`ColorUtils: Failed to write KDE color scheme: ${e.message}`,
			);
		},
	);
}
