import "ags/overrides";

import Adw from "gi://Adw?version=1";
import AstalWp from "gi://AstalWp";
import Gio from "gi://Gio?version=2.0";
import GLib from "gi://GLib?version=2.0";

import {
	createBinding,
	createComputed,
	createRoot,
	getScope,
	onCleanup,
	type Scope,
} from "ags";
import type GObject from "ags/gobject";
import { register } from "ags/gobject";
import { Gdk, Gtk } from "ags/gtk4";
import { exec } from "ags/process";
import { setConsoleLogDomain } from "console";
import { exit, programArgs, programInvocationName } from "system";

import "./config";
import "./compositors";
import { handleArguments } from "~/modules/arg-handler";
import { Backlights } from "~/modules/backlight";
import { Clipboard } from "~/modules/clipboard";
import Media from "~/modules/media";
import { NightLight } from "~/modules/nightlight";
import { Notifications } from "~/modules/notifications";
import { Socket } from "~/modules/socket";
import { Stylesheet } from "~/modules/stylesheet";
import { createSubscription, secureBaseBinding } from "~/modules/utils";
import { Wallpaper } from "~/modules/wallpaper";
import { defaultRunnerPlugins } from "~/runner/plugins";
import { Runner } from "~/runner/Runner";
import { OSDModes, triggerOSD } from "~/window/osd";
import { Windows } from "~/windows";

const defaultWindows: Array<string> = ["bar"];

GLib.unsetenv("LD_PRELOAD");

@register({ GTypeName: "Shell" })
export class Shell extends Adw.Application {
	private static instance: Shell;

	#scope!: Scope;
	#connections = new Map<GObject.Object, Array<number> | number>();
	#providers: Array<Gtk.CssProvider> = [];
	#gresource: Gio.Resource | null = null;
	#socketFile!: Gio.File;

	get scope() {
		return this.#scope;
	}

	constructor() {
		super({
			applicationId: "io.github.razen.novashell",
			flags: Gio.ApplicationFlags.HANDLES_COMMAND_LINE,
			version: NOVASHELL_VERSION ?? "0.0.0-unknown",
		});

		setConsoleLogDomain("Novashell");
		GLib.set_application_name("novashell");
	}

	public static getDefault(): Shell {
		if (!Shell.instance) Shell.instance = new Shell();

		return Shell.instance;
	}

