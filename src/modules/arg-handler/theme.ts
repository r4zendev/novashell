import type { RemoteCaller } from "~/modules/arg-handler/types";
import { isHelpArg } from "~/modules/arg-handler/utils";
import { ThemeService } from "~/modules/theme";
import { Wallpaper } from "~/modules/wallpaper";

const themeHelp = `Manage novashell themes

Options:
  list: show available themes.
  current: show current theme.
  set <theme_id>: apply a theme (e.g., "pywal", "catppuccin-mocha", "tokyo-night").
  sync: manually sync colors from current wallpaper (only works in pywal mode).
`.trim();

export function handleThemeArgs(
	cmd: RemoteCaller,
	args: Array<string>,
): number {
	if (isHelpArg(args[1]) || !args[1]) {
		cmd.print_literal(themeHelp);
		return 0;
	}

	const themeService = ThemeService.getDefault();

	switch (args[1]) {
		case "list": {
			const themes = themeService.getAvailableThemes();
			const current = themeService.getCurrentTheme();
			cmd.print_literal(
				`Available themes:\n${themes
					.map(
						(t) =>
							`  ${t.id}${t.id === current ? " (current)" : ""}: ${t.name}${t.isPywal ? " [syncs with wallpaper]" : ""}`,
					)
					.join("\n")}`,
			);
			return 0;
		}

		case "current":
			cmd.print_literal(`Current theme: ${themeService.getCurrentTheme()}`);
			return 0;

		case "set":
			if (!args[2]) {
				cmd.printerr_literal(
					"Error: no theme specified! Use 'theme list' to see available themes.",
				);
				return 1;
			}
			themeService.applyTheme(args[2]);
			cmd.print_literal(`Applying theme: ${args[2]}`);
			return 0;

		case "sync":
			if (!themeService.isPywalMode()) {
				cmd.printerr_literal(
					"Error: sync only works when theme is set to 'pywal'. Use 'theme set pywal' first.",
				);
				return 1;
			}
			Wallpaper.getDefault().syncColorsFromWallpaper();
			cmd.print_literal("Syncing colors from current wallpaper...");
			return 0;
	}

	cmd.printerr_literal("Error: unknown theme command. Try 'theme help'.");
	return 1;
}
