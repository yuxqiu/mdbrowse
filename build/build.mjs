import { build } from "esbuild";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { copyFileSync, cpSync, mkdirSync } from "node:fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, "..", "assets", "vendor");
mkdirSync(outDir, { recursive: true });

await build({
  entryPoints: [join(__dirname, "src", "entry.js")],
  bundle: true,
  minify: true,
  format: "iife",
  target: "es2020",
  outfile: join(outDir, "markdown-it.bundle.js"),
});

const copy = (from, to) => copyFileSync(join(__dirname, "node_modules", from), join(outDir, to));

copy("github-markdown-css/github-markdown.css", "github-markdown.css");
copy("highlight.js/styles/github.min.css", "highlight-light.css");
copy("highlight.js/styles/github-dark.min.css", "highlight-dark.css");
copy("katex/dist/katex.min.css", "katex.min.css");
cpSync(join(__dirname, "node_modules", "katex", "dist", "fonts"), join(outDir, "fonts"), {
  recursive: true,
});

console.log("built assets/vendor/*");
