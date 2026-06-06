import Adw from "gi://Adw?version=1";
import AstalBluetooth from "gi://AstalBluetooth";
import AstalNotifd from "gi://AstalNotifd";
import type Gio from "gi://Gio?version=2.0";

import { createBinding, createComputed, createRoot, For, With } from "ags";
import { Gtk } from "ags/gtk4";
import { createPoll } from "ags/time";

import { execApp } from "~/modules/apps";
import { Bluetooth } from "~/modules/bluetooth";
import { getSplitBatteryLevels } from "~/modules/bluetooth-battery";
import { Notifications } from "~/modules/notifications";
import { variableToBoolean } from "~/modules/utils";
import { Page, PageButton } from "~/window/control-center/widgets/Page";
import { Windows } from "~/windows";

function stopDiscovery(adapter: AstalBluetooth.Adapter): void {
	try {
		adapter.stop_discovery();
	} catch (e: any) {
		if (String(e.message).includes("No discovery started")) {
			adapter.powered = false;
			setTimeout(() => {
				adapter.powered = true;
			}, 500);
			return;
		}

		console.error(`Bluetooth: stop_discovery failed: ${e.message}`);
	}
}

export const BluetoothPage = createRoot(
	() =>
		(
			<Page
				id={"bluetooth"}
				title={"Bluetooth"}
				spacing={6}
				description={"Manage Bluetooth devices"}
				headerButtons={createBinding(Bluetooth.getDefault(), "adapter").as(
					(adapter) =>
						adapter
							? [
									{
										icon: createBinding(adapter, "discovering").as(
											(discovering) =>
												!discovering
													? "arrow-circular-top-right-symbolic"
													: "media-playback-stop-symbolic",
										),
										tooltipText: createBinding(adapter, "discovering").as(
											(discovering) =>
												!discovering ? "Start discovering" : "Stop discovering",
										),
										actionClicked: () => {
											if (adapter.discovering) {
												stopDiscovery(adapter);
												return;
											}

											adapter.start_discovery();
										},
									},
								]
							: [],
				)}
				actionClosed={() => {
					const adapter = Bluetooth.getDefault().adapter;
					if (adapter?.discovering) {
						stopDiscovery(adapter);
					}
				}}
				bottomButtons={[
					{
						title: "More settings",
						actionClicked: () => {
							Windows.getDefault().close("control-center");
							execApp("blueman-manager", "[float]");
						},
					},
				]}
				content={() => {
					const adapters = createBinding(
						AstalBluetooth.get_default(),
						"adapters",
					);
					const devices = createBinding(
						AstalBluetooth.get_default(),
						"devices",
					);
					const knownDevices = devices.as((devs) =>
						devs
							.filter((dev) => dev.trusted || dev.paired || dev.connected)
							.sort((dev) => (dev.connected ? 1 : 0)),
					);
					const discoveredDevices = devices.as((devs) =>
						devs.filter((dev) => !dev.trusted && !dev.paired && !dev.connected),
					);

					return (
						<Gtk.Box orientation={Gtk.Orientation.VERTICAL} spacing={4}>
							<Gtk.Box
								class={"adapters"}
								visible={adapters.as((adptrs) => adptrs.length > 1)}
								spacing={2}
								orientation={Gtk.Orientation.VERTICAL}
							>
								<Gtk.Label class={"sub-header"} label={"Adapters"} xalign={0} />
								<With value={adapters.as((adpts) => adpts.length > 1)}>
									{(hasMoreAdapters: boolean) =>
										hasMoreAdapters && (
											<Gtk.Box
												orientation={Gtk.Orientation.VERTICAL}
												spacing={2}
											>
												<For each={adapters}>
													{(adapter: AstalBluetooth.Adapter) => {
														const isSelected = createBinding(
															Bluetooth.getDefault(),
															"adapter",
														).as((a) => adapter.address === a?.address);

														return (
															<PageButton
																class={isSelected.as((is) =>
																	is ? "selected" : "",
																)}
																title={adapter.alias ?? "Adapter"}
																icon={"bluetooth-active-symbolic"}
																description={createBinding(adapter, "address")}
																actionClicked={() => {
																	if (
																		adapter.address !==
																		Bluetooth.getDefault().adapter?.address
																	)
																		Bluetooth.getDefault().adapter = adapter;
																}}
																endWidget={
																	<Gtk.Image
																		iconName={"object-select-symbolic"}
																		visible={isSelected}
																	/>
																}
															/>
														);
													}}
												</For>
											</Gtk.Box>
										)
									}
								</With>
							</Gtk.Box>
							<Gtk.Box
								class={"paired"}
								orientation={Gtk.Orientation.VERTICAL}
								spacing={4}
								visible={variableToBoolean(knownDevices)}
							>
								<Gtk.Label class={"sub-header"} label={"Devices"} xalign={0} />
								<For each={knownDevices}>
									{(dev: AstalBluetooth.Device) => (
										<DeviceWidget device={dev} />
									)}
								</For>
							</Gtk.Box>
							<Gtk.Box
								class={"discovered"}
								orientation={Gtk.Orientation.VERTICAL}
								spacing={4}
								visible={variableToBoolean(discoveredDevices)}
							>
								<Gtk.Label
									class={"sub-header"}
									label={"New devices"}
									xalign={0}
								/>
								<Gtk.ScrolledWindow
									hexpand
									propagateNaturalHeight
									maxContentHeight={280}
									hscrollbarPolicy={Gtk.PolicyType.NEVER}
									vscrollbarPolicy={Gtk.PolicyType.AUTOMATIC}
								>
									<Gtk.Box orientation={Gtk.Orientation.VERTICAL} spacing={2}>
										<For each={discoveredDevices}>
											{(dev: AstalBluetooth.Device) => (
												<DeviceWidget device={dev} />
											)}
										</For>
									</Gtk.Box>
								</Gtk.ScrolledWindow>
							</Gtk.Box>
						</Gtk.Box>
					);
				}}
			/>
		) as Page,
);

