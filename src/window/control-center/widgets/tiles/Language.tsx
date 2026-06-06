import {
	fullLangName,
	keyboardLayout,
	switchToNextLayout,
} from "~/modules/keyboard";
import { Tile } from "~/window/control-center/widgets/tiles/Tile";

export const TileLanguage = (_pages?: unknown) => (
	<Tile
		title={keyboardLayout}
		description={keyboardLayout((l) => fullLangName(l))}
		icon={"input-keyboard-symbolic"}
		state={false}
		onEnabled={(self: Tile) => {
			switchToNextLayout();
			self.state = false;
			self.remove_css_class("enabled");
		}}
		onClicked={() => {
			switchToNextLayout();
		}}
	/>
);
