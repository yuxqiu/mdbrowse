// Restores vim-style `q` (Ctrl+Q reaches the page by default; pixel's own
// browser chrome, which would otherwise claim shortcuts, is skipped entirely
// by loadURL() in lib/pixel-entry.cjs). It listens here rather than via the
// page's own Mousetrap bindings (assets/preview.html) because navigating to
// pixel's quit URL below only works from this preload's isolated-world
// context. The search box's keydown handler already calls
// stopPropagation() for every key while focused, so typing "q" into a
// search query never reaches this listener.
window.addEventListener("keydown", (event) => {
  if (event.metaKey || event.shiftKey || event.altKey || event.key.toLowerCase() !== "q") return;
  event.preventDefault();
  // pixel's reserved quit URL (@zenbu-labs/pixel's exported QUIT_URL): the
  // host intercepts navigation to it and closes the app, in place of a
  // quit() global.
  window.location.href = "pixel://quit";
});

// Markdown links must open in the user's actual system browser, not
// navigate the preview pane away (the default for a plain, un-targeted <a>
// click). This WebView runs with sandbox:true, so require("electron") only
// exposes a small allowlist -- ipcRenderer is on it, shell is not. Opening a
// URL externally needs shell.openExternal from the main process, so this
// forwards the URL over IPC to lib/pixel-entry.cjs instead of calling shell
// directly. Capture phase so this runs before the page's own click handling.
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
