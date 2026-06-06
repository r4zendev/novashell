import type AstalIO from "gi://AstalIO";
import Gio from "gi://Gio?version=2.0";
import GLib from "gi://GLib?version=2.0";

import { monitorFile, readFile } from "ags/file";
import GObject, { getter, register, signal } from "ags/gobject";
import { execAsync } from "ags/process";
import { timeout } from "ags/time";

export enum ClipboardItemType {
	TEXT = 0,
	IMAGE = 1,
}

export class ClipboardItem {
	id: number;
	type: ClipboardItemType;
	preview: string;

	constructor(id: number, type: ClipboardItemType, preview: string) {
		this.id = id;
		this.type = type;
		this.preview = preview;
	}
}

export { Clipboard };

/** Cliphist Manager and event listener
 * This only supports wipe and store events from cliphist */
@register({ GTypeName: "Clipboard" })
class Clipboard extends GObject.Object {
	private static instance: Clipboard;

	declare $signals: GObject.Object.SignalSignatures & {
		copied: Clipboard["copied"];
		wiped: Clipboard["wiped"];
	};

	#dbFile: Gio.File;
	#dbMonitor: Gio.FileMonitor | null = null;
	#updateDone: boolean = false;
	#history = [] as ClipboardItem[];
	#changesTimeout: AstalIO.Time | undefined;
	#ignoreChanges: boolean = false;

	@signal(GObject.TYPE_JSOBJECT) copied(_item: object) {}
	@signal() wiped() {}

	@getter(Array)
	public get history() {
		return this.#history;
	}

	constructor() {
		super();

		this.#dbFile = this.getCliphistDatabase();

		this.#dbMonitor = monitorFile(this.#dbFile.get_path()!, () => {
			if (this.#ignoreChanges || this.#changesTimeout) return;

			this.#changesTimeout = timeout(300, () => {
				this.#changesTimeout = undefined;
			});

			if (this.#updateDone) {
				this.updateDatabase();
				return;
			}

