import type { RemoteCaller } from "~/modules/arg-handler/types";
import { Windows } from "~/windows";

export function handleWindowArgs(
	cmd: RemoteCaller,
	args: Array<string>,
): number {
	const windows = Windows.getDefault();

	switch (args[0]) {
		case "reopen":
			windows.reopen();
			cmd.print_literal("Reopening all open windows");
			return 0;

		case "windows":
			cmd.print_literal(
				Object.keys(windows.windows)
					.map((name) => `${name}: ${windows.isOpen(name) ? "open" : "closed"}`)
					.join("\n"),
			);
			return 0;
	}

	const specifiedWindow: string = args[1];

	if (!specifiedWindow) {
		cmd.printerr_literal("Error: window argument not specified!");
		return 1;
	}

	if (!windows.hasWindow(specifiedWindow)) {
		cmd.printerr_literal(
			`Error: "${specifiedWindow}" not found on window list! Make sure to add new windows to the system before using them`,
		);
		return 1;
	}

	switch (args[0]) {
		case "open":
			if (!windows.isOpen(specifiedWindow)) {
				windows.open(specifiedWindow);
				cmd.print_literal(`Opening window with name "${args[1]}"`);
				return 0;
			}

			cmd.print_literal("Window is already open, ignored");
			return 0;

		case "close":
			if (windows.isOpen(specifiedWindow)) {
				windows.close(specifiedWindow);
				cmd.print_literal(`Closing window with name "${args[1]}"`);
				return 0;
			}

			cmd.print_literal("Window is already closed, ignored");
			return 0;

		case "toggle":
			if (!windows.isOpen(specifiedWindow)) {
				windows.open(specifiedWindow);
				cmd.print_literal(`Toggle opening window "${args[1]}"`);
				return 0;
			}

			windows.close(specifiedWindow);
			cmd.print_literal(`Toggle closing window "${args[1]}"`);
			return 0;
	}

	cmd.printerr_literal("Couldn't handle window management arguments");
	return 1;
}
