const { ipcMain, shell } = require("electron");

const CHANNEL = "mdbrowse:open-external";

// terminal-browser reuses one long-lived process across separate mdbrowse
// panes/sessions, re-requiring this file (via --main-script) each time one
// starts. Guard against piling up duplicate listeners across sessions.
if (ipcMain.listenerCount(CHANNEL) === 0) {
  ipcMain.on(CHANNEL, (_event, url) => {
    if (/^https?:\/\//i.test(url)) shell.openExternal(url);
  });
}