			this.init();
		});

		if (this.#dbFile.query_exists(null)) {
			this.init();
			return;
		}

		console.warn("Clipboard: cliphist database not found");
	}

	vfunc_dispose(): void {
		if (this.#dbMonitor) {
			this.#dbMonitor.cancel();
			this.#dbMonitor = null;
		}

		super.vfunc_dispose();
	}

	private init() {
		this.updateDatabase()
			.then(() => {})
			.catch((err) =>
				console.error(
					`Clipboard: An error occurred while reading cliphist history. Stderr: ${err}`,
				),
			);
	}

	public async copyAsync(content: string): Promise<boolean> {
		const proc = Gio.Subprocess.new(
			["wl-copy", content],
			Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE,
		);

		const stderr = Gio.DataInputStream.new(proc.get_stderr_pipe()!);

		if (!proc.wait_check(null)) {
			try {
				const [err] = stderr.read_upto("\x00", -1);
				console.error(
					`Clipboard: An error occurred while copying text. Stderr: ${err}`,
				);
			} catch (_) {
				console.error(`Clipboard: An error occurred while copying text and shell couldn't read \
stderr for more info.`);
			}
		}

		return proc.get_exit_status() === 0;
	}

	public async selectItem(
		itemToSelect: number | ClipboardItem,
	): Promise<boolean> {
		const id =
			typeof itemToSelect === "number" ? itemToSelect : itemToSelect.id;

		const proc = Gio.Subprocess.new(
			["sh", "-c", `cliphist decode ${id} | wl-copy`],
			Gio.SubprocessFlags.STDERR_PIPE,
		);

		const stderr = Gio.DataInputStream.new(proc.get_stderr_pipe()!);

		if (!proc.wait_check(null)) {
			try {
				const [err] = stderr.read_upto("\x00", -1);
				console.error(
					`Clipboard: An error occurred while selecting history item. Stderr: ${err}`,
				);
			} catch (_) {
				console.error(
					"Clipboard: An error occurred while selecting history item and stderr couldn't be read.",
				);
			}
		}

		return proc.get_exit_status() === 0;
	}

	/** Gets history item's content by its ID.
	 * @returns the clipboard item's content */
	public async getItemContent(
		item: number | ClipboardItem,
	): Promise<string | undefined> {
		const id = typeof item === "number" ? item : item.id;

		const cmd = Gio.Subprocess.new(
			["cliphist", "decode", id.toString()],
			Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE,
		);

		const [, stdout, stderr] = cmd.communicate_utf8(null, null);

		if (stderr) {
			console.error(
				`Clipboard: An error occurred while getting item content. Stderr:\n${stderr}`,
			);
			return;
		}

		return stdout;
	}

	/** Searches for the cliphist database file
	 * Will not work if cliphist config file is not on default path */
	private getCliphistDatabase(): Gio.File {
		// Check if env variable is set
		const path = GLib.getenv("CLIPHIST_DB_PATH");
		if (path != null) return Gio.File.new_for_path(path);

		// Check config file
		const confFile = Gio.File.new_for_path(
			`${GLib.get_user_config_dir()}/cliphist/config`,
		);
		if (confFile.query_exists(null)) {
			const cliphistConf = readFile(confFile.get_path()!);
			for (const line of cliphistConf.split("\n").map((l) => l.trim())) {
				if (line.startsWith("#")) continue;

				const [key, value] = line.split(/\s+/, 2);
				if (key === "db-path") {
					return Gio.File.new_for_path(value.trimStart());
				}
			}
		}

		// return default path if none of the above matches
		return Gio.File.new_for_path(`${GLib.get_user_cache_dir()}/cliphist/db`);
	}

	private getContentType(preview: string): ClipboardItemType {
		return /^\[\[\s*binary data\b.*\]\]$/u.test(preview)
			? ClipboardItemType.IMAGE
			: ClipboardItemType.TEXT;
	}

	private parseHistoryItem(item: string): ClipboardItem | undefined {
		if (!item) return;

		const separatorIndex = item.indexOf("\t");
		if (separatorIndex < 0) return;

		const id = Number.parseInt(item.slice(0, separatorIndex), 10);
		if (Number.isNaN(id)) return;

		const preview = item.slice(separatorIndex + 1);

		return {
			id,
			preview,
			type: this.getContentType(preview),
		} as ClipboardItem;
	}

	public async wipeHistory(noExec?: boolean): Promise<void> {
		if (noExec) {
			this.#history = [];
			this.emit("wiped");
			return;
		}

		this.#ignoreChanges = true;
		await execAsync("cliphist wipe")
			.then(() => {
				this.#history = [];
				this.emit("wiped");
			})
			.catch((err: Gio.IOErrorEnum) =>
				console.error(
					`Clipboard: An error occurred on cliphist database wipe. Stderr: ${
						err.message ? `${err.message}\n` : ""
					}${err.stack}`,
				),
			)
			.finally(() => {
				this.#ignoreChanges = false;
			});
	}

	public async updateDatabase(): Promise<void> {
		const proc = Gio.Subprocess.new(
			["cliphist", "list"],
			Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE,
		);

		proc.communicate_utf8_async(null, null, (_, asyncRes) => {
			const [success, stdout, stderr] = proc.communicate_utf8_finish(asyncRes);

			if (!success || stderr) {
				console.error(
					"Clipboard: Couldn't communicate with cliphist! Is it installed?",
				);
				return;
			}

			if (!stdout.trim()) {
				this.wipeHistory(true);
				this.notify("history");
				return;
			}

			const previousIds = new Set(this.#history.map((item) => item.id));
			const nextHistory = stdout
				.split("\n")
				.map((item) => this.parseHistoryItem(item))
				.filter((item): item is ClipboardItem => item !== undefined);

			this.#history = nextHistory;
			this.notify("history");

			if (this.#updateDone) {
				for (const item of nextHistory) {
					if (previousIds.has(item.id)) break;

					this.emit("copied", item);
				}
				return;
			}

			this.#updateDone = true;
		});
	}

	public static getDefault(): Clipboard {
		if (!Clipboard.instance) Clipboard.instance = new Clipboard();

		return Clipboard.instance;
	}
}
