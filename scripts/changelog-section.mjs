// Print the CHANGELOG.md section of one version, for the GitHub Release notes.
//   node scripts/changelog-section.mjs <version>
import { readFileSync } from "node:fs";

const version = process.argv[2];
if (!/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(version ?? "")) {
  throw new Error("Usage: node scripts/changelog-section.mjs <major>.<minor>.<patch>");
}
const lines = readFileSync(new URL("../CHANGELOG.md", import.meta.url), "utf8").split("\n");
const start = lines.findIndex((line) => line === `## ${version}` || line.startsWith(`## ${version} `));
if (start === -1) throw new Error(`CHANGELOG.md has no "## ${version}" section`);
const end = lines.findIndex((line, index) => index > start && line.startsWith("## "));
const body = lines.slice(start + 1, end === -1 ? undefined : end).join("\n").trim();
if (!body) throw new Error(`The CHANGELOG.md section for ${version} is empty`);
process.stdout.write(`${body}\n`);
