// Electron main-process entry run by `pixel` (see bin/mdbrowse.mjs). Replaces
// terminal-browser's removed `--app-mode`/`--main-script` flags: mdbrowse now
// owns its own Electron process instead of injecting into terminal-browser's
// shared one, so this script *is* the main process rather than something
// re-required into someone else's.
const path = require("node:path");
const { ipcMain, shell } = require("electron");
const { createRoot } = require("@zenbu-labs/pixel");

ipcMain.on("mdbrowse:open-external", (_event, url) => {
  if (/^https?:\/\//i.test(url)) shell.openExternal(url);
});

// `pixel <entry> -- <url>` forwards everything after `--` onto the entry's
// own process.argv, past the node executable and entry path.
const url = process.argv[2];
const preloadPath = path.join(__dirname, "preload.cjs");

// loadURL() (unlike render()) skips terminal-browser/pixel's own browser
// chrome (toolbar, tabs, address bar) -- this is the direct replacement for
// app-mode's --no-frame/--no-toolbar/--no-overlays/--no-shortcuts.
createRoot().loadURL(url, { preload: preloadPath });
