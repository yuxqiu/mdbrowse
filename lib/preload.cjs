// Restores vim-style `q` and Ctrl+Q to close the window. `--app-mode`
// implies `--no-shortcuts`, which stops terminal-browser's own
// browser-level shortcuts (including its default Ctrl+Q) so all keys reach
// the page instead -- mdbrowse's own vim-style bindings don't claim either
// key, so this preload is what wires them back up. It listens here rather
// than via the page's own Mousetrap bindings (assets/preview.html) because
// globalThis.terminalBrowser is only documented as reachable from this
// preload's own isolated-world context. The search box's keydown handler
// already calls stopPropagation() for every key while focused, so typing
// "q" into a search query never reaches this listener.
window.addEventListener("keydown", (event) => {
  if (event.metaKey || event.shiftKey || event.altKey || event.key.toLowerCase() !== "q") return;
  event.preventDefault();
  globalThis.terminalBrowser?.quit();
});

// Markdown links must open in the user's actual system browser, not
// navigate the terminal-browser pane away from the preview (its default
// behavior for a plain, un-targeted <a> click). The tab window this preload
// runs in has sandbox:true (terminal-browser's own webPreferences), so
// require("electron") only exposes a small allowlist -- ipcRenderer is on
// it, shell is not. Opening a URL externally needs shell.openExternal from
// the main process, so this forwards the URL over IPC to lib/main-script.cjs
// (--main-script) instead of calling shell directly. Capture phase so this
// runs before terminal-browser's own click handling.
document.addEventListener(
  "click",
  (event) => {
    const link = event.target.closest && event.target.closest("a[href]");
    if (!link || !/^https?:\/\//i.test(link.href)) return;
    event.preventDefault();
    require("electron").ipcRenderer.send("mdbrowse:open-external", link.href);
  },
  true
);
