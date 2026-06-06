import type { RemoteCaller } from "~/modules/arg-handler/types";
import { isHelpArg } from "~/modules/arg-handler/utils";
import { Wallpaper } from "~/modules/wallpaper";

const wallpaperHelp = `Manage wallpaper

Options:
  set <path>: set wallpaper (respects theme settings - syncs colors if pywal mode).
  set-only <path>: set wallpaper WITHOUT changing colors (ignores theme settings).
  current: show current wallpaper path.
  pick: open file picker to select wallpaper.
`.trim();

export function handleWallpaperArgs(
	cmd: RemoteCaller,
	args: Array<string>,
): number {
	if (isHelpArg(args[1]) || !args[1]) {
		cmd.print_literal(wallpaperHelp);
		return 0;
	}

	const wallpaper = Wallpaper.getDefault();

	switch (args[1]) {
		case "set":
			if (!args[2]) {
				cmd.printerr_literal("Error: no wallpaper path specified!");
				return 1;
			}
			wallpaper.setWallpaper(args[2]);
			cmd.print_literal(`Setting wallpaper: ${args[2]}`);
			return 0;

		case "set-only":
			if (!args[2]) {
				cmd.printerr_literal("Error: no wallpaper path specified!");
				return 1;
			}
			wallpaper.setWallpaperOnly(args[2]);
			cmd.print_literal(`Setting wallpaper (no color sync): ${args[2]}`);
			return 0;

		case "current":
			cmd.print_literal(
				`Current wallpaper: ${wallpaper.wallpaper || "(none)"}`,
			);
			return 0;

		case "pick":
			wallpaper.pickWallpaper();
			cmd.print_literal("Opening wallpaper picker...");
			return 0;
	}

	cmd.printerr_literal(
		"Error: unknown wallpaper command. Try 'wallpaper help'.",
	);
	return 1;
}
