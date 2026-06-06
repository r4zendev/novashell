import AstalNetwork from "gi://AstalNetwork";

import { type Accessor, createBinding, createComputed } from "ags";
import { execAsync } from "ags/process";

import { resolveNetworkIcon } from "~/modules/icons";
import { Notifications } from "~/modules/notifications";
import { secureBaseBinding } from "~/modules/utils";
import type { Pages } from "~/window/control-center/widgets/pages";
import { PageNetwork } from "~/window/control-center/widgets/pages/Network";
import { Tile } from "~/window/control-center/widgets/tiles/Tile";

const { WIFI, WIRED } = AstalNetwork.Primary,
	{ CONNECTED, CONNECTING, DISCONNECTED } = AstalNetwork.Internet;

const wiredInternet = secureBaseBinding<AstalNetwork.Wired>(
	createBinding(AstalNetwork.get_default(), "wired"),
	"internet",
	AstalNetwork.Internet.DISCONNECTED,
) as Accessor<AstalNetwork.Internet>;

const wifiInternet = secureBaseBinding<AstalNetwork.Wifi>(
	createBinding(AstalNetwork.get_default(), "wifi"),
	"internet",
	AstalNetwork.Internet.DISCONNECTED,
) as Accessor<AstalNetwork.Internet>;

const wifiSSID = secureBaseBinding<AstalNetwork.Wifi>(
	createBinding(AstalNetwork.get_default(), "wifi"),
	"ssid",
	"Unknown",
) as Accessor<string>;

const wifiIcon = secureBaseBinding<AstalNetwork.Wifi>(
	createBinding(AstalNetwork.get_default(), "wifi"),
	"iconName",
	"network-wireless-symbolic",
);

const wiredIcon = secureBaseBinding<AstalNetwork.Wired>(
	createBinding(AstalNetwork.get_default(), "wired"),
	"iconName",
	"network-wired-symbolic",
);

const primary = createBinding(AstalNetwork.get_default(), "primary");

export const TileNetwork = (pages: Pages) => (
	<Tile
		hasArrow
		title={createComputed(
			[primary, wifiInternet, wifiSSID],
			(primary, wiInternet, wiSSID) => {
				switch (primary) {
					case WIFI:
						if (wiInternet === CONNECTED) return wiSSID;

						return "Wireless";

					case WIRED:
						return "Wired";
				}

				return "Network";
			},
		)}
		arrowOpen={createBinding(pages, "page").as(
			(page) => page?.id === PageNetwork.id,
		)}
		onClicked={() => pages.toggle(PageNetwork)}
		icon={
			createComputed(
				[primary, wifiIcon, wiredIcon],
				(
					primary: AstalNetwork.Primary,
					wifiIcon: string,
					wiredIcon: string,
				) => {
					switch (primary) {
						case WIFI:
							return resolveNetworkIcon(wifiIcon, "network-wireless-symbolic");

						case WIRED:
							return resolveNetworkIcon(wiredIcon, "network-wired-symbolic");
					}

					return "network-no-route-symbolic";
				},
			) as Accessor<string>
		}
		state={
			createComputed(
				[
					primary,
					secureBaseBinding<AstalNetwork.Wifi>(
						createBinding(AstalNetwork.get_default(), "wifi"),
						"enabled",
						false,
					),
					wiredInternet.as(
						(internet) => internet === CONNECTED || internet === CONNECTING,
					),
				],
				(
					primary: AstalNetwork.Primary,
					wifiEnabled: boolean,
					wiredEnabled: boolean,
				) => {
					switch (primary) {
						case WIFI:
							return wifiEnabled;

						case WIRED:
							return wiredEnabled;
					}

					return false;
				},
			) as Accessor<boolean>
		}
		description={createComputed(
			[primary, wifiInternet, wiredInternet],
			(primary, wifiInternet, wiredInternet) => {
				switch (primary) {
					case WIFI:
						return internetToTranslatedString(wifiInternet);

					case WIRED:
						return internetToTranslatedString(wiredInternet);
				}

				return "Disconnected";
			},
		)}
		onToggled={(self, state) => {
			const wifi = AstalNetwork.get_default().wifi,
				wired = AstalNetwork.get_default().wired;

			switch (AstalNetwork.get_default().primary) {
				case WIFI:
					wifi.set_enabled(state);
					return;

				case WIRED:
					setNetworking(state);
					return;
			}

			if (wired && wired.internet === DISCONNECTED) {
				setNetworking(true);
				return;
			} else if (wifi && !wifi.enabled) {
				wifi.set_enabled(true);
				return;
			}

			// disable if no device available
			self.state = false;
		}}
	/>
);

function internetToTranslatedString(internet: AstalNetwork.Internet): string {
	switch (internet) {
		case AstalNetwork.Internet.CONNECTED:
			return "Connected";
		case AstalNetwork.Internet.CONNECTING:
			return "Connecting...";
	}

	return "Disconnected";
}

function setNetworking(state: boolean): void {
	(!state ? execAsync("nmcli n off") : execAsync("nmcli n on")).catch((e) => {
		Notifications.getDefault().sendNotification({
			appName: "network",
			summary: "Couldn't turn off network",
			body: `Turning off networking with nmcli failed${
				e?.message !== undefined ? `: ${e?.message}` : ""
			}`,
		});
	});
}
