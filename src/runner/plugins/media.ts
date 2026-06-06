import AstalMpris from "gi://AstalMpris";

import { createBinding, createComputed } from "ags";

import Media from "~/modules/media";
import { secureBaseBinding } from "~/modules/utils";
import type { Runner } from "~/runner/Runner";

export const PluginMedia = {
	prefix: ":",
	handle: () => {
		const media = Media.getDefault();
		const playerBinding = createBinding(media, "player");

		return !media.player.available
			? {
					icon: "folder-music-symbolic",
					title: "Couldn't find any players",
					closeOnClick: false,
					description: "No media / player found with mpris",
				}
			: [
					{
						icon: secureBaseBinding<AstalMpris.Player>(
							playerBinding,
							"playbackStatus",
							AstalMpris.PlaybackStatus.PAUSED,
						).as((status: AstalMpris.PlaybackStatus) =>
							status === AstalMpris.PlaybackStatus.PLAYING
								? "media-playback-pause-symbolic"
								: "media-playback-start-symbolic",
						),
						closeOnClick: false,
						title: createComputed(
							[
								secureBaseBinding<AstalMpris.Player>(
									playerBinding,
									"title",
									null,
								).as((t: string | null) => t ?? "No title"),
								secureBaseBinding<AstalMpris.Player>(
									playerBinding,
									"artist",
									null,
								).as((t: string | null) => t ?? "No artist"),
								secureBaseBinding<AstalMpris.Player>(
									playerBinding,
									"playbackStatus",
									AstalMpris.PlaybackStatus.PAUSED,
								),
							],
							(title, artist, status) =>
								`${
									status === AstalMpris.PlaybackStatus.PLAYING
										? "Pause"
										: "Play"
								} ${title} | ${artist}`,
						),
						actionClick: () => media.player.play_pause(),
					},
					{
						icon: "media-skip-backward-symbolic",
						closeOnClick: false,
						title: createComputed(
							[
								secureBaseBinding<AstalMpris.Player>(
									playerBinding,
									"title",
									null,
								).as((t: string | null) => t ?? "No title"),
								secureBaseBinding<AstalMpris.Player>(
									playerBinding,
									"artist",
									null,
								).as((t: string | null) => t ?? "No artist"),
								secureBaseBinding<AstalMpris.Player>(
									playerBinding,
									"identity",
									"Music Player",
								),
							],
							(title, artist, identity) =>
								`Go Previous ${title ? title : identity}${artist ? ` | ${artist}` : ""}`,
						),
						actionClick: () =>
							media.player.canGoPrevious && media.player.previous(),
					},
					{
						icon: "media-skip-forward-symbolic",
						closeOnClick: false,
						title: createComputed(
							[
								secureBaseBinding<AstalMpris.Player>(
									playerBinding,
									"title",
									null,
								).as((t: string | null) => t ?? "No title"),
								secureBaseBinding<AstalMpris.Player>(
									playerBinding,
									"artist",
									null,
								).as((t: string | null) => t ?? "No artist"),
								secureBaseBinding<AstalMpris.Player>(
									playerBinding,
									"identity",
									"Music Player",
								),
							],
							(title, artist, identity) =>
								`Go Next ${title ? title : identity}${artist ? ` | ${artist}` : ""}`,
						),
						actionClick: () => media.player.canGoNext && media.player.next(),
					},
				];
	},
} as Runner.Plugin;
