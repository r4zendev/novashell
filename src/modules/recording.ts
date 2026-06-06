import Gio from "gi://Gio?version=2.0";
import GLib from "gi://GLib?version=2.0";

import { createRoot, getScope, type Scope } from "ags";
import GObject, { getter, register, signal } from "ags/gobject";
import type { Gdk } from "ags/gtk4";
import { execAsync } from "ags/process";

import { time } from "~/modules/utils";

@register({ GTypeName: "Recording" })
export class Recording extends GObject.Object {
	private static instance: Recording;

	@signal() started() {}
	@signal() stopped() {}

	#recording: boolean = false;
	#path: string = "~/Recordings";
	#recordingScope?: Scope;

	/** Default extension: mp4(h264) */
	#extension: string = "mp4";
	#recordAudio: boolean = false;
	#area: Gdk.Rectangle | null = null;
	#startedAt: number = -1;
	#process: Gio.Subprocess | null = null;
	#output: string | null = null;

	/** GLib.DateTime of when recording started
	 * its value can be `-1` if undefined(no recording is happening) */
	@getter(Number)
	public get startedAt() {
		return this.#startedAt;
	}

	@getter(Boolean)
	public get recording() {
		return this.#recording;
	}
	private set recording(newValue: boolean) {
		!newValue && this.#recording
			? this.stopRecording()
			: this.startRecording(this.#area || undefined);

		this.#recording = newValue;
		this.notify("recording");
	}

	@getter(String)
	public get path() {
		return this.#path;
	}
	public set path(newPath: string) {
		if (this.recording) return;

		this.#path = newPath;
		this.notify("path");
	}

	@getter(String)
	public get extension() {
		return this.#extension;
	}
	public set extension(newExt: string) {
		if (this.recording) return;

		this.#extension = newExt;
		this.notify("extension");
	}

	@getter(String)
	public get recordingTime() {
		if (!this.#recording || !this.#startedAt) return "not recording";

		const startedAtSeconds =
			time.get().to_unix() - Recording.getDefault().startedAt!;
		if (startedAtSeconds <= 0) return "00:00";

		const seconds = Math.floor(startedAtSeconds % 60);
		const minutes = Math.floor(startedAtSeconds / 60);
		const hours = Math.floor(minutes / 60);

		return `${hours > 0 ? `${hours < 10 ? "0" : ""}${hours}` : ""}${minutes < 10 ? `0${minutes}` : minutes}:${seconds < 10 ? `0${seconds}` : seconds}`;
	}

	/** Recording output file name. null if screen is not being recorded */
	public get output() {
		return this.#output;
	}

	/** Currently unsupported property */
	public get recordAudio() {
		return this.#recordAudio;
	}
	public set recordAudio(newValue: boolean) {
		if (this.recording) return;

		this.#recordAudio = newValue;
		this.notify("record-audio");
	}

	constructor() {
		super();
		const videosDir = GLib.get_user_special_dir(
			GLib.UserDirectory.DIRECTORY_VIDEOS,
		);
		if (videosDir) this.#path = `${videosDir}/Recordings`;
	}

	public static getDefault() {
		if (!Recording.instance) Recording.instance = new Recording();

		return Recording.instance;
	}

	public startRecording(area?: Gdk.Rectangle) {
		if (this.#recording)
			throw new Error("Screen Recording is already running!");

		createRoot(() => {
			this.#recordingScope = getScope();

			this.#recording = true;
			this.notify("recording");
			this.emit("started");

			const areaString = area
				? `-g "${area.x},${area.y} ${area.width}x${area.height}"`
				: "";
			const cmd = `frec ${areaString}`;

			this.#process = Gio.Subprocess.new(
				["fish", "-c", cmd],
				Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE,
			);

			this.#process.wait_async(null, () => {
				this.stopRecording();
			});

			this.#startedAt = time.get().to_unix();
			this.notify("started-at");

			const timeSub = time.subscribe(() => {
				this.notify("recording-time");
			});

			this.#recordingScope.onCleanup(timeSub);
		});
	}

	public stopRecording() {
		if (!this.#process || !this.#recording) return;

		execAsync(["killall", "-s", "SIGINT", "wf-recorder"]).catch(() => {
			if (this.#process && !this.#process.get_if_exited())
				execAsync(["kill", "-s", "SIGTERM", this.#process.get_identifier()!]);
		});

		this.#recordingScope?.dispose();

		this.#process = null;
		this.#recording = false;
		this.#startedAt = -1;
		this.#output = null;
		this.notify("recording");
		this.emit("stopped");
	}
}
