import { ThemeService } from "~/modules/theme";
import type { Runner } from "~/runner/Runner";

class _PluginThemes implements Runner.Plugin {
	prefix = "@";
	name = "Themes";

	handle(_search: string): Runner.Result[] {
		const themeService = ThemeService.getDefault();
		const currentTheme = themeService.getCurrentTheme();
		const availableThemes = themeService.getAvailableThemes();

		return availableThemes.map((theme) => ({
			title: theme.id === currentTheme ? `${theme.name} (current)` : theme.name,
			description: theme.isPywal
				? "Dynamic colors synced from your wallpaper"
				: `Apply the ${theme.name} color scheme`,
			icon:
				theme.id === currentTheme
					? "object-select-symbolic"
					: "preferences-color-symbolic",
			actionClick: () => {
				if (theme.id !== currentTheme) {
					themeService.applyTheme(theme.id);
				}
			},
		}));
	}
}

export const PluginThemes = new _PluginThemes();
