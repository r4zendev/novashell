import { lookupIcon } from "./resolver";

export function resolveStatusIconName(icon: string, fallback: string): string {
	const candidate = icon.trim();
	if (candidate && lookupIcon(candidate)) return candidate;

	const base = candidate
		.replace(/-panel$/i, "")
		.replace(/-symbolic$/i, "")
		.trim();
	const variants = [
		`${base}-symbolic`,
		`${base}-panel`,
		`${base}-panel-symbolic`,
		base,
	];

	for (const variant of variants) {
		if (variant && lookupIcon(variant)) return variant;
	}

	return fallback;
}

export function resolveVolumeStatusIcon(icon: string, source: boolean): string {
	if (source && /^microphone-sensitivity-(high|medium|low)/.test(icon)) {
		if (lookupIcon("audio-input-microphone-symbolic")) {
			return "audio-input-microphone-symbolic";
		}
		if (lookupIcon("audio-input-microphone")) return "audio-input-microphone";
	}

	const fallback = source
		? "microphone-sensitivity-muted-symbolic"
		: "audio-volume-muted-symbolic";

	return resolveStatusIconName(icon, fallback);
}

export function resolveNetworkIcon(icon: string, fallback: string): string {
	const candidate = icon.trim();

	if (
		/wireless|wifi/i.test(candidate) &&
		lookupIcon("network-wireless-symbolic")
	) {
		return "network-wireless-symbolic";
	}

	if (
		/wired|ethernet/i.test(candidate) &&
		lookupIcon("network-wired-symbolic")
	) {
		return "network-wired-symbolic";
	}

	if (
		/no-route|offline|disconnected|unavailable/i.test(candidate) &&
		lookupIcon("network-no-route-symbolic")
	) {
		return "network-no-route-symbolic";
	}

	if (/acquiring|connecting|receive|transmit/i.test(candidate)) {
		if (lookupIcon("network-transmit-receive-symbolic")) {
			return "network-transmit-receive-symbolic";
		}
	}

	return resolveStatusIconName(candidate, fallback);
}
