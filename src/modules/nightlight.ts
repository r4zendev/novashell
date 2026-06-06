import GLib from "gi://GLib?version=2.0";

import GObject, { getter, register, setter } from "ags/gobject";
import { exec, execAsync } from "ags/process";

import { generalConfig } from "~/config";

@register({ GTypeName: "NightLight" })
export class NightLight extends GObject.Object {
	private static instance: NightLight;

	public static readonly maxTemperature = 20000;
	public static readonly minTemperature = 1000;
	public static readonly identityTemperature = 6000;
	public static readonly maxGamma = 100;

	#watchInterval: GLib.Source | null = null;
	#temperature: number = NightLight.identityTemperature;
	#gamma: number = NightLight.maxGamma;
	#identity: boolean = true;
	#manualOverride: boolean = false;

	@getter(Number)
	public get temperature() {
		return this.#temperature;
	}
	@setter(Number)
	public set temperature(newValue: number) {
		this.setTemperature(newValue);
	}

	@getter(Number)
	public get gamma() {
		return this.#gamma;
	}
	@setter(Number)
	public set gamma(newValue: number) {
		this.setGamma(newValue);
	}

	@getter(Boolean)
	public get identity() {
		return this.#identity;
	}
	@setter(Boolean)
	public set identity(val: boolean) {
		if (this.#identity === val) return;

		this.#manualOverride = true;
		val ? this.applyIdentity() : this.filter();
		this.#identity = val;
		this.notify("identity");
	}

	constructor() {
		super();

		if (!generalConfig.getProperty("night_light.enabled", "boolean")) return;

		this.#temperature =
			generalConfig.getProperty("night_light.temperature", "number") ?? 4500;
		this.#gamma =
			generalConfig.getProperty("night_light.gamma", "number") ??
			NightLight.maxGamma;

		this.checkSchedule();
		this.#watchInterval = setInterval(() => {
			this.syncData();
			if (!this.#manualOverride) this.checkSchedule();
		}, 10000);
	}

	public static getDefault(): NightLight {
		if (!NightLight.instance) NightLight.instance = new NightLight();

		return NightLight.instance;
	}

	private checkSchedule(): void {
		const now = GLib.DateTime.new_now_local();
		const hour = now.get_hour();
		const startHour =
			generalConfig.getProperty("night_light.start_hour", "number") ?? 20;
		const endHour =
			generalConfig.getProperty("night_light.end_hour", "number") ?? 7;

		let shouldBeActive: boolean;
		if (startHour === endHour) {
			shouldBeActive = true; // same hour = always on
		} else if (startHour > endHour) {
			// crosses midnight (e.g., 20-7)
			shouldBeActive = hour >= startHour || hour < endHour;
		} else {
			// same day (e.g., 9-17)
			shouldBeActive = hour >= startHour && hour < endHour;
		}

		if (shouldBeActive && this.#identity) {
			this.filter();
			this.#identity = false;
			this.notify("identity");
		} else if (!shouldBeActive && !this.#identity) {
			this.applyIdentity();
		}
	}

	private syncData(): void {
		execAsync("hyprctl hyprsunset temperature")
			.then((t) => {
				if (t.trim() !== "" && t.trim().length <= 5) {
					const val = Number.parseInt(t.trim());

					if (this.#temperature !== val) {
						this.#temperature = val;
						this.notify("temperature");
					}
				}
			})
			.catch((r: Error) =>
				console.error(
					`Night Light: Couldn't sync temperature. Stderr: ${
						r.message
					}\n${r.stack}`,
				),
			);

		execAsync("hyprctl hyprsunset gamma")
			.then((g) => {
				if (g.trim() !== "" && g.trim().length <= 5) {
					const val = Number.parseInt(g.trim());

					if (this.#gamma !== val) {
						this.#gamma = val;
						this.notify("gamma");
					}
				}
			})
			.catch((r: Error) =>
				console.error(
					`Night Light: Couldn't sync. Stderr: ${r.message}\n${r.stack}`,
				),
			);
	}

	private setTemperature(value: number): void {
		if (value === this.temperature && !this.identity) return;

		if (value > NightLight.maxTemperature || value < 1000) {
			console.error(
				`Night Light: provided temperatue ${
					value
				} is out of bounds (min: 1000; max: ${NightLight.maxTemperature})`,
			);
			return;
		}

		this.dispatchAsync("temperature", value)
			.then(() => {
				this.#temperature = value;
				this.notify("temperature");

				this.#manualOverride = true;
				if (this.#identity) {
					this.#identity = false;
					this.notify("identity");
				}
			})
			.catch((r: Error) =>
				console.error(
					`Night Light: Couldn't set temperature. Stderr: ${r.message}\n${r.stack}`,
				),
			);
	}

	private setGamma(value: number): void {
		if (value === this.gamma && !this.identity) return;

		if (value > NightLight.maxGamma || value < 0) {
			console.error(
				`Night Light: provided gamma ${
					value
				} is out of bounds (min: 0; max: ${NightLight.maxGamma})`,
			);
			return;
		}

		this.dispatchAsync("gamma", value)
			.then(() => {
				this.#gamma = value;
				this.notify("gamma");

				this.#manualOverride = true;
				if (this.#identity) {
					this.#identity = false;
					this.notify("identity");
				}
			})
			.catch((r: Error) =>
				console.error(
					`Night Light: Couldn't set gamma. Stderr: ${r.message}\n${r.stack}`,
				),
			);
	}

	public applyIdentity(): void {
		this.dispatch("identity");

		if (!this.#identity) {
			this.#identity = true;
			this.notify("identity");
		}
	}

	public stop(): void {
		if (!this.#watchInterval) return;

		this.#watchInterval.destroy();
		this.#watchInterval = null;
	}

	private dispatch(call: "temperature", val: number): string;
	private dispatch(call: "gamma", val: number): string;
	private dispatch(call: "identity"): string;

	private dispatch(
		call: "temperature" | "gamma" | "identity",
		val?: number,
	): string {
		return exec(`hyprctl hyprsunset ${call}${val != null ? ` ${val}` : ""}`);
	}

	private async dispatchAsync(
		call: "temperature",
		val: number,
	): Promise<string>;
	private async dispatchAsync(call: "gamma", val: number): Promise<string>;
	private async dispatchAsync(call: "identity"): Promise<string>;

	private async dispatchAsync(
		call: "temperature" | "gamma" | "identity",
		val?: number,
	): Promise<string> {
		return await execAsync(
			`hyprctl hyprsunset ${call}${val != null ? ` ${val}` : ""}`,
		);
	}

	public filter(): void {
		this.setTemperature(this.temperature);
		this.setGamma(this.gamma);

		if (this.#identity) {
			this.#identity = false;
			this.notify("identity");
		}
	}
}
