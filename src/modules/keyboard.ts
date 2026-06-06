import AstalHyprland from "gi://AstalHyprland";

import { createState } from "ags";
import { execAsync } from "ags/process";

const LANG_MAP: Record<string, string> = {
	English: "EN",
	Russian: "RU",
	Ukrainian: "UA",
};

function formatLang(lang: string): string {
	for (const [key, value] of Object.entries(LANG_MAP)) {
		if (lang.toLowerCase().includes(key.toLowerCase())) return value;
	}
	return lang.slice(0, 2).toUpperCase();
}

function fullLangName(short: string): string {
	for (const [key, value] of Object.entries(LANG_MAP)) {
		if (value === short) return key;
	}
	return short;
}

const [keyboardLayout, setKeyboardLayout] = createState("??");

// Fetch initial layout
execAsync([
	"bash",
	"-c",
	"hyprctl devices -j | jq -r '.keyboards[0].active_keymap'",
])
	.then((output) => setKeyboardLayout(formatLang(output.trim())))
	.catch(() => {});

// React to layout changes instantly
AstalHyprland.get_default().connect(
	"keyboard-layout",
	(_, _keyboard, layout) => {
		setKeyboardLayout(formatLang(layout));
	},
);

export function switchToNextLayout() {
	execAsync(["hyprctl", "switchxkblayout", "all", "next"]).catch(() => {});
}

export { keyboardLayout, fullLangName };