	public resetStyle(): void {
		this.#providers.forEach((provider) => {
			Gtk.StyleContext.remove_provider_for_display(
				Gdk.Display.get_default()!,
				provider,
			);
		});
	}

	public removeProvider(provider: Gtk.CssProvider): void {
		if (!this.#providers.includes(provider)) {
			console.warn(
				"Novashell: Couldn't find the provided GtkCssProvider to remove. Was it added before?",
			);
			return;
		}

		for (let i = 0; i < this.#providers.length; i++) {
			const prov = this.#providers[i];
			if (prov === provider) {
				this.#providers.splice(i, 1);
				Gtk.StyleContext.remove_provider_for_display(
					Gdk.Display.get_default()!,
					provider,
				);
				break;
			}
		}
	}

	public applyStyle(stylesheet: string): void {
		try {
			const provider = Gtk.CssProvider.new();
			provider.load_from_string(stylesheet);
			this.#providers.push(provider);

			Gtk.StyleContext.add_provider_for_display(
				Gdk.Display.get_default()!,
				provider,
				Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION,
			);
		} catch (e) {
			console.error(`Novashell: Couldn't apply style. Stderr: ${e}`);
			return;
		}
	}

	vfunc_command_line(cmd: Gio.ApplicationCommandLine): number {
		const args = cmd.get_arguments().toSpliced(0, 1); // remove executable
		const finish = (status: number): number => {
			cmd.set_exit_status(status);
			cmd.done();
			return status;
		};

		if (args[0] === "build") {
			cmd.print_literal("Building novashell...\n");
			try {
				const [, stdout, stderr, status] = GLib.spawn_command_line_sync(
					`sh -c 'cd ${SOURCE_DIR} && pnpm build'`,
				);
				const out = new TextDecoder().decode(stdout ?? new Uint8Array());
				const err = new TextDecoder().decode(stderr ?? new Uint8Array());
				if (status === 0) {
					cmd.print_literal(`Build successful!\n${out}`);
				} else {
					cmd.printerr_literal(
						`Build failed (exit ${status}):\n${err}\n${out}`,
					);
					return finish(1);
				}
			} catch (_e) {
				const e = _e as Error;
				cmd.printerr_literal(`Build error: ${e.message}`);
				return finish(1);
			}
			return finish(0);
		}

		if (cmd.isRemote) {
			try {
				cmd.print_literal(
					"\nNovashell: Remote CLI mode is slower. For fast socket actions use `nsh-msg <command...>`\n" +
						"(for example: `nsh-msg toggle runner`, `nsh-msg volume sink-set 35`).\n" +
						"Use `nsh` when you need output/help text or for startup-only commands like `build`.\n\n",
				);

				const res = handleArguments(cmd, args);
				return finish(res);
			} catch (_e) {
				const e = _e as Error;
				cmd.printerr_literal(
					`Error: something went wrong! Stderr: ${e.message}\n${e.stack}`,
				);
				return finish(1);
			}
		} else {
			if (args.length > 0) {
				cmd.printerr_literal(
					"Error: novashell not running. Try to clean-run before using arguments",
				);
				return finish(1);
			}

			this.activate();
		}

		return 0;
	}

	vfunc_activate(): void {
		super.vfunc_activate();
		this.hold();

		createRoot(() => {
			this.init();
			this.main();
			onCleanup(() => {
				console.log(
					"Novashell: disposing connections and quitting because of ::shutdown",
				);
				this.#connections.forEach((ids, obj) => {
					if (Array.isArray(ids)) {
						ids.forEach((id) => {
							obj.disconnect(id);
						});
						return;
					}

					obj.disconnect(ids);
				});
			});
		});
	}

	private init(): void {
		Adw.init();

		try {
			const gresourcesPath: string = GRESOURCES_FILE.startsWith("/")
				? GRESOURCES_FILE
				: GRESOURCES_FILE.split("/")
						.filter((s) => s !== "")
						.map((path) => {
							if (/^\$/.test(path)) {
								const env = GLib.getenv(path.replace(/^\$/, ""));
								if (env === null)
									throw new Error(`Couldn't get environment variable: ${path}`);

								return env;
							}
							return path;
						})
						.join("/");
			this.#gresource = Gio.Resource.load(gresourcesPath);
			Gio.resources_register(this.#gresource);

			Gtk.IconTheme.get_for_display(
				Gdk.Display.get_default()!,
			).add_resource_path("/io/github/razen/novashell/icons");
		} catch (_e) {
			const e = _e as Error;
			console.error(
				`Error: couldn't load gresource! Stderr: ${e.message}\n${e.stack}`,
			);
		}

		this.#socketFile = Gio.File.new_for_path(
			`${
				GLib.get_user_runtime_dir() ?? `/run/user/${exec("id -u").trim()}`
			}/novashell.sock`,
		);

		const socketServer = new Socket(Socket.Type.SERVER, this.#socketFile);
		socketServer.scopeConnect("received", (data: string) => {
			if (!data || data.length < 1) return;

			try {
				const [success, parsedArgs] = GLib.shell_parse_argv(
					`novashell ${data}`,
				);
				parsedArgs?.splice(0, 1);

				if (success) {
					handleArguments(
						{
							print_literal: (msg) => console.log(msg),
							printerr_literal: (msg) => console.error(msg),
						},
						parsedArgs!,
					);
				}
			} catch (_e) {
				const e = _e as Error;
				console.error(`Novashell socket error: ${e.message}\n${e.stack}`);
			}
		});
	}

	private main(): void {
		this.#scope = getScope();
		this.#connections.set(
			this,
			this.connect("shutdown", () => this.#scope.dispose()),
		);

		NightLight.getDefault();

		Media.getDefault();
		Clipboard.getDefault();

		Wallpaper.getDefault();
		Stylesheet.getDefault();

		defaultRunnerPlugins.forEach((plugin) => {
			Runner.addPlugin(plugin);
		});

		createSubscription(
			createComputed([
				secureBaseBinding<AstalWp.Endpoint>(
					createBinding(AstalWp.get_default(), "defaultSpeaker"),
					"volume",
					null,
				),
				secureBaseBinding<AstalWp.Endpoint>(
					createBinding(AstalWp.get_default(), "defaultSpeaker"),
					"mute",
					null,
				),
			]),
			() =>
				!Windows.getDefault().isOpen("control-center") &&
				triggerOSD(OSDModes.sink),
		);

		createSubscription(
			secureBaseBinding<Backlights.Backlight>(
				createBinding(Backlights.getDefault(), "default"),
				"brightness",
				100,
			),
			() =>
				!Windows.getDefault().isOpen("control-center") &&
				triggerOSD(OSDModes.brightness),
		);

		this.#connections.set(Notifications.getDefault(), [
			Notifications.getDefault().connect("notification-added", () => {
				Windows.getDefault().open("floating-notifications");
			}),
		]);

		defaultWindows.forEach((w) => {
			Windows.getDefault().open(w);
		});
	}

	quit(): void {
		try {
			NightLight.getDefault().stop();
			NightLight.getDefault().applyIdentity();
		} catch (e) {
			console.error(
				`Novashell: Night light cleanup failed: ${(e as Error).message}`,
			);
		}

		this.release();
		super.quit();
		// Gio.Application.quit() only signals the main loop to stop, but
		// active sources (SocketService, IO watches) can prevent GJS from
		// actually exiting. Force-terminate the process.
		exit(0);
	}
}

Shell.getDefault().runAsync([programInvocationName, ...programArgs]);
