import type { RemoteCaller } from "~/modules/arg-handler/types";

const HELP_ARGS = new Set(["h", "help", "-h", "--help"]);

export function isHelpArg(arg?: string): boolean {
	return arg !== undefined && HELP_ARGS.has(arg);
}

export function printUnknownCommand(cmd: RemoteCaller, hint: string): number {
	cmd.printerr_literal(`Error: command not found! try checking ${hint}`);
	return 1;
}
