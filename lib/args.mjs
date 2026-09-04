import { parseArgs as parseNodeArgs } from "node:util";

const usage = "usage: mdbrowse <file.md> [--zoom <factor>] [--bg <css-color>]";

export function parseArgs(args) {
  let parsed;
  try {
    parsed = parseNodeArgs({
      args,
      allowPositionals: true,
      options: {
        zoom: { type: "string" },
        bg: { type: "string" },
      },
      strict: true,
    });
  } catch (error) {
    throw new Error(`mdbrowse: ${error.message}\n${usage}`);
  }

  if (parsed.positionals.length === 0) throw new Error(usage);
  if (parsed.positionals.length > 1) {
    throw new Error(`mdbrowse: expected one markdown file, got ${parsed.positionals.length}\n${usage}`);
  }

  const zoom = parsed.values.zoom === undefined ? 1 : Number(parsed.values.zoom);
  if (!Number.isFinite(zoom) || zoom <= 0) {
    throw new Error("mdbrowse: --zoom must be a positive number, e.g. --zoom 1.5");
  }

  return {
    file: parsed.positionals[0],
    zoom,
    bg: parsed.values.bg ?? null,
  };
}
