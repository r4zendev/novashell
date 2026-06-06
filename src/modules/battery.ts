import AstalBattery from "gi://AstalBattery?version=0.1";

import { type Accessor, createBinding } from "ags";

export class Battery {
	private static astalBattery: AstalBattery.Device = AstalBattery.get_default();

	private static batteryInst: Battery;

	constructor() {}

	public static getDefault(): Battery {
		if (!Battery.batteryInst) {
			Battery.batteryInst = new Battery();
		}

		return Battery.batteryInst;
	}

	public static getBattery(): AstalBattery.Device {
		return Battery.astalBattery;
	}

	public bindHasBattery(): Accessor<boolean> {
		return createBinding(Battery.getBattery(), "isBattery");
	}

	public bindPercentage(): Accessor<string> {
		return createBinding(Battery.getBattery(), "percentage").as(
			(v) => Math.round(v * 100) + "%",
		);
	}

	public bindIcon(): Accessor<string> {
		return createBinding(Battery.getBattery(), "battery_icon_name");
	}
}
