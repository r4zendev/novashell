import { generalConfig } from "~/config";
import type { RemoteCaller } from "~/modules/arg-handler/types";
import { isHelpArg } from "~/modules/arg-handler/utils";
import { playSystemBell } from "~/modules/utils";
import { Wireplumber } from "~/modules/volume";

const volumeHelp = `
Control speaker and microphone volumes
Options:
  (sink|source)-set [number]: set speaker/microphone volume.
  (sink|source)-mute: toggle mute for the speaker/microphone device.
  (sink|source)-increase [number]: increases speaker/microphone volume.
  (sink|source)-decrease [number]: decreases speaker/microphone volume.
`.trim();

function playVolumeBellIfEnabled(): void {
	if (
		generalConfig.getProperty("misc.play_bell_on_volume_change", "boolean") ===
		true
	) {
		playSystemBell();
	}
}

export function handleVolumeArgs(
	cmd: RemoteCaller,
	args: Array<string>,
): number {
	if (!args[1]) {
		cmd.printerr_literal("Error: please specify what to do! see `volume help`");
		return 1;
	}

	if (isHelpArg(args[1])) {
		cmd.print_literal(volumeHelp);
		return 0;
	}

	if (/^(sink|source)-(increase|decrease|set)$/.test(args[1]) && !args[2]) {
		cmd.printerr_literal("Error: you forgot to set a value");
		return 1;
	}

	const [endpoint, action] = args[1].split("-");
	const wireplumber = Wireplumber.getDefault();

	if (action === "mute") {
		if (endpoint === "sink") {
			wireplumber.toggleMuteSink();
			cmd.print_literal("Done toggling mute!");
			return 0;
		}

		if (endpoint === "source") {
			wireplumber.toggleMuteSource();
			cmd.print_literal("Done toggling mute!");
			return 0;
		}
	}

	const value = Number.parseInt(args[2], 10);
	if (Number.isNaN(value)) {
		cmd.printerr_literal(
			`Error: argument "${args[2]}" is not a valid number! Please use integers`,
		);
		return 1;
	}

	switch (action) {
		case "set":
			endpoint === "sink"
				? wireplumber.setSinkVolume(value)
				: wireplumber.setSourceVolume(value);
			cmd.print_literal(`Done! Set ${endpoint} volume to ${args[2]}`);
			return 0;

		case "increase":
			endpoint === "sink"
				? wireplumber.increaseSinkVolume(value)
				: wireplumber.increaseSourceVolume(value);

			playVolumeBellIfEnabled();

			cmd.print_literal(`Done increasing volume by ${args[2]}`);
			return 0;

		case "decrease":
			endpoint === "sink"
				? wireplumber.decreaseSinkVolume(value)
				: wireplumber.decreaseSourceVolume(value);

			playVolumeBellIfEnabled();

			cmd.print_literal(`Done decreasing volume to ${args[2]}`);
			return 0;
	}

	cmd.printerr_literal(
		`Error: couldn't resolve arguments! "${args
			.join(" ")
			.replace(new RegExp(`^${args[0]}`), "")}"`,
	);
	return 1;
}
