import { Gtk } from "ags/gtk4";

import type { RemoteCaller } from "~/modules/arg-handler/types";
import { isHelpArg, printUnknownCommand } from "~/modules/arg-handler/utils";

const devHelp = `
Debugging tools for novashell.

Options:
  inspector: open GTK's visual debugger
`.trim();

export function handleDevArgs(cmd: RemoteCaller, args: Array<string>): number {
	if (isHelpArg(args[1])) {
		cmd.print_literal(devHelp);
		return 0;
	}

	switch (args[1]) {
		case "inspector":
			cmd.print_literal("Opening inspector...");
			Gtk.Window.set_interactive_debugging(true);
			return 0;
	}

	return printUnknownCommand(cmd, "`dev help`");
}
