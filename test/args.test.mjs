import assert from "node:assert/strict";
import test from "node:test";

import { parseArgs } from "../lib/args.mjs";

test("parses a file and options in either order", () => {
  assert.deepEqual(parseArgs(["--zoom", "1.5", "notes.md", "--bg=#123"]), {
    file: "notes.md",
    zoom: 1.5,
    bg: "#123",
  });
});

test("later options override earlier defaults", () => {
  assert.deepEqual(parseArgs(["--zoom=1.2", "notes.md", "--zoom", "2"]), {
    file: "notes.md",
    zoom: 2,
    bg: null,
  });
});

test("rejects unknown options", () => {
  assert.throws(() => parseArgs(["--bogus"]), /Unknown option '--bogus'/);
});

test("rejects missing option values", () => {
  assert.throws(() => parseArgs(["notes.md", "--bg"]), /Option '--bg <value>' argument missing/);
});

test("rejects extra positional files", () => {
  assert.throws(() => parseArgs(["one.md", "two.md"]), /expected one markdown file, got 2/);
});

test("accepts a filename beginning with a dash after --", () => {
  assert.equal(parseArgs(["--", "--notes.md"]).file, "--notes.md");
});

test("rejects invalid zoom values", () => {
  for (const zoom of ["0", "-1", "nope"]) {
    assert.throws(() => parseArgs(["notes.md", `--zoom=${zoom}`]), /positive number/);
  }
});
