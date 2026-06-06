import AstalHyprland from "gi://AstalHyprland";

import type { Runner } from "~/runner/Runner";

const engine = "https://google.com/search?q=";

export const PluginWebSearch = {
	prefix: "?",
	name: "Web Search",
	prioritize: true,

	handle: (search) => ({
		icon: "system-search-symbolic",
		title: search || "Type your search...",
		description: `Search the Web`,
		actionClick: () =>
			AstalHyprland.get_default().dispatch(
				"exec",
				`xdg-open "${engine + search}"`,
			),
	}),
} as Runner.Plugin;
