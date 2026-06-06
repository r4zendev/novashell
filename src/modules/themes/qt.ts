import Gio from "gi://Gio?version=2.0";
import GLib from "gi://GLib?version=2.0";

import { writeFileAsync } from "ags/file";

import type { ColorData, DerivedPalette } from "./types";
import { adjustLightness, ensureDirectory, stripHash } from "./utils";

export async function updateQtColors(
	data: ColorData,
	p: DerivedPalette,
): Promise<void> {
	const s = data.special;
	const c = data.colors;

	const toArgb = (hex: string) => `#ff${stripHash(hex)}`;
	const toArgbAlpha = (hex: string, alpha: string) =>
		`#${alpha}${stripHash(hex)}`;

	const buttonBg = adjustLightness(c.color0, 10);
	const light = adjustLightness(c.color0, 51);
	const midlight = adjustLightness(c.color0, 26);
	const dark = adjustLightness(s.background, -20);
	const altBase = adjustLightness(s.background, 8);

	const activeLine = [
		toArgb(s.foreground),
		toArgb(buttonBg),
		toArgb(light),
		toArgb(midlight),
		toArgb(dark),
		toArgb(c.color8),
		toArgb(s.foreground),
		toArgb(s.foreground),
		toArgb(s.foreground),
		toArgb(s.background),
		toArgb(s.background),
		"#ff000000",
		toArgb(p.accent),
		toArgb(s.foreground),
		toArgb(p.accent),
		toArgb(c.color5),
		toArgb(altBase),
		toArgb(c.color0),
		toArgb(s.foreground),
		toArgbAlpha(c.color8, "80"),
		toArgb(p.accent),
		toArgb(s.foreground),
	].join(", ");

	const inactiveLine = [
		toArgbAlpha(s.foreground, "bf"),
		toArgb(buttonBg),
		toArgb(light),
		toArgb(midlight),
		toArgb(dark),
		toArgb(c.color8),
		toArgbAlpha(s.foreground, "bf"),
		toArgb(s.foreground),
		toArgbAlpha(s.foreground, "bf"),
		toArgb(s.background),
		toArgb(s.background),
		"#ff000000",
		toArgb(adjustLightness(p.accent, -30)),
		toArgbAlpha(s.foreground, "bf"),
		toArgb(p.accent),
		toArgb(c.color5),
		toArgb(altBase),
		toArgb(c.color0),
		toArgb(s.foreground),
		toArgbAlpha(c.color8, "80"),
		toArgb(adjustLightness(p.accent, -30)),
		toArgb(s.foreground),
	].join(", ");

	const disabledLine = [
		toArgbAlpha(s.foreground, "80"),
		toArgb(adjustLightness(buttonBg, -10)),
		toArgb(light),
		toArgb(midlight),
		toArgb(dark),
		toArgb(c.color8),
		toArgbAlpha(s.foreground, "80"),
		toArgb(s.foreground),
		toArgbAlpha(s.foreground, "80"),
		toArgb(s.background),
		toArgb(s.background),
		"#ff000000",
		toArgb(adjustLightness(s.background, 10)),
		toArgbAlpha(s.foreground, "80"),
		toArgb(adjustLightness(p.accent, -40)),
		toArgb(adjustLightness(c.color5, -40)),
		toArgb(altBase),
		toArgb(c.color0),
		toArgb(s.foreground),
		toArgbAlpha(c.color8, "80"),
		toArgb(adjustLightness(s.background, 10)),
		toArgb(s.foreground),
	].join(", ");

	const colorScheme = `[ColorScheme]
active_colors=${activeLine}
inactive_colors=${inactiveLine}
disabled_colors=${disabledLine}
`;

	const colorsDir = `${GLib.get_user_config_dir()}/qt6ct/colors`;
	ensureDirectory(colorsDir);

	const schemePath = `${colorsDir}/pywal.conf`;
	await writeFileAsync(schemePath, colorScheme).catch((e: Error) => {
		console.error(
			`ColorUtils: Failed to write qt6ct color scheme: ${e.message}`,
		);
	});

	const qt6ctDir = `${GLib.get_user_config_dir()}/qt6ct`;
	ensureDirectory(qt6ctDir);
	const qt6ctConfPath = `${qt6ctDir}/qt6ct.conf`;
	const qt6ctConfFile = Gio.File.new_for_path(qt6ctConfPath);
	if (!qt6ctConfFile.query_exists(null)) {
		const conf = `[Appearance]
color_scheme_path=${schemePath}
custom_palette=true
standard_dialogs=xdgdesktopportal
style=Fusion

[Troubleshooting]
force_raster_widgets=1
`;
		await writeFileAsync(qt6ctConfPath, conf).catch((e: Error) => {
			console.error(`ColorUtils: Failed to create qt6ct.conf: ${e.message}`);
		});
		return;
	}

	try {
		const [ok, contents] = qt6ctConfFile.load_contents(null);
		if (ok) {
			let conf = new TextDecoder().decode(contents);
			conf = conf.replace(
				/^color_scheme_path=.*$/m,
				`color_scheme_path=${schemePath}`,
			);
			if (!conf.includes("custom_palette=true")) {
				conf = conf.replace(
					/^\[Appearance\]$/m,
					"[Appearance]\ncustom_palette=true",
				);
			}
			await writeFileAsync(qt6ctConfPath, conf);
		}
	} catch (e) {
		console.error(`ColorUtils: Failed to update qt6ct.conf: ${e}`);
	}
}
