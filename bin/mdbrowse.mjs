#!/usr/bin/env node
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { parseArgs } from "../lib/args.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const assetsDir = path.join(__dirname, "..", "assets");
const preloadPath = path.join(__dirname, "..", "lib", "preload.cjs");
const mainScriptPath = path.join(__dirname, "..", "lib", "main-script.cjs");

let options;
try {
  options = parseArgs(process.argv.slice(2));
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
const { file, zoom, bg } = options;
const filePath = path.resolve(file);
const fileDir = path.dirname(filePath);
const fileName = path.basename(filePath);

const terminalBrowserCmd = "terminal-browser";

const WAIT_TIMEOUT_MS = 25000;
const MIME = {
  html: "text/html; charset=utf-8",
  js: "application/javascript",
  css: "text/css",
  woff: "font/woff",
  woff2: "font/woff2",
  ttf: "font/ttf",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  svg: "image/svg+xml",
  webp: "image/webp",
  ico: "image/x-icon",
  bmp: "image/bmp",
  avif: "image/avif",
};

let version = 0;
let content = "";
let waiters = [];

function readContent() {
  content = fs.readFileSync(filePath, "utf8");
  version += 1;
  const pending = waiters;
  waiters = [];
  for (const resolve of pending) resolve(version);
}

try {
  readContent();
} catch (error) {
  console.error(`mdbrowse: cannot read '${file}': ${error.message}`);
  process.exit(1);
}
// Watch the containing directory, not the file itself: editors that save
// atomically (write a temp file, then rename it over the original -- Vim
// and many "safe write" modes) replace the file's inode, and an inotify
// watch on that inode commonly goes silent after the first such save. The
// directory's inode is untouched by a rename inside it, so this survives.
fs.watch(fileDir, { persistent: true }, (eventType, changedFile) => {
  if (changedFile && changedFile !== fileName) return;
  try {
    readContent();
  } catch {
    // file briefly missing mid atomic-save; the next change event will catch up
  }
});

const assetCache = new Map();
function loadAsset(relPath) {
  if (!assetCache.has(relPath)) {
    assetCache.set(relPath, fs.readFileSync(path.join(assetsDir, relPath)));
  }
  return assetCache.get(relPath);
}

const server = http.createServer((req, res) => {
  if (req.method !== "GET") {
    res.writeHead(405, { "Content-Type": "text/plain" });
    res.end("only GET supported");
    return;
  }

  const url = new URL(req.url, "http://localhost");

  if (url.pathname === "/") {
    res.writeHead(200, { "Content-Type": MIME.html });
    res.end(loadAsset("preview.html"));
    return;
  }

  if (url.pathname.startsWith("/vendor/")) {
    const rel = url.pathname.slice(1);
    let asset;
    try {
      asset = loadAsset(rel);
    } catch {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("not found");
      return;
    }
    const ext = path.extname(rel).slice(1);
    res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
    res.end(asset);
    return;
  }

  if (url.pathname === "/content") {
    res.writeHead(200, {
      "Content-Type": "text/plain; charset=utf-8",
      "X-Preview-Version": String(version),
    });
    res.end(content);
    return;
  }

  if (url.pathname === "/wait") {
    const known = Number(url.searchParams.get("v") || "0");
    if (version > known) {
      res.writeHead(200, { "Content-Type": "text/plain" });
      res.end(String(version));
      return;
    }
    const resolve = (v) => {
      clearTimeout(timer);
      res.writeHead(200, { "Content-Type": "text/plain" });
      res.end(String(v));
    };
    const timer = setTimeout(() => {
      waiters = waiters.filter((w) => w !== resolve);
      resolve(version);
    }, WAIT_TIMEOUT_MS);
    waiters.push(resolve);
    req.on("close", () => {
      clearTimeout(timer);
      waiters = waiters.filter((w) => w !== resolve);
    });
    return;
  }

  // Fall back to serving files next to the markdown source, relative to
  // the page's own URL ("/") -- this is how the browser resolves relative
  // image references (e.g. `![](images/foo.png)`) written in the markdown.
  const requestedPath = path.join(fileDir, decodeURIComponent(url.pathname));
  const relativePath = path.relative(fileDir, requestedPath);
  if (relativePath !== "" && (relativePath.startsWith("..") || path.isAbsolute(relativePath))) {
    res.writeHead(403, { "Content-Type": "text/plain" });
    res.end("forbidden");
    return;
  }
  fs.readFile(requestedPath, (error, data) => {
    if (error) {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("not found");
      return;
    }
    const ext = path.extname(requestedPath).slice(1);
    res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
    res.end(data);
  });
});

server.on("error", (err) => {
  console.error(`mdbrowse: server error: ${err.message}`);
  process.exit(1);
});

server.listen(0, "127.0.0.1", () => {
  const port = server.address().port;
  const query = new URLSearchParams({ zoom: String(zoom) });
  if (bg) query.set("bg", bg);
  const url = `http://127.0.0.1:${port}/?${query}`;

  // No --split: terminal-browser's own splitting is unimplemented on
  // Linux+Ghostty (https://github.com/zenbu-labs/terminal-browser/issues/61).
  // This takes over whatever pane invokes mdbrowse, so split your terminal
  // yourself first and run mdbrowse in the new pane.
  const child = spawn(
    terminalBrowserCmd,
    ["open", url, "--app-mode", `--preload=${preloadPath}`, `--main-script=${mainScriptPath}`],
    { stdio: "inherit" }
  );

  child.on("error", (err) => {
    console.error(`mdbrowse: failed to launch '${terminalBrowserCmd}': ${err.message}`);
    server.close();
    process.exit(1);
  });

  child.on("exit", (code) => {
    server.close();
    process.exit(code ?? 0);
  });
});
