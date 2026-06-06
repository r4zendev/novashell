import type { Accessor } from "ags";
import { Gtk } from "ags/gtk4";
import { execAsync } from "ags/process";
import { createPoll } from "ags/time";

function getCpuUsage(): Accessor<number> {
	return createPoll<number>(0, 2000, async () => {
		try {
			const output = await execAsync([
				"bash",
				"-c",
				"top -bn1 | grep 'Cpu(s)' | awk '{print 100 - $8}'",
			]);
			return Math.round(parseFloat(output.trim()) || 0);
		} catch {
			return 0;
		}
	});
}

export const Cpu = () => {
	const cpuUsage = getCpuUsage();

	return (
		<Gtk.Button
			class={"cpu"}
			tooltipText={"CPU usage - Click to open Mission Center"}
			onClicked={() => {
				execAsync(["missioncenter"]).catch(() => {});
			}}
		>
			<Gtk.Box spacing={6}>
				<Gtk.Label class={"icon"} label={"󰍛"} />
				<Gtk.Label class={"value"} label={cpuUsage((usage) => `${usage}%`)} />
			</Gtk.Box>
		</Gtk.Button>
	);
};
