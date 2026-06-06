import AstalApps from "gi://AstalApps";

import { generalConfig } from "~/config";

const astalApps: AstalApps.Apps = new AstalApps.Apps();
let appsList: Array<AstalApps.Application> = [];

function getDesktopId(app: AstalApps.Application): string {
	const withDesktopId = app as AstalApps.Application & {
		get_desktop_id?: () => string | null;
	};

	if (typeof withDesktopId.get_desktop_id === "function") {
		return withDesktopId.get_desktop_id() ?? "";
	}

	return "";
}

function matchesAny(
	app: AstalApps.Application,
	list: string[],
): boolean {
	const name = app.get_name()?.toLowerCase() || "";
	const desktop = getDesktopId(app).toLowerCase();
	const wmClass = app.wmClass?.toLowerCase() || "";

	return list.some((entry) => {
		const lower = entry.toLowerCase();
		return (
			name.includes(lower) ||
			desktop.includes(lower) ||
			wmClass.includes(lower)
		);
	});
}

export function filterExcludedApps(
	apps: Array<AstalApps.Application>,
): Array<AstalApps.Application> {
	const exclude =
		(generalConfig.getProperty("apps.exclude", "object") as string[]) || [];
	if (!exclude.length) return apps;

	return apps.filter((app) => !matchesAny(app, exclude));
}

export function filterRunnerApps(
	apps: Array<AstalApps.Application>,
): Array<AstalApps.Application> {
	const runner =
		(generalConfig.getProperty("apps.runner", "object") as string[]) || [];
	if (!runner.length) return filterExcludedApps(apps);

	return apps.filter((app) => matchesAny(app, runner));
}

export function getApps(): Array<AstalApps.Application> {
	if (!appsList.length) appsList = astalApps.get_list();
	return appsList;
}

export function updateApps(): void {
	astalApps.reload();
	appsList = astalApps.get_list();
}

export function queryApps(text: string): Array<AstalApps.Application> {
	return astalApps.fuzzy_query(text);
}

export function getAppsByName(
	appName: string,
): Array<AstalApps.Application> | undefined {
	const query = appName.trim().toLowerCase();
	const exact: Array<AstalApps.Application> = [];
	const partial: Array<AstalApps.Application> = [];

	for (const app of getApps()) {
		const name = app.get_name().trim().toLowerCase();
		const wm = app?.wmClass?.trim().toLowerCase() ?? "";

		if (name === query || wm === query) exact.push(app);
		else if (name.includes(query) || query.includes(name) || wm.includes(query))
			partial.push(app);
	}

	if (exact.length > 0) return exact;
	if (partial.length > 0) return partial;
	return undefined;
}
