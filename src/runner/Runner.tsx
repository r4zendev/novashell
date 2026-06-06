import AstalHyprland from "gi://AstalHyprland";
import type GLib from "gi://GLib?version=2.0";

import { type CCProps, createRoot } from "ags";
import { Astal, Gdk, Gtk } from "ags/gtk4";

import { updateApps } from "~/modules/apps";
import {
	ResultWidget,
	type ResultWidgetProps,
} from "~/runner/widgets/ResultWidget";
import { getPopupWindowContainer, PopupWindow } from "~/widget/PopupWindow";
import { Windows } from "~/windows";

export namespace Runner {
	export type RunnerProps = {
		halign?: Gtk.Align;
		valign?: Gtk.Align;
		width?: number;
		height?: number;
		entryPlaceHolder?: string;
		initialText?: string;
		resultsLimit?: number;
		showResultsPlaceHolderOnStartup?: boolean;
	};

	export type Result = CCProps<ResultWidget, ResultWidgetProps>;

	export interface Plugin {
		/** prefix to call the plugin. if undefined, will be triggered like applications plugin */
		readonly prefix?: string;
		/** name of the plugin. e.g.: websearch, shell */
		readonly name?: string;
		/** runs when runner opens */
		readonly init?: () => void;
		/** handle the user input to return results (does not include plugin's prefix) */
		readonly handle: (
			inputText: string,
			limit?: number,
		) =>
			| Promise<Result | Array<Result> | null | undefined>
			| Result
			| Array<Result>
			| null
			| undefined;
		/** runs when runner closes */
		readonly onClose?: () => void;
		/** prioritize this plugin's results over other results.
		 * (hides other results that aren't from this plugin on list) */
		prioritize?: boolean;
		/** show a specific icon when the plugin is prioritized/only
		 * has results from this plugin
		 * @todo actually implement the plugin icon feature
		 * @default "system-search-symbolic" */
		iconName?: string;
	}

	export let instance: Astal.Window | null = null;

	let gtkEntry: Gtk.Entry | null = null;
	const plugins = new Set<Runner.Plugin>();
	const ignoredKeys = new Set([
		Gdk.KEY_space,
		Gdk.KEY_Shift_L,
		Gdk.KEY_Shift_R,
		Gdk.KEY_Shift_Lock,
		Gdk.KEY_Return,
		Gdk.KEY_Tab,
		Gdk.KEY_Control_L,
		Gdk.KEY_Control_R,
		Gdk.KEY_Alt_L,
		Gdk.KEY_Alt_R,
		Gdk.KEY_Option,
		Gdk.KEY_Super_L,
		Gdk.KEY_Super_R,
		Gdk.KEY_F5,
		Gdk.KEY_Up,
		Gdk.KEY_Down,
		Gdk.KEY_Left,
		Gdk.KEY_Right,
	]);

	export function close() {
		instance?.close();
	}

	export function addPlugin(plugin: Runner.Plugin, force?: boolean) {
		if (!force && plugin.prefix && plugins.has(plugin))
			throw new Error(
				`Runner plugin with prefix ${plugin.prefix} already exists`,
			);

		plugins.delete(plugin);
		plugins.add(plugin);
	}

	export function getPlugins(): Array<Runner.Plugin> {
		return [...plugins.values()];
	}

	/** Removes a plugin from the runner plugins list
	 * @returns true if plugin was removed or false if plugin wasn't found
	 */
	export function removePlugin(plugin: Plugin): boolean {
		return plugins.delete(plugin);
	}

	export function setEntryText(text: string): void {
		if (!gtkEntry) return;

		gtkEntry.set_text(text);
		gtkEntry.set_position(gtkEntry.text.length);
		gtkEntry.grab_focus_without_selecting();
	}

