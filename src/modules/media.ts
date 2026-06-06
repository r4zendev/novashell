import AstalMpris from "gi://AstalMpris";
import GObject from "gi://GObject?version=2.0";

import { type Accessor, createConnection, getScope, type Scope } from "ags";
import { property, register } from "ags/gobject";

import { createScopedConnection, decoder } from "~/modules/utils";

// Players to prioritize (music players over video)
const PREFERRED_PLAYERS = [
	"com.github.th_ch.youtube_music", // YouTube Music PWA/app
	"YouTube Music",
	"youtube-music",
	"spotify",
	"Spotify",
	"cider",
	"rhythmbox",
	"clementine",
	"elisa",
	"lollypop",
];

@register({ GTypeName: "Media" })
export default class Media extends GObject.Object {
	private static instance: Media;
	public static readonly dummyPlayer = {
		available: false,
		busName: "dummy_player",
		bus_name: "dummy_player",
	} as AstalMpris.Player;

	@property(AstalMpris.Player)
	player: AstalMpris.Player = Media.dummyPlayer;

	constructor(scope: Scope) {
		super();

		scope.run(() => {
			this.selectBestPlayer();

			createScopedConnection(
				AstalMpris.get_default(),
				"player-added",
				(_player) => {
					this.selectBestPlayer();
				},
			);

			createScopedConnection(
				AstalMpris.get_default(),
				"player-closed",
				(_closedPlayer) => {
					this.selectBestPlayer();
				},
			);
		});
	}

	/** Select the best available player based on priority and play state */
	private selectBestPlayer(): void {
		const players = AstalMpris.get_default().players.filter(
			(pl) => pl?.available,
		);

		if (players.length === 0) {
			this.player = Media.dummyPlayer;
			return;
		}

		// First, try to find a playing preferred player
		for (const preferred of PREFERRED_PLAYERS) {
			const match = players.find(
				(p) =>
					p.playbackStatus === AstalMpris.PlaybackStatus.PLAYING &&
					(p.identity?.toLowerCase().includes(preferred.toLowerCase()) ||
						p.busName?.toLowerCase().includes(preferred.toLowerCase())),
			);
			if (match) {
				this.player = match;
				return;
			}
		}

		// Then, try any playing player
		const playing = players.find(
			(p) => p.playbackStatus === AstalMpris.PlaybackStatus.PLAYING,
		);
		if (playing) {
			this.player = playing;
			return;
		}

		// Then, try a paused preferred player
		for (const preferred of PREFERRED_PLAYERS) {
			const match = players.find(
				(p) =>
					p.identity?.toLowerCase().includes(preferred.toLowerCase()) ||
					p.busName?.toLowerCase().includes(preferred.toLowerCase()),
			);
			if (match) {
				this.player = match;
				return;
			}
		}

		// Fallback to first available
		this.player = players[0];
	}

	public static getDefault(): Media {
		if (!Media.instance) Media.instance = new Media(getScope());

		return Media.instance;
	}

	public static accessMediaUrl(
		player: AstalMpris.Player,
	): Accessor<string | undefined> {
		return createConnection(player.get_meta("xesam:url"), [
			player,
			"notify::metadata",
			() => player.get_meta("xesam:url"),
		]).as((url) => {
			const byteString = url?.get_data_as_bytes();

			return byteString ? decoder.decode(byteString.toArray()) : undefined;
		});
	}

	public static getMediaUrl(player: AstalMpris.Player): string | undefined {
		if (!player.available) return;

		const meta = player.get_meta("xesam:url");
		const byteString = meta?.get_data_as_bytes();

		return byteString ? decoder.decode(byteString.toArray()) : undefined;
	}
}
