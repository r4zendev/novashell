import { execAsync } from "ags/process";

import type { Runner } from "~/runner/Runner";

interface Emoticon {
	name: string;
	value: string;
}

const emoticons: Emoticon[] = [
	{ name: "Shrug", value: "¯\\_(ツ)_/¯" },
	{ name: "Disapproval", value: "ಠ_ಠ" },
	{ name: "Table Flip", value: "(╯°□°)╯︵ ┻━┻" },
	{ name: "Lenny", value: "( ͡° ͜ʖ ͡°)" },
	{ name: "Middle Finger", value: "( ° ͜ʖ͡°)╭∩╮" },
];

export const PluginEmoticons = (() => {
	return {
		prefix: ";",
		name: "Emoticons",
		prioritize: true,

		handle: (input) => {
			const search = input.trim().toLowerCase();

			const filtered = search
				? emoticons.filter((e) =>
						e.name.toLowerCase().includes(search),
					)
				: emoticons;

			if (filtered.length === 0)
				return {
					icon: "face-smile-symbolic",
					title: "No matching emoticons",
					description: "Try: shrug, lenny, flip, disapproval",
				};

			return filtered.map((e) => ({
				icon: "face-smile-symbolic",
				title: e.value,
				description: `${e.name} — click to copy`,
				actionClick: () => {
					execAsync(["wl-copy", e.value]).catch(() => {});
				},
			}));
		},
	} as Runner.Plugin;
})();