	export function openDefault(initialText?: string) {
		return Runner.openRunner(
			{
				entryPlaceHolder: "Start typing...",
				initialText,
				showResultsPlaceHolderOnStartup: false,
				resultsLimit: 24,
			} as Runner.RunnerProps,
			[
				{
					icon: "application-x-executable-symbolic",
					title: "Use your applications",
					description: "Search for any app installed in your computer",
					closeOnClick: false,
					actionClick: () => gtkEntry?.grab_focus(),
				},
				{
					icon: "edit-paste-symbolic",
					title: "See your clipboard history",
					description:
						"Start your search with '>' to go through your clipboard history",
					closeOnClick: false,
					actionClick: () => setEntryText(">"),
				},
				{
					icon: "image-x-generic-symbolic",
					title: "Change your wallpaper",
					description:
						"Add '#' at the start to search through the wallpapers folder!",
					closeOnClick: false,
					actionClick: () => setEntryText("#"),
				},
				{
					icon: "utilities-terminal-symbolic",
					title: "Run shell commands",
					description:
						"Add '!' before your command to run it (tip: add another '!' to notify command output)",
					closeOnClick: false,
					actionClick: () => setEntryText("!"),
				},
				{
					icon: "media-playback-start-symbolic",
					title: "Control media",
					description: "Type ':' to control playing media",
					closeOnClick: false,
					actionClick: () => setEntryText(":"),
				},
				{
					icon: "applications-internet-symbolic",
					title: "Search the Web",
					description: "Start typing with '?' prefix to search the web",
					closeOnClick: false,
					actionClick: () => setEntryText("?"),
				},
				{
					icon: "preferences-color-symbolic",
					title: "Change theme",
					description: "Type '@' to browse and apply color themes",
					closeOnClick: false,
					actionClick: () => setEntryText("@"),
				},
				{
					icon: "preferences-color-symbolic",
					title: "Convert colors",
					description:
						"Type '~' followed by a color (hex, rgb, hsl, oklch, etc.) to convert between formats",
					closeOnClick: false,
					actionClick: () => setEntryText("~"),
				},
			],
		);
	}

	async function getPluginResults(
		input: string,
		limit?: number,
	): Promise<Array<Result>> {
		let calledPlugins: Array<Plugin> = getPlugins()
			.filter((plugin) =>
				plugin.prefix ? (input.startsWith(plugin.prefix) ? true : false) : true,
			)
			.sort((plugin) => (plugin.prefix != null ? 0 : 1));

		for (const plugin of calledPlugins) {
			if (plugin.prioritize) {
				calledPlugins = [plugin];
				break;
			}
		}

		const results: Array<Result> = [];
		function push(
			result:
				| Result
				| null
				| undefined
				| void
				| Array<Result | null | undefined | void>,
		) {
			if (Array.isArray(result)) {
				results.push(...result.filter((r) => r != null));
				return;
			}

			result && results.push(result);
		}

		for (const plugin of calledPlugins) {
			const res = plugin.handle(
				plugin.prefix ? input.replace(plugin.prefix, "") : input,
				limit,
			);

			res instanceof Promise ? await res.then(push) : push(res);
		}

		return limit !== undefined && limit > 0 && limit !== Infinity
			? results.splice(0, limit)
			: results;
	}

	async function updateResultsList(
		listbox: Gtk.ListBox,
		input: string,
		limit?: number,
		placeholders?: Array<Result>,
		shouldApply: () => boolean = () => true,
	): Promise<boolean> {
		const newResults: Array<Result> = [],
			scrolledWindow = listbox.parent.parent as Gtk.ScrolledWindow;
		let hasError = false;
		let errorMessage = "";

		const results = await getPluginResults(input, limit).catch((e: Error) => {
			hasError = true;
			errorMessage = e.message;
			console.error(
				`Couldn't get results because of an error: ${e.message}\n${e.stack}`,
			);

			return [] satisfies Array<Result>;
		});

		if (!shouldApply()) return false;

		listbox.remove_all();

		if (hasError) {
			listbox.insert(
				(
					<ResultWidget
						title={`Error: ${errorMessage}`}
						description={"Try changing your search a little..."}
						icon={"window-close-symbolic"}
						actionClick={() =>
							gtkEntry?.select_region(0, gtkEntry?.text.length - 1)
						}
					/>
				) as ResultWidget,
				-1,
			);
		}

		results.forEach((result) => {
			listbox.insert(
				createRoot(
					(dispose) =>
						(
							<ResultWidget
								{...result}
								onDestroy={(self) => {
									result.onDestroy?.(self);
									dispose();
								}}
							/>
						) as ResultWidget,
				),
				-1,
			);
			newResults.push(result);
		});

		// Insert placeholder if there are no results
		if (placeholders && newResults.length < 1)
			placeholders.forEach((phdlr) => {
				listbox.insert((<ResultWidget {...phdlr} />) as ResultWidget, -1);
			});

		newResults.length > 0
			? !scrolledWindow.visible && scrolledWindow.show()
			: scrolledWindow.hide();

		return true;
	}

