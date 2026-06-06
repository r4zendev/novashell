import { createBinding, createComputed } from "ags";

import { Recording } from "~/modules/recording";
import { isInstalled } from "~/modules/utils";
import { Tile } from "~/window/control-center/widgets/tiles/Tile";

export const TileRecording = (_pages?: unknown) => (
	<Tile
		title={"Screen Recording"}
		description={createComputed(
			[
				createBinding(Recording.getDefault(), "recording"),
				createBinding(Recording.getDefault(), "recordingTime"),
			],
			(recording, time) => {
				if (!recording || !Recording.getDefault().startedAt)
					return "Start recording";

				return time;
			},
		)}
		icon={"media-record-symbolic"}
		visible={isInstalled("wf-recorder")}
		onDisabled={() => Recording.getDefault().stopRecording()}
		onEnabled={() => Recording.getDefault().startRecording()}
		state={createBinding(Recording.getDefault(), "recording")}
		toggleOnClick
	/>
);
