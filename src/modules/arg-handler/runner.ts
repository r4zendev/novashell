import { execApp } from "~/modules/apps";
import type { RemoteCaller } from "~/modules/arg-handler/types";
import { isHelpArg } from "~/modules/arg-handler/utils";

const runnerHelp = `Run applications and custom helpers.

Help:
  client_modifiers: Hyprland client modifiers(e.g.: "[animation slide]")

Options:
  h, help: show this help message.

Usage:
  run appName[.desktop] [client_modifiers]: run an ordinary app(uses uwsm if available).`;

export function handleRunnerArgs(
	cmd: RemoteCaller,
	args: Array<string>,
): number {
	if (isHelpArg(args[1])) {
		cmd.print_literal(runnerHelp);
		return 0;
	}

	if (args[1] === undefined || args[1].trim() === "") {
		cmd.printerr_literal('Error: No application to run provided after "run"');
		return 1;
	}

	cmd.print_literal(
		`Executing app from ${
			args[1].endsWith(".desktop") ? "desktop entry" : "command"
		}...`,
	);
	execApp(args[1], args[2] || undefined);
	return 0;
}