	function selectItemN(
		listbox: Gtk.ListBox,
		direction: "prev" | "next",
		count: number,
	) {
		for (let i = 0; i < count; i++) selectItem(listbox, direction);
	}

	function selectItem(listbox: Gtk.ListBox, direction: "prev" | "next") {
		const selectedRow = listbox.get_selected_row();
		const targetRow =
			direction === "prev"
				? selectedRow?.get_prev_sibling()
				: selectedRow?.get_next_sibling();

		const boundary =
			direction === "prev"
				? listbox.get_first_child()
				: listbox.get_last_child();

		if (!targetRow || selectedRow === boundary) return;

		const viewport = listbox.parent as Gtk.Viewport;
		const vadjustment = (
			viewport.parent as Gtk.ScrolledWindow
		).get_vadjustment();

		listbox.select_row(targetRow as Gtk.ListBoxRow);

		// emit ResultWidget ::selected / ::unselected
		const selectedChild = selectedRow?.get_child();
		const targetChild = (targetRow as Gtk.ListBoxRow).get_child();

		if (selectedChild instanceof ResultWidget) {
			selectedChild.emit("unselected");
		}

		if (targetChild instanceof ResultWidget) {
			targetChild.emit("selected");
		}

		if (direction === "prev") {
			const [, , targetRowY] = targetRow.translate_coordinates(
				viewport,
				targetRow.get_allocation().x,
				targetRow.get_allocation().y,
			);

			if (targetRowY < vadjustment.get_value())
				vadjustment.set_value(targetRowY);
		} else {
			const targetRowVAllocation =
				targetRow.get_allocation().y + targetRow.get_allocation().height;

			if (targetRowVAllocation > viewport.get_allocation().height)
				vadjustment.set_value(
					targetRow.get_allocation().y -
						viewport.get_allocation().height +
						targetRow.get_allocation().height,
				);
		}
	}

