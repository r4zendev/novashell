import { createBinding } from "ags";
import { Astal, Gtk } from "ags/gtk4";

import { NightLight } from "~/modules/nightlight";
import { addSliderMarksFromMinMax } from "~/modules/utils";
import { Page } from "~/window/control-center/widgets/Page";

export const PageNightLight = (
	<Page
		id={"night-light"}
		title={"Night Light"}
		description={"Control Night Light and Gamma filters"}
		content={() => [
			<Gtk.Label class={"sub-header"} label={"Temperature"} xalign={0} />,
			<Astal.Slider
				class={"temperature"}
				$={(self) => {
					self.value = NightLight.getDefault().temperature;
					addSliderMarksFromMinMax(self, 5, "{}K");
				}}
				value={createBinding(NightLight.getDefault(), "temperature")}
				tooltipText={createBinding(NightLight.getDefault(), "temperature").as(
					(temp) => `${temp}K`,
				)}
				min={NightLight.minTemperature}
				max={NightLight.maxTemperature}
				onChangeValue={(_, type, value) => {
					if (type != null)
						NightLight.getDefault().temperature = Math.floor(value);
				}}
			/>,
			<Gtk.Label class={"sub-header"} label={"Gamma"} xalign={0} />,
			<Astal.Slider
				class={"gamma"}
				$={(self) => {
					self.value = NightLight.getDefault().gamma;
					addSliderMarksFromMinMax(self, 5, "{}%");
				}}
				value={createBinding(NightLight.getDefault(), "gamma")}
				tooltipText={createBinding(NightLight.getDefault(), "gamma").as(
					(gamma) => `${gamma}%`,
				)}
				max={NightLight.maxGamma}
				onChangeValue={(_, type, value) => {
					if (type != null) NightLight.getDefault().gamma = Math.floor(value);
				}}
			/>,
		]}
	/>
) as Page;
