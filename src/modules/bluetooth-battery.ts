import { execAsync } from "ags/process";

const BAS_UUID = "0000180f-0000-1000-8000-00805f9b34fb";

async function findBatteryCharPaths(address: string): Promise<string[]> {
	const devSuffix = `/dev_${address.replaceAll(":", "_")}`;
	const tree = await execAsync("busctl tree org.bluez --list");
	const devicePath = tree.split("\n").find(
		(l) => l.endsWith(devSuffix),
	);
	if (!devicePath) return [];

	const lines = tree.split("\n").filter((l) => l.startsWith(devicePath));

	const services = lines.filter((l) => /\/service\w+$/.test(l));
	const batteryChars: string[] = [];

	for (const svc of services) {
		try {
			const uuid = await execAsync(
				`busctl get-property org.bluez ${svc} org.bluez.GattService1 UUID`,
			);
			if (!uuid.includes(BAS_UUID)) continue;

			const char = lines.find(
				(l) => l.startsWith(`${svc}/char`) && /\/char\w+$/.test(l),
			);
			if (char) batteryChars.push(char);
		} catch {
			continue;
		}
	}

	return batteryChars;
}

async function readBatteryLevel(charPath: string): Promise<number> {
	const result = await execAsync([
		"busctl", "call", "org.bluez", charPath,
		"org.bluez.GattCharacteristic1", "ReadValue", "a{sv}", "0",
	]);
	const match = result.match(/ay\s+\d+\s+(\d+)/);
	return match ? Number.parseInt(match[1], 10) : -1;
}

export async function getSplitBatteryLevels(
	address: string,
): Promise<number[]> {
	const charPaths = await findBatteryCharPaths(address);
	if (charPaths.length < 2) return [];

	const levels = await Promise.all(charPaths.map(readBatteryLevel));
	return levels;
}
