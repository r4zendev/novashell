import type AstalApps from "gi://AstalApps";
import AstalHyprland from "gi://AstalHyprland";

import { execAsync } from "ags/process";

export {
	filterExcludedApps,
	filterRunnerApps,
	getApps,
	queryApps,
	updateApps,
} from "~/modules/apps-registry";
export {
	getAppIcon,
	getIconByAppName,
	getSymbolicIcon,
	lookupIcon,
	resolveIconFromClasses,
} from "~/modules/icons/resolver";

export const uwsmIsActive: boolean = await execAsync("uwsm check is-active")
	.then(() => true)
	.catch(() => false);

/** execute apps and commands using Hyprland's exec dispatcher.
    supports desktop entries and usage of uwsm if it's active */
export function execApp(
	app: AstalApps.Application | string,
	dispatchExecArgs?: string,
) {
	const executable =
		typeof app === "string" ? app : app.executable.replace(/%[fFcuUik]/g, "");

	if (typeof app !== "string") app.frequency++;

	AstalHyprland.get_default().dispatch(
		"exec",
		`${dispatchExecArgs ? `${dispatchExecArgs} ` : ""}${
			uwsmIsActive
				? "uwsm-app -- "
				: executable.endsWith(".desktop")
					? "gtk-launch "
					: ""
		}${executable}`,
	);
}
