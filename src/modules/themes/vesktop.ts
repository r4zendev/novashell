import GLib from "gi://GLib?version=2.0";

import { writeFileAsync } from "ags/file";

import type { ColorData, DerivedPalette } from "./types";
import { adjustLightness, ensureDirectory } from "./utils";

export async function updateVesktopTheme(
	data: ColorData,
	p: DerivedPalette,
): Promise<void> {
	const c = data.colors;
	const s = data.special;

	const baseLow = adjustLightness(s.background, -3);
	const channelDefault = adjustLightness(p.subtext0, -5);
	const sky = adjustLightness(c.color6, 15);

	const vars = `
  --background-primary: ${s.background} !important;
  --background-secondary: ${p.mantle} !important;
  --background-secondary-alt: ${baseLow} !important;
  --background-tertiary: ${p.crust} !important;
  --background-floating: ${p.mantle} !important;
  --background-modifier-hover: ${p.overlay2}15 !important;
  --background-modifier-active: ${p.overlay2}25 !important;
  --background-modifier-selected: ${p.overlay0}30 !important;
  --background-modifier-accent: ${p.surface2}30 !important;
  --background-accent: ${p.surface1} !important;
  --background-message-hover: ${p.crust}30 !important;
  --channeltextarea-background: ${p.mantle} !important;
  --background-base-lowest: ${p.crust} !important;
  --background-base-lower: ${p.mantle} !important;
  --background-base-low: ${baseLow} !important;
  --bg-surface-raised: ${p.mantle} !important;
  --background-surface-highest: ${p.surface0} !important;
  --background-surface-higher: ${adjustLightness(p.surface0, -3)} !important;
  --background-surface-high: ${s.background} !important;
  --background-gradient-highest: ${baseLow} !important;
  --home-background: ${s.background} !important;
  --app-frame-background: ${adjustLightness(p.crust, -2)} !important;
  --chat-background: ${s.background} !important;
  --chat-background-default: ${s.background} !important;
  --chat-border: ${p.crust} !important;
  --chat-text-muted: ${p.subtext0} !important;
  --text-default: ${s.foreground} !important;
  --text-normal: ${s.foreground} !important;
  --text-muted: ${p.subtext0} !important;
  --text-link: ${p.accent} !important;
  --text-positive: ${c.color2} !important;
  --text-warning: ${c.color3} !important;
  --text-danger: ${c.color1} !important;
  --text-brand: ${p.accent} !important;
  --text-strong: ${s.foreground} !important;
  --text-subtle: ${p.subtext1} !important;
  --interactive-normal: ${p.subtext1} !important;
  --interactive-hover: ${s.foreground} !important;
  --interactive-active: ${s.foreground} !important;
  --interactive-muted: ${p.overlay0} !important;
  --interactive-icon-default: ${s.foreground} !important;
  --interactive-icon-hover: ${s.foreground} !important;
  --interactive-icon-active: ${s.foreground} !important;
  --interactive-text-default: ${s.foreground} !important;
  --interactive-text-hover: ${s.foreground} !important;
  --interactive-text-active: ${s.foreground} !important;
  --interactive-background-hover: ${p.overlay2}15 !important;
  --interactive-background-selected: ${p.overlay0}20 !important;
  --interactive-background-active: ${s.foreground}17 !important;
  --header-primary: ${s.foreground} !important;
  --header-secondary: ${p.subtext0} !important;
  --brand-100: ${adjustLightness(p.accent, 90)} !important;
  --brand-130: ${adjustLightness(p.accent, 80)} !important;
  --brand-160: ${adjustLightness(p.accent, 70)} !important;
  --brand-200: ${adjustLightness(p.accent, 60)} !important;
  --brand-230: ${adjustLightness(p.accent, 50)} !important;
  --brand-260: ${adjustLightness(p.accent, 40)} !important;
  --brand-300: ${adjustLightness(p.accent, 30)} !important;
  --brand-330: ${adjustLightness(p.accent, 20)} !important;
  --brand-360: ${adjustLightness(p.accent, 15)} !important;
  --brand-400: ${adjustLightness(p.accent, 10)} !important;
  --brand-430: ${adjustLightness(p.accent, 5)} !important;
  --brand-460: ${adjustLightness(p.accent, 2)} !important;
  --brand-500: ${p.accent} !important;
  --brand-530: ${adjustLightness(p.accent, -5)} !important;
  --brand-560: ${adjustLightness(p.accent, -10)} !important;
  --brand-600: ${adjustLightness(p.accent, -15)} !important;
  --brand-630: ${adjustLightness(p.accent, -20)} !important;
  --brand-660: ${adjustLightness(p.accent, -25)} !important;
  --brand-700: ${adjustLightness(p.accent, -30)} !important;
  --brand-730: ${adjustLightness(p.accent, -35)} !important;
  --brand-760: ${adjustLightness(p.accent, -40)} !important;
  --brand-800: ${adjustLightness(p.accent, -45)} !important;
  --brand-830: ${adjustLightness(p.accent, -50)} !important;
  --brand-860: ${adjustLightness(p.accent, -55)} !important;
  --brand-900: ${adjustLightness(p.accent, -60)} !important;
  --brand-experiment: ${p.accent} !important;
  --brand-experiment-560: ${adjustLightness(p.accent, -10)} !important;
  --brand-experiment-600: ${adjustLightness(p.accent, -15)} !important;
  --blurple-50: ${p.accent} !important;
  --blurple-60: ${adjustLightness(p.accent, -10)} !important;
  --channels-default: ${channelDefault} !important;
  --channel-icon: ${channelDefault} !important;
  --channel-text-area-placeholder: ${s.foreground}80 !important;
  --icon-muted: ${channelDefault} !important;
  --icon-default: ${s.foreground} !important;
  --icon-strong: ${s.foreground} !important;
  --icon-subtle: ${p.subtext1} !important;
  --icon-voice-muted: ${c.color1} !important;
  --border-muted: ${p.surface0} !important;
  --border-strong: ${p.mantle} !important;
  --border-normal: ${p.crust} !important;
  --border-subtle: ${s.background} !important;
  --background-mod-muted: ${p.surface2}0d !important;
  --background-mod-normal: ${p.surface2}26 !important;
  --background-mod-subtle: ${p.surface2}40 !important;
  --background-mod-strong: ${p.surface2}73 !important;
  --background-code: ${s.background} !important;
  --input-background: ${p.crust} !important;
  --input-background-default: ${p.crust} !important;
  --input-text-default: ${s.foreground} !important;
  --input-placeholder-text: ${p.subtext0} !important;
  --input-placeholder-text-default: ${p.subtext1} !important;
  --input-border-default: ${p.overlay0} !important;
  --checkbox-icon-active: ${p.crust} !important;
  --checkbox-border-default: ${p.overlay0} !important;
  --radio-thumb-background-active: ${p.crust} !important;
  --textbox-markdown-syntax: ${p.overlay0} !important;
  --spoiler-revealed-background: ${p.surface0} !important;
  --spoiler-hidden-background: ${p.surface2} !important;
  --scrollbar-thin-thumb: ${p.accent} !important;
  --scrollbar-thin-track: transparent !important;
  --scrollbar-auto-thumb: ${p.accent} !important;
  --scrollbar-auto-track: ${p.crust} !important;
  --scrollbar-auto-scrollbar-color-thumb: ${p.accent} !important;
  --scrollbar-auto-scrollbar-color-track: ${p.crust} !important;
  --control-brand-foreground: ${p.accent} !important;
  --control-brand-foreground-new: ${p.accent} !important;
  --control-primary-background-default: ${p.accent} !important;
  --control-primary-background-hover: ${adjustLightness(p.accent, -8)} !important;
  --control-primary-background-active: ${adjustLightness(p.accent, -13)} !important;
  --control-secondary-background-default: ${p.surface1} !important;
  --control-secondary-background-hover: ${adjustLightness(p.surface1, -5)} !important;
  --control-secondary-background-active: ${adjustLightness(p.surface1, -8)} !important;
  --control-secondary-border-default: ${p.surface0} !important;
  --control-secondary-text-default: ${s.foreground} !important;
  --control-secondary-text-hover: ${s.foreground} !important;
  --control-critical-primary-background-default: ${c.color1} !important;
  --control-critical-primary-background-hover: ${adjustLightness(c.color1, -5)} !important;
  --control-critical-primary-text-default: ${s.background} !important;
  --control-connected-background-default: ${c.color2} !important;
  --button-outline-primary-text: ${s.foreground} !important;
  --button-outline-brand-text: ${s.foreground} !important;
  --mention-foreground: ${p.accent} !important;
  --mention-background: ${p.accent}30 !important;
  --message-reacted-background-default: ${p.accent}30 !important;
  --message-reacted-text-default: ${p.accent} !important;
  --message-mentioned-background-default: ${c.color3}10 !important;
  --message-mentioned-background-hover: ${c.color3}08 !important;
  --message-highlight-background-default: ${p.accent}0d !important;
  --message-highlight-background-hover: ${p.accent}0a !important;
  --status-positive: ${c.color2} !important;
  --status-positive-background: ${c.color2} !important;
  --status-positive-text: ${s.background} !important;
  --status-warning: ${c.color3} !important;
  --status-warning-background: ${c.color3} !important;
  --status-warning-text: ${s.background} !important;
  --status-danger: ${c.color1} !important;
  --text-status-online: ${c.color2} !important;
  --text-status-idle: ${c.color3} !important;
  --text-status-dnd: ${c.color1} !important;
  --text-status-offline: ${p.subtext1} !important;
  --icon-status-online: ${c.color2} !important;
  --icon-status-idle: ${c.color3} !important;
  --icon-status-dnd: ${c.color1} !important;
  --icon-status-offline: ${p.subtext1} !important;
  --text-feedback-positive: ${c.color2} !important;
  --text-feedback-critical: ${c.color1} !important;
  --text-feedback-warning: ${c.color3} !important;
  --text-feedback-info: ${c.color4} !important;
  --background-feedback-positive: ${c.color2}15 !important;
  --background-feedback-critical: ${c.color1}15 !important;
  --background-feedback-warning: ${c.color3}15 !important;
  --background-feedback-info: ${sky}15 !important;
  --background-feedback-notification: ${c.color1} !important;
  --badge-notification-background: ${c.color1} !important;
  --badge-text-brand: ${s.background} !important;
  --icon-feedback-positive: ${c.color2} !important;
  --icon-feedback-warning: ${c.color3} !important;
  --icon-feedback-critical: ${c.color1} !important;
  --icon-feedback-info: ${sky} !important;
  --icon-feedback-notification: ${c.color1} !important;
  --notice-background-critical: ${c.color1} !important;
  --notice-background-info: ${c.color4} !important;
  --notice-background-positive: ${c.color2} !important;
  --notice-background-warning: ${c.color3} !important;
  --notice-text-critical: ${p.crust} !important;
  --notice-text-info: ${p.crust} !important;
  --notice-text-positive: ${p.crust} !important;
  --notice-text-warning: ${p.crust} !important;
  --modal-background: ${s.background} !important;
  --modal-footer-background: ${s.background} !important;
  --card-background-default: ${p.surface0} !important;
  --custom-channel-members-bg: ${p.mantle} !important;
  --custom-status-bubble-background: ${p.crust} !important;
  --custom-status-bubble-background-color: ${p.mantle} !important;
  --logo-primary: ${s.foreground} !important;
  --white: ${s.foreground} !important;
  --white-500: ${s.foreground} !important;
  --black-500: ${p.crust} !important;
  --primary-100: ${p.subtext1} !important;
  --primary-200: ${p.subtext0} !important;
  --primary-300: ${p.subtext1} !important;
  --primary-400: ${p.subtext1} !important;
  --primary-630: ${p.surface0} !important;
  --primary-700: ${p.surface1} !important;
  --primary-800: ${p.crust} !important;
  --green-360: ${c.color2} !important;
  --green-300: ${c.color2} !important;
  --yellow-360: ${c.color3} !important;
  --yellow-300: ${c.color3} !important;
  --red-400: ${c.color1} !important;
  --red-430: ${adjustLightness(c.color1, -10)} !important;
  --red-500: ${adjustLightness(c.color1, -15)} !important;
  --blue-500: ${adjustLightness(c.color4, -10)} !important;
  --blue-530: ${adjustLightness(c.color4, -15)} !important;
  --plum-23: ${s.background} !important;
  --user-profile-overlay-background: ${p.mantle} !important;
  --user-profile-overlay-background-hover: ${p.surface0} !important;
  --__header-bar-background: ${p.mantle} !important;
  --__adaptive-focus-ring-color: ${p.accent} !important;`;

	const css = `/* Generated by novashell */
.visual-refresh.theme-dark,
.visual-refresh .theme-dark {
${vars}
}

.theme-dark {
${vars}
}
`;

	const vesktopDir = `${GLib.get_user_config_dir()}/vesktop/settings`;
	ensureDirectory(vesktopDir);

	await writeFileAsync(`${vesktopDir}/quickCss.css`, css).catch((e: Error) => {
		console.error(`ColorUtils: Failed to write Vesktop theme: ${e.message}`);
	});
}
