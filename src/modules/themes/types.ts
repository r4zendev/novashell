export type ColorData = {
	name?: string;
	wallpaper?: string;
	accent?: string;
	special: {
		background: string;
		foreground: string;
		cursor: string;
	};
	colors: {
		color0: string;
		color1: string;
		color2: string;
		color3: string;
		color4: string;
		color5: string;
		color6: string;
		color7: string;
		color8: string;
		color9: string;
		color10: string;
		color11: string;
		color12: string;
		color13: string;
		color14: string;
		color15: string;
	};
};

export type WalData = ColorData & {
	checksum: string;
	wallpaper: string;
	alpha: number;
};

export type ThemeData = WalData & {
	name: string;
};

export type DerivedPalette = {
	accent: string;
	surface0: string;
	surface1: string;
	surface2: string;
	mantle: string;
	crust: string;
	overlay0: string;
	overlay1: string;
	overlay2: string;
	subtext0: string;
	subtext1: string;
};
