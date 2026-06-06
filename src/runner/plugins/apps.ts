import {
	execApp,
	filterRunnerApps,
	getAppIcon,
	getApps,
	queryApps,
	updateApps,
} from "~/modules/apps";
import type { Runner } from "~/runner/Runner";

export const PluginApps = {
	name: "Apps",
	init: async () => updateApps(),
	handle: (text: string, limit?: number) => {
		const apps = filterRunnerApps(
			text.trim()
				? queryApps(text)
				: [...getApps()].sort((a, b) => b.frequency - a.frequency),
		);

		return apps.slice(0, limit).map((app) => ({
			title: app.get_name(),
			description: app.get_description(),
			icon: getAppIcon(app) ?? "application-x-executable-symbolic",
			actionClick: () => execApp(app),
		}));
	},
} as Runner.Plugin;
