import { createRoot } from "ags";
import { Gtk } from "ags/gtk4";

import { Pages } from "~/window/control-center/widgets/pages";
import { TileBluetooth } from "~/window/control-center/widgets/tiles/Bluetooth";
import { TileDND } from "~/window/control-center/widgets/tiles/DoNotDisturb";
import { TileLanguage } from "~/window/control-center/widgets/tiles/Language";
import { TileNetwork } from "~/window/control-center/widgets/tiles/Network";
import { TileNightLight } from "~/window/control-center/widgets/tiles/NightLight";
import { TileRecording } from "~/window/control-center/widgets/tiles/Recording";

export const tileList: Array<(pages: Pages) => JSX.Element | Gtk.Widget> = [
	TileNetwork,
	TileBluetooth,
	TileRecording,
	TileDND,
	TileNightLight,
	TileLanguage,
] as Array<(pages: Pages) => Gtk.Widget>;

export function Tiles(): Gtk.Widget {
	return createRoot((dispose) => {
		const pages = new Pages();
		pages.add_css_class("tile-pages");

		return (
			<Gtk.Box
				class={"tiles-container"}
				orientation={Gtk.Orientation.VERTICAL}
				onDestroy={() => dispose()}
			>
				<Gtk.FlowBox
					orientation={Gtk.Orientation.HORIZONTAL}
					rowSpacing={6}
					columnSpacing={6}
					minChildrenPerLine={2}
					activateOnSingleClick
					maxChildrenPerLine={2}
					hexpand
					homogeneous
				>
					{tileList.map((t) => t(pages))}
				</Gtk.FlowBox>

				{pages}
			</Gtk.Box>
		) as Gtk.Box;
	});
}
