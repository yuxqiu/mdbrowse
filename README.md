# mdbrowse

Live markdown preview from the terminal, rendered by
[terminal-browser](https://github.com/zenbu-labs/terminal-browser).

## Requirements

- Node.js 18+
- [`terminal-browser`](https://github.com/zenbu-labs/terminal-browser) on
  `$PATH`, run inside a terminal that supports the Kitty graphics protocol
  (kitty, ghostty, WezTerm, etc.)

## Usage

`mdbrowse` takes over whatever pane runs it (same as `terminal-browser open`
without `--split` — terminal-browser's own `--split` is
[unimplemented on Linux+Ghostty](https://github.com/zenbu-labs/terminal-browser/issues/61)).
Split your terminal yourself first, then run it in the new pane:

```sh
mdbrowse notes.md
```

Editing and saving `notes.md` refreshes the preview in place, scrolling to
wherever the file actually changed. Closing the browser (or the pane) exits
`mdbrowse`.

Set the initial zoom level with `--zoom` (a factor, e.g. `1.5` = 150%), and
the page background with `--bg` (any CSS color) to match your own colorscheme:

```sh
mdbrowse notes.md --zoom 1.5 --bg '#1e1e2e'
```

A later flag overrides an earlier one, so wrapping `mdbrowse` with your own
default flags (e.g. in your own Nix config) composes cleanly — anything you
pass explicitly still wins.

### Keybindings

| Key(s) | Action |
| --- | --- |
| `j` / `k` / `Ctrl+e` / `Ctrl+y` | scroll down / up one line |
| `Ctrl+d` / `Ctrl+u` | scroll down / up half a page |
| `Ctrl+f` / `Space`, `Ctrl+b` / `Backspace` | scroll down / up a full page |
| `gg` / `G` | jump to top / bottom |
| `h` / `l` | scroll left / right |
| `0` / `$` | jump to left / right edge |
| `/`, `n` / `N` | search, next / previous match |

## Install with Nix

```sh
nix run . -- notes.md
```

Or add `packages.default` from this flake to your own config, e.g. with
home-manager: `home.packages = [ inputs.mdbrowse.packages.${pkgs.system}.default ];`

## Rebuilding the vendored bundle

`assets/vendor/` (markdown-it, highlight.js, and KaTeX for `$...$`/`$$...$$`
math, all rendered client-side inside terminal-browser's own Chromium) is a
build artifact, not meant to be hand-edited:

```sh
cd build
npm install
npm run build
```

Dev-time only — `build/` is never required to run `mdbrowse` itself.
