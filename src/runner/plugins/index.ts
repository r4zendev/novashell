import { PluginApps } from "~/runner/plugins/apps";
import { PluginClipboard } from "~/runner/plugins/clipboard";
import { PluginColors } from "~/runner/plugins/colors";
import { PluginEmoticons } from "~/runner/plugins/emoticons";
import { PluginKill } from "~/runner/plugins/kill";
import { PluginMedia } from "~/runner/plugins/media";
import { PluginShell } from "~/runner/plugins/shell";
import { PluginThemes } from "~/runner/plugins/themes";
import { PluginWallpapers } from "~/runner/plugins/wallpapers";
import { PluginWebSearch } from "~/runner/plugins/websearch";
import type { Runner } from "~/runner/Runner";

export const defaultRunnerPlugins: Array<Runner.Plugin> = [
	PluginApps,
	PluginShell,
	PluginWebSearch,
	PluginKill,
	PluginMedia,
	PluginWallpapers,
	PluginClipboard,
	PluginThemes,
	PluginColors,
	PluginEmoticons,
];

export {
	PluginApps,
	PluginWebSearch,
	PluginClipboard,
	PluginShell,
	PluginMedia,
	PluginWallpapers,
	PluginKill,
	PluginThemes,
	PluginColors,
	PluginEmoticons,
};
