import { type Astal, Gtk } from "ags/gtk4";
import { execAsync } from "ags/process";
import { createPoll } from "ags/time";

import { getSymbolicIcon } from "~/modules/apps";

export {
	construct,
	createScopedConnection,
	createSecureAccessorBinding as secureBaseBinding,
	createSecureBinding as secureBinding,
	createSubscription,
	toBoolean as variableToBoolean,
	transformWidget,
} from "~/lib/gnim-utils";

import Gio from "gi://Gio?version=2.0";
import GLib from "gi://GLib?version=2.0";

export const decoder = new TextDecoder("utf-8"),
	encoder = new TextEncoder();
export const time = createPoll(GLib.DateTime.new_now_local(), 500, () =>
	GLib.DateTime.new_now_local(),
);

export function getPlayerIconFromBusName(busName: string): string {
	const splitName = busName
		.split(".")
		.filter((str) => str !== "" && !str.toLowerCase().includes("instance"));

	return getSymbolicIcon(splitName[splitName.length - 1])
		? getSymbolicIcon(splitName[splitName.length - 1])!
		: "folder-music-symbolic";
}

export function escapeUnintendedMarkup(input: string): string {
	return input.replace(/<[^>]*>|[<>&"]/g, (s) => {
		if (s.startsWith("<") && s.endsWith(">")) return s;

		switch (s) {
			case "<":
				return "&lt;";
			case ">":
				return "&gt;";
			case "&":
				return "&amp;";
			case '"':
				return "&quot;";
		}

		return s;
	});
}

export function omitObjectKeys<ObjT = object>(
	obj: ObjT,
	keys: keyof ObjT | Array<keyof ObjT>,
): object {
	const finalObject = { ...obj };

	for (const objKey of Object.keys(finalObject as object)) {
		if (!Array.isArray(keys)) {
			if (objKey === keys) {
				delete finalObject[keys as keyof typeof finalObject];
				break;
			}

			continue;
		}

		for (const omitKey of keys) {
			if (objKey === omitKey) {
				delete finalObject[objKey as keyof typeof finalObject];
				break;
			}
		}
	}

	return finalObject as object;
}

export function pathToURI(path: string): string {
	switch (true) {
		case /^[/]/.test(path):
			return `file://${path}`;

		case /^[~]/.test(path):
		case /^file:\/\/[~]/i.test(path):
			return `file://${GLib.get_home_dir()}/${path.replace(/^(file:\/\/|[~]|file:\/\[~])/i, "")}`;
	}

	return path;
}

export function playSystemBell(): void {
	execAsync("canberra-gtk-play -i bell").catch((e: Error) => {
		console.error(
			`Couldn't play system bell. Stderr: ${e.message}\n${e.stack}`,
		);
	});
}

export function isInstalled(commandName: string): boolean {
	const proc = Gio.Subprocess.new(
		["bash", "-c", `command -v ${commandName}`],
		Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE,
	);

	const [, stdout, stderr] = proc.communicate_utf8(null, null);
	if (stdout && !stderr) return true;

	return false;
}

export function addSliderMarksFromMinMax(
	slider: Astal.Slider,
	amountOfMarks: number = 2,
	markup?: string | null,
) {
	if (markup && !markup.includes("{}")) markup = `${markup}{}`;

	slider.add_mark(
		slider.min,
		Gtk.PositionType.BOTTOM,
		markup ? markup.replaceAll("{}", `${slider.min}`) : null,
	);

	const num = amountOfMarks - 1;
	for (let i = 1; i <= num; i++) {
		const part = (slider.max / num) | 0;

		if (i > num) {
			slider.add_mark(slider.max, Gtk.PositionType.BOTTOM, `${slider.max}K`);
			break;
		}

		slider.add_mark(
			part * i,
			Gtk.PositionType.BOTTOM,
			markup ? markup.replaceAll("{}", `${part * i}`) : null,
		);
	}

	return slider;
}
