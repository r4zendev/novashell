import AstalBluetooth from "gi://AstalBluetooth";

import { createBinding, createComputed } from "ags";

import { Bluetooth } from "~/modules/bluetooth";
import { secureBaseBinding } from "~/modules/utils";
import type { Pages } from "~/window/control-center/widgets/pages";
import { BluetoothPage } from "~/window/control-center/widgets/pages/Bluetooth";
import { Tile } from "~/window/control-center/widgets/tiles/Tile";

export const TileBluetooth = (pages: Pages) => (
	<Tile
		title={createBinding(Bluetooth.getDefault(), "lastDevice").as(
			(dev) => dev?.alias ?? "Bluetooth",
		)}
		visible={createBinding(Bluetooth.getDefault(), "isAvailable")}
		description={secureBaseBinding<typeof Bluetooth.prototype.lastDevice>(
			createBinding(Bluetooth.getDefault(), "lastDevice"),
			"batteryPercentage",
			null,
		).as((bat) =>
			bat !== null && bat > 0
				? `Battery: ${Math.floor(bat * 100)}%`
				: bat !== null
					? "Connected"
					: "",
		)}
		onEnabled={() => Bluetooth.getDefault().adapter?.set_powered(true)}
		onDisabled={() => Bluetooth.getDefault().adapter?.set_powered(false)}
		arrowOpen={createBinding(pages, "page").as(
			(page) => page?.id === BluetoothPage.id,
		)}
		onClicked={() => pages.toggle(BluetoothPage)}
		hasArrow
		state={createBinding(AstalBluetooth.get_default(), "isPowered")}
		icon={createComputed(
			[
				createBinding(AstalBluetooth.get_default(), "isPowered"),
				createBinding(AstalBluetooth.get_default(), "isConnected"),
			],
			(powered: boolean, isConnected: boolean) =>
				powered
					? isConnected
						? "bluetooth-active-symbolic"
						: "bluetooth-symbolic"
					: "bluetooth-disabled-symbolic",
		)}
	/>
);