function DeviceWidget({
	device,
}: {
	device: AstalBluetooth.Device;
}): Gtk.Widget {
	const splitBattery = createPoll<number[]>([], 60_000, async () => {
		if (!device.connected) return [];
		try {
			return await getSplitBatteryLevels(device.address);
		} catch {
			return [];
		}
	});

	const pair = async () => {
		if (device.paired) return;

		device.pair();
		device.set_trusted(true);
	};

	return (
		<PageButton
			class={createBinding(device, "connected").as((conn) =>
				conn ? "selected" : "",
			)}
			title={createBinding(device, "alias").as(
				(alias) => alias ?? "Unknown Device",
			)}
			icon={createBinding(device, "icon").as(
				(ico) => ico ?? "bluetooth-active-symbolic",
			)}
			tooltipText={createBinding(device, "connected").as((connected) =>
				!connected ? "Connect" : "",
			)}
			actionClicked={() => {
				if (device.connected) return;

				pair()
					.then(() => {
						device.connect_device((_, res) => {
							try {
								device.connect_device_finish(res);
							} catch (e: any) {
								Notifications.getDefault().sendNotification({
									appName: "bluetooth",
									summary: "Connection Error",
									body: `An error occurred while attempting to connect to ${
										device.alias ?? device.name
									}: ${(e as Gio.IOErrorEnum).message}`,
								});
							}
						});
					})
					.catch((err: Gio.IOErrorEnum) =>
						Notifications.getDefault().sendNotification({
							appName: "bluetooth",
							summary: "Pairing Error",
							body: `Couldn't pair with ${device.alias ?? device.name}: ${err.message}`,
							urgency: AstalNotifd.Urgency.NORMAL,
						}),
					);
			}}
			endWidget={
				<Gtk.Box spacing={6}>
					<Adw.Spinner visible={createBinding(device, "connecting")} />
					<Gtk.Box
						visible={createComputed([
							splitBattery,
							createBinding(device, "connected"),
						]).as(([levels, connected]) => connected && levels.length >= 2)}
						spacing={4}
					>
						<Gtk.Label
							halign={Gtk.Align.END}
							label={splitBattery((levels) =>
								levels.length >= 2
									? `L: ${levels[0]}% · R: ${levels[1]}%`
									: "",
							)}
						/>
						<Gtk.Image
							iconName={splitBattery((levels) => {
								const min = Math.min(...levels);
								return `battery-level-${min - (min % 10)}-symbolic`;
							})}
							css={"font-size: 16px; margin-left: 6px;"}
						/>
					</Gtk.Box>
					<Gtk.Box
						visible={createComputed([
							splitBattery,
							createBinding(device, "batteryPercentage"),
							createBinding(device, "connected"),
						]).as(([levels, batt, connected]) => connected && levels.length < 2 && batt > -1)}
						spacing={4}
					>
						<Gtk.Label
							halign={Gtk.Align.END}
							label={createBinding(device, "batteryPercentage").as(
								(batt) => `${Math.floor(batt * 100)}%`,
							)}
						/>

						<Gtk.Image
							iconName={createBinding(device, "batteryPercentage").as(
								(batt) => `battery-level-${Math.floor(batt * 100)}-symbolic`,
							)}
							css={"font-size: 16px; margin-left: 6px;"}
						/>
					</Gtk.Box>
				</Gtk.Box>
			}
			extraButtons={
				<With
					value={createComputed([
						createBinding(device, "connected"),
						createBinding(device, "trusted"),
					])}
				>
					{([connected, trusted]: [boolean, boolean]) => (
						<Gtk.Box visible={connected || trusted}>
							{
								<Gtk.Button
									iconName={
										connected ? "list-remove-symbolic" : "user-trash-symbolic"
									}
									tooltipText={connected ? "Disconnect" : "Unpair device"}
									onClicked={() => {
										if (!connected) {
											Bluetooth.getDefault().adapter?.remove_device(device);
											return;
										}

										device.disconnect_device(null);
									}}
								/>
							}

							<Gtk.Button
								iconName={
									trusted ? "shield-safe-symbolic" : "shield-danger-symbolic"
								}
								tooltipText={trusted ? "Untrust device" : "Trust device"}
								onClicked={() => device.set_trusted(!trusted)}
							/>
						</Gtk.Box>
					)}
				</With>
			}
		/>
	) as Gtk.Widget;
}
