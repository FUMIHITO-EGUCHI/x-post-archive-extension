import fs from "fs";
import path from "path";

const repoRoot = process.cwd();
const contentScriptsDir = path.join(repoRoot, ".output", "chrome-mv3", "content-scripts");
const markerBytes = Buffer.from([0xef, 0xbf, 0xbf]);

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
}

if (!fs.existsSync(contentScriptsDir)) {
  fail(
    "Missing .output/chrome-mv3/content-scripts. Run `npm run build` before checking content script bundles."
  );
} else {
  const files = fs
    .readdirSync(contentScriptsDir)
    .filter((entry) => entry.endsWith(".js"))
    .map((entry) => path.join(contentScriptsDir, entry));

  if (files.length === 0) {
    fail("No built content script bundles were found under .output/chrome-mv3/content-scripts.");
  } else {
    const failures = [];

    for (const file of files) {
      const buffer = fs.readFileSync(file);
      const text = buffer.toString("utf8");
      const matchedMarkers = [];

      if (/\bDexieError\b/u.test(text)) {
        matchedMarkers.push("DexieError");
      }

      if (/\bDexie\b/u.test(text)) {
        matchedMarkers.push("Dexie");
      }

      if (text.includes("\uFFFF")) {
        matchedMarkers.push("U+FFFF");
      }

      if (buffer.includes(markerBytes)) {
        matchedMarkers.push("0xEFBFBF");
      }

      if (matchedMarkers.length > 0) {
        failures.push(`${path.relative(repoRoot, file)} -> ${matchedMarkers.join(", ")}`);
      }
    }

    if (failures.length > 0) {
      fail("Content script bundle guard failed:\n" + failures.map((line) => `- ${line}`).join("\n"));
    } else {
      process.stdout.write(`content script bundle guard passed for ${files.length} file(s)\n`);
    }
  }
}
