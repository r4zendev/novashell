import { createBinding } from "ags";

import { Notifications } from "~/modules/notifications";
import { Tile } from "~/window/control-center/widgets/tiles/Tile";

export const TileDND = (_pages?: unknown) => {
	const notifd = Notifications.getDefault().getNotifd();

	return (
		<Tile
			title={"Do Not Disturb"}
			description={createBinding(notifd, "dontDisturb").as((dnd: boolean) =>
				dnd ? "Enabled" : "Disabled",
			)}
			onDisabled={() => {
				notifd.dontDisturb = false;
			}}
			onEnabled={() => {
				notifd.dontDisturb = true;
			}}
			icon={"minus-circle-filled-symbolic"}
			iconSize={17}
			state={notifd.dontDisturb}
			toggleOnClick
		/>
	);
};
