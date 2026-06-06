export const helpMessage = `
Manage shell windows and services.

Window Management:
  open [window]: opens the specified window.
  close [window]: closes all instances of specified window.
  toggle [window]: toggle-open/close the specified window.
  windows: list shell windows and their respective status.
  reload: quit this instance and start a new one.
  reopen: restart all open-windows.
  quit: exit the main instance of the shell.

Audio Controls:
  volume: speaker and microphone volume controller, see "volume help".

Media Controls:
  media: manage novashell's active player, see "media help".
${
	DEVEL
		? `
Development Tools:
  dev: tools to help debugging novashell
`
		: ""
}
Theme & Wallpaper:
  theme: manage themes, see "theme help".
  wallpaper: manage wallpaper, see "wallpaper help".

Other options:
  runner [initial_text]: open the application runner, optionally add an initial search.
  run app[.desktop] [client_modifiers]: run applications from the cli, see "run help".
  peek-workspace-num [millis]: peek the workspace numbers on bar window.
  build: rebuild novashell from source.
  v, version: display current novashell version.
  h, help: shows this help message.

Tip: use shell completion with "nsh <TAB>" for guided subcommands.
`.trim();

export function getVersionMessage(): string {
	return `novashell version ${NOVASHELL_VERSION}${DEVEL ? " (devel)" : ""}`;
}
