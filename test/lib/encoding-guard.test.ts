import { readdirSync, readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";

import { describe, expect, it } from "vitest";

const ROOT_DIR = resolve(__dirname, "..", "..");
const SOURCE_DIRS = ["app", "components", "lib", "styles", "test"] as const;
const ENCODING_MARKER_CODE_POINTS = [0xc3, 0xc4, 0xc5, 0xc2, 0xfffd] as const;
const ENCODING_MARKERS = new RegExp(
  ENCODING_MARKER_CODE_POINTS.map((codePoint) => String.fromCodePoint(codePoint)).join("|"),
  "u",
);
const TEXT_FILE_PATTERN = /\.(ts|tsx|js|jsx|css|json|md)$/i;

function collectFiles(dir: string): string[] {
  const entries = readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);

    if (entry.isDirectory()) {
      files.push(...collectFiles(fullPath));
      continue;
    }

    if (TEXT_FILE_PATTERN.test(entry.name)) {
      files.push(fullPath);
    }
  }

  return files;
}

describe("encoding guard", () => {
  it("does not leave mojibake markers in app/components/lib/styles/test", () => {
    const hits: string[] = [];

    for (const sourceDir of SOURCE_DIRS) {
      const absoluteDir = join(ROOT_DIR, sourceDir);
      const files = collectFiles(absoluteDir);

      for (const file of files) {
        const contents = readFileSync(file, "utf8");
        if (!ENCODING_MARKERS.test(contents)) continue;

        hits.push(relative(ROOT_DIR, file));
      }
    }

    expect(hits).toEqual([]);
  });
});
