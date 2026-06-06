import Gio from "gi://Gio?version=2.0";

import { Shell } from "~/app";
import { uwsmIsActive } from "~/modules/apps";

export function restartInstance(): void {
	Gio.Subprocess.new(
		uwsmIsActive ? ["uwsm", "app", "--", "nsh"] : ["nsh"],
		Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE,
	);
	Shell.getDefault().quit();
}
