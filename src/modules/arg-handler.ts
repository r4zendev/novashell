import type AstalIO from "gi://AstalIO";
import { timeout } from "ags/time";

import { Shell } from "~/app";
import { handleDevArgs } from "~/modules/arg-handler/dev";
import { handleMediaArgs } from "~/modules/arg-handler/media";
import { getVersionMessage, helpMessage } from "~/modules/arg-handler/messages";
import { handleRunnerArgs } from "~/modules/arg-handler/runner";
import { handleThemeArgs } from "~/modules/arg-handler/theme";
import type { RemoteCaller } from "~/modules/arg-handler/types";
import { printUnknownCommand } from "~/modules/arg-handler/utils";
import { handleVolumeArgs } from "~/modules/arg-handler/volume";
import { handleWallpaperArgs } from "~/modules/arg-handler/wallpaper";
import { handleWindowArgs } from "~/modules/arg-handler/window";
import { restartInstance } from "~/modules/reload-handler";
import { Runner } from "~/runner/Runner";
import { showWorkspaceNumber } from "~/window/bar/widgets/Workspaces";

let wsTimeout: AstalIO.Time | undefined;

export type { RemoteCaller } from "~/modules/arg-handler/types";

export function handleArguments(
	cmd: RemoteCaller,
	args: Array<string>,
): number {
	switch (args[0]) {
		case "help":
		case "h":
			cmd.print_literal(helpMessage);
			return 0;

		case "version":
		case "v":
			cmd.print_literal(getVersionMessage());
			return 0;

		case "dev":
			return handleDevArgs(cmd, args);

		case "open":
		case "close":
		case "toggle":
		case "windows":
		case "reopen":
			return handleWindowArgs(cmd, args);

		case "volume":
			return handleVolumeArgs(cmd, args);

		case "run":
			return handleRunnerArgs(cmd, args);

		case "media":
			return handleMediaArgs(cmd, args);

		case "theme":
			return handleThemeArgs(cmd, args);

		case "wallpaper":
			return handleWallpaperArgs(cmd, args);

		case "reload":
			restartInstance();
			cmd.print_literal("Restarting instance...");
			return 0;

		case "quit":
			try {
				Shell.getDefault().quit();
				cmd.print_literal("Quitting main instance...");
			} catch (_e) {
				const e = _e as Error;
				cmd.printerr_literal(
					`Error: couldn't quit instance. Stderr: ${e.message}\n${e.stack}`,
				);
				return 1;
			}
			return 0;

		case "runner":
			if (!Runner.instance) {
				Runner.openDefault(args[1] || undefined);
				cmd.print_literal(
					`Opening runner${args[1] ? ` with predefined text: "${args[1]}"` : ""}`,
				);
				return 0;
			}

			Runner.close();
			cmd.print_literal("Closing runner...");
			return 0;

		case "peek-workspace-num":
			if (wsTimeout) {
				cmd.print_literal("Workspace numbers are already showing");
				return 0;
			}

			showWorkspaceNumber(true);
			wsTimeout = timeout(Number.parseInt(args[1]) || 2200, () => {
				showWorkspaceNumber(false);
				wsTimeout = undefined;
			});
			cmd.print_literal("Toggled workspace numbers");
			return 0;
	}

	return printUnknownCommand(cmd, "help");
}
