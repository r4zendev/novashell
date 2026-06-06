import type { Accessor } from "ags";
import { Gtk } from "ags/gtk4";
import { execAsync } from "ags/process";
import { createPoll } from "ags/time";

interface MemInfo {
	percentage: number;
	usedGiB: number;
	totalGiB: number;
}

function getMemoryUsage(): Accessor<MemInfo> {
	return createPoll<MemInfo>(
		{ percentage: 0, usedGiB: 0, totalGiB: 0 },
		2000,
		async () => {
			try {
				const output = await execAsync([
					"bash",
					"-c",
					"free -b | awk '/^Mem:/ {printf \"%.0f %.2f %.2f\", ($3/$2)*100, $3/1073741824, $2/1073741824}'",
				]);
				const [pct, used, total] = output.trim().split(" ").map(parseFloat);
				return {
					percentage: Math.round(pct || 0),
					usedGiB: used || 0,
					totalGiB: total || 0,
				};
			} catch {
				return { percentage: 0, usedGiB: 0, totalGiB: 0 };
			}
		},
	);
}

export const Memory = () => {
	const memInfo = getMemoryUsage();

	return (
		<Gtk.Button
			class={"memory"}
			tooltipText={memInfo(
				(info) =>
					`Memory: ${info.usedGiB.toFixed(1)} / ${info.totalGiB.toFixed(1)} GiB\nClick to open btop`,
			)}
			onClicked={() => {
				execAsync([
					"ghostty",
					"--font-size=10",
					"--title=btop",
					"-e",
					"btop",
				]).catch(() => {});
			}}
		>
			<Gtk.Box spacing={6}>
				<Gtk.Label class={"icon"} label={"󰘚"} />
				<Gtk.Label
					class={"value"}
					label={memInfo((info) => `${info.percentage}%`)}
				/>
			</Gtk.Box>
		</Gtk.Button>
	);
};
