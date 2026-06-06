import AstalMpris from "gi://AstalMpris";

import type { RemoteCaller } from "~/modules/arg-handler/types";
import { isHelpArg } from "~/modules/arg-handler/utils";
import Media from "~/modules/media";

const mediaHelp = `Manage novashell's active player

Options:
  play: resume/start active player's media.
  pause: pause the active player.
  play-pause: toggle play/pause on active player.
  stop: stop the active player's media.
  previous: go back to previous media if player supports it.
  next: jump to next media if player supports it.
  bus-name: get active player's mpris bus name.
  list: show available players with their bus name.
  select bus_name: change the active player, where bus_name is
    the desired player's mpris bus name(without the mediaplayer2 prefix).
`.trim();

function getPlaybackStatusName(player: AstalMpris.Player): string {
	switch (player.playbackStatus) {
		case AstalMpris.PlaybackStatus.PAUSED:
			return "paused";
		case AstalMpris.PlaybackStatus.PLAYING:
			return "playing";
		default:
			return "stopped";
	}
}

export function handleMediaArgs(
	cmd: RemoteCaller,
	args: Array<string>,
): number {
	if (isHelpArg(args[1])) {
		cmd.print_literal(mediaHelp);
		return 0;
	}

	const media = Media.getDefault();
	const activePlayer = media.player.available ? media.player : undefined;
	const players = AstalMpris.get_default().players.filter((pl) => pl.available);

	if (!activePlayer) {
		cmd.printerr_literal(
			"Error: no active player found! try playing some media first",
		);
		return 1;
	}

	switch (args[1]) {
		case "play":
			activePlayer.play();
			cmd.print_literal("Playing");
			return 0;

		case "list":
			cmd.print_literal(
				`Available players:\n${players
					.map((pl) => `  ${pl.busName}: ${getPlaybackStatusName(pl)}`)
					.join("\n")}`,
			);
			return 0;

		case "pause":
			activePlayer.pause();
			cmd.print_literal("Paused");
			return 0;

		case "play-pause":
			activePlayer.play_pause();
			cmd.print_literal(
				activePlayer.playbackStatus === AstalMpris.PlaybackStatus.PAUSED
					? "Toggled play"
					: "Toggled pause",
			);
			return 0;

		case "stop":
			activePlayer.stop();
			cmd.print_literal("Stopped!");
			return 0;

		case "previous":
			activePlayer.canGoPrevious && activePlayer.previous();
			cmd.print_literal(
				activePlayer.canGoPrevious
					? "Back to previous"
					: "Player does not support this command",
			);
			return 0;

		case "next":
			activePlayer.canGoNext && activePlayer.next();
			cmd.print_literal(
				activePlayer.canGoNext
					? "Jump to next"
					: "Player does not support this command",
			);
			return 0;

		case "bus-name":
			cmd.print_literal(activePlayer.busName);
			return 0;

		case "select": {
			const selected = players.find((pl) => pl.busName === args[2]);
			if (!args[2] || !selected) {
				cmd.printerr_literal(
					"Error: either no player was specified or the player with specified bus name does not exist/is not available!",
				);
				return 1;
			}

			media.player = selected;
			cmd.print_literal(`Done setting player to \`${args[2]}\`!`);
			return 0;
		}
	}

	cmd.printerr_literal(
		"Error: couldn't handle media arguments, try checking `media help`",
	);
	return 1;
}