	export function openRunner(
		props: RunnerProps,
		placeholders?: Array<Result>,
	): Astal.Window {
		props.width ??= 780;
		props.height ??= 420;

		let clickTimeout: GLib.Source | undefined;
		let resultsUpdateToken = 0;

		const getListboxFromPopup = (self: Astal.Window): Gtk.ListBox =>
			(
				(
					getPopupWindowContainer(self).get_last_child() as Gtk.ScrolledWindow
				).get_child() as Gtk.Viewport
			).get_child() as Gtk.ListBox;

		const getListboxFromEntry = (self: Gtk.Entry): Gtk.ListBox =>
			(
				(
					self.get_next_sibling() as Gtk.ScrolledWindow
				).get_child() as Gtk.Viewport
			).get_child() as Gtk.ListBox;

		const runSelectedResultAction = (
			widget: Gtk.Widget | null | undefined,
		): void => {
			if (!(widget instanceof ResultWidget) || clickTimeout) return;

			clickTimeout = setTimeout(() => {
				clickTimeout = undefined;
			}, 250);

			widget.actionClick?.();
			if (widget.closeOnClick) Runner.close();
		};

		if (!instance)
			instance = Windows.getDefault().createWindowForFocusedMonitor(
				(mon, root) =>
					(
						<PopupWindow
							namespace={"runner"}
							monitor={mon}
							widthRequest={props.width}
							heightRequest={props.height}
							exclusivity={Astal.Exclusivity.IGNORE}
							halign={Gtk.Align.CENTER}
							marginTop={
								AstalHyprland.get_default().get_monitor(mon)?.height / 2 -
								props.height! / 2
							}
							valign={Gtk.Align.START}
							hexpand
							orientation={Gtk.Orientation.VERTICAL}
							$={() => {
								plugins.forEach((plugin) => {
									plugin.init?.();
								});

								props.initialText && Runner.setEntryText(props.initialText);

								// Trigger initial results (frecency-sorted apps)
								gtkEntry?.notify("text");
							}}
							actionKeyPressed={(self, keyval) => {
								const listbox = getListboxFromPopup(self);

								switch (keyval) {
									case Gdk.KEY_F5:
										updateApps();
										return;

									case Gdk.KEY_Left:
									case Gdk.KEY_Up:
										selectItem(listbox, "prev");
										gtkEntry?.grab_focus();
										return;

									case Gdk.KEY_Right:
									case Gdk.KEY_Down:
										selectItem(listbox, "next");
										gtkEntry?.grab_focus();
										return;
								}

								if (ignoredKeys.has(keyval)) return;

								if (!gtkEntry?.hasFocus) {
									gtkEntry?.grab_focus();
									listbox.grab_focus();
								}
							}}
							actionClosed={() => {
								[...plugins.values()].forEach((plugin) => {
									plugin?.onClose?.();
								});
								root.dispose();

								instance = null;
								gtkEntry = null;
							}}
						>
							<Gtk.Entry
								class={"search"}
								placeholderText={props.entryPlaceHolder ?? ""}
								$={(self) => {
									gtkEntry = self;

									const entryKeyController = Gtk.EventControllerKey.new();
									entryKeyController.set_propagation_phase(Gtk.PropagationPhase.CAPTURE);
									entryKeyController.connect("key-pressed", (_, keyval, _keycode, state) => {
										const ctrl = (state & Gdk.ModifierType.CONTROL_MASK) !== 0;
										if (!ctrl) return false;

										const listbox = getListboxFromEntry(self);
										const navigate = (direction: "prev" | "next", steps = 1) => {
											if (steps <= 1) selectItem(listbox, direction);
											else selectItemN(listbox, direction, steps);
											self.grab_focus();
										};

										switch (keyval) {
											case Gdk.KEY_j:
												navigate("next");
												return true;
											case Gdk.KEY_k:
												navigate("prev");
												return true;
											case Gdk.KEY_d:
												navigate("next", 5);
												return true;
											case Gdk.KEY_u:
												navigate("prev", 5);
												return true;
										}

										return false;
									});
									self.add_controller(entryKeyController);
								}}
								onNotifyText={(self) => {
									const listbox = getListboxFromEntry(self);
									const requestId = ++resultsUpdateToken;
									const shouldApply = () =>
										requestId === resultsUpdateToken && gtkEntry === self;

									updateResultsList(
										listbox,
										self.text,
										props.resultsLimit,
										placeholders,
										shouldApply,
									).then((applied) => {
										if (!applied) return;

										const firstResult = listbox.get_row_at_index(0);
										if (firstResult) {
											listbox.select_row(firstResult);
											(firstResult.get_child() as ResultWidget).emit(
												"selected",
											);
										}
									});
								}}
								primaryIconName={"system-search-symbolic"}
								primaryIconTooltipText={"Search"}
								secondaryIconName={"edit-clear-symbolic"}
								secondaryIconTooltipText={"Clear search"}
								onIconRelease={(self, iconPos) => {
									if (iconPos === Gtk.EntryIconPosition.PRIMARY) {
										self.notify("text"); // emit notify::text, so it will force-search again
										return;
									}

									self.set_text("");
								}}
								onActivate={(self) => {
									const listbox = getListboxFromEntry(self);
									runSelectedResultAction(
										listbox.get_selected_row()?.get_child(),
									);
								}}
							/>
							<Gtk.ScrolledWindow
								class={"results-scrollable"}
								vscrollbarPolicy={Gtk.PolicyType.AUTOMATIC}
								hscrollbarPolicy={Gtk.PolicyType.NEVER}
								hexpand
								vexpand
								propagateNaturalHeight
								visible={false}
								maxContentHeight={props.height}
								focusable={false}
							>
								<Gtk.ListBox
									hexpand
									activateOnSingleClick
									selectionMode={Gtk.SelectionMode.SINGLE}
									onRowSelected={(_, row) => {
										if (row instanceof ResultWidget) {
											row.grab_focus();
											gtkEntry?.grab_focus_without_selecting();
										}
									}}
									onRowActivated={(_, row) => {
										runSelectedResultAction(row.get_child());
									}}
								/>
							</Gtk.ScrolledWindow>
						</PopupWindow>
					) as Astal.Window,
			)();

		return instance!;
	}
}
