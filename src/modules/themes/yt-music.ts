import Gio from "gi://Gio?version=2.0";
import GLib from "gi://GLib?version=2.0";

import { writeFileAsync } from "ags/file";

import type { ColorData, DerivedPalette } from "./types";
import { adjustLightness, ensureDirectory } from "./utils";

export async function updateYTMusicTheme(
	data: ColorData,
	p: DerivedPalette,
): Promise<void> {
	const c = data.colors;
	const s = data.special;

	const variables = `html:not(.style-scope)
{
  --ctp-rosewater: ${adjustLightness(c.color1, 50)};
  --ctp-flamingo: ${adjustLightness(c.color1, 30)};
  --ctp-pink: ${adjustLightness(c.color5, 30)};
  --ctp-mauve: ${c.color5};
  --ctp-red: ${c.color1};
  --ctp-maroon: ${adjustLightness(c.color1, 15)};
  --ctp-peach: ${adjustLightness(c.color3, 15)};
  --ctp-yellow: ${c.color3};
  --ctp-green: ${c.color2};
  --ctp-teal: ${c.color6};
  --ctp-sky: ${adjustLightness(c.color6, 15)};
  --ctp-sapphire: ${adjustLightness(c.color4, 15)};
  --ctp-blue: ${p.accent};
  --ctp-lavender: ${adjustLightness(p.accent, 25)};
  --ctp-text: ${s.foreground};
  --ctp-subtext1: ${p.subtext1};
  --ctp-subtext0: ${p.subtext0};
  --ctp-overlay2: ${p.overlay2};
  --ctp-overlay1: ${p.overlay1};
  --ctp-overlay0: ${p.overlay0};
  --ctp-surface2: ${p.surface2};
  --ctp-surface1: ${p.surface1};
  --ctp-surface0: ${p.surface0};
  --ctp-base: ${s.background};
  --ctp-mantle: ${p.mantle};
  --ctp-crust: ${p.crust};

  --ctp-accent: var(--ctp-blue);

  --unthemed-yet: inherit !important;

  --yt-spec-commerce-filled-hover: var(--ctp-accent) !important;
  --yt-spec-menu-background: var(--ctp-base) !important;

  --disabled-text-color: var(--ctp-surface0) !important;

  --ytmusic-scrollbar-width: 0px !important;
  --ytd-scrollbar-width: 0px !important;
}
`;

	let template: string;
	try {
		const bytes = Gio.resources_lookup_data(
			"/io/github/razen/novashell/templates/yt-music.css",
			null,
		);
		template = new TextDecoder().decode(bytes.get_data()!);
	} catch (e) {
		console.error(`ColorUtils: Failed to load YT Music template: ${e}`);
		return;
	}

	const fullCss = variables + template;

	const cacheDir = `${GLib.get_user_cache_dir()}/novashell`;
	ensureDirectory(cacheDir);

	await writeFileAsync(`${cacheDir}/yt-music-theme.css`, fullCss).catch(
		(e: Error) => {
			console.error(`ColorUtils: Failed to write YT Music theme: ${e.message}`);
		},
	);
}
