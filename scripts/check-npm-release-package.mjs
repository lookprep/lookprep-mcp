// Validate the exact tarball the release workflow will publish.
//   node scripts/check-npm-release-package.mjs <npm pack --json output> v<version>
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const [packFile, tag] = process.argv.slice(2);
const [pack] = JSON.parse(readFileSync(packFile, "utf8"));
if (pack.name !== "lookprep-mcp" || `v${pack.version}` !== tag) throw new Error("Packed package name or version mismatch");
const integrity = `sha512-${createHash("sha512").update(readFileSync(pack.filename)).digest("base64")}`;
if (pack.integrity !== integrity) throw new Error("Packed tarball integrity mismatch");
const required = ["package.json", "README.md", "LICENSE", "npm-shrinkwrap.json", "dist/index.js", "dist/bridge.js", "dist/endpoint.js", "dist/instructions.js"];
const files = new Set(pack.files.map(({ path }) => path));
for (const file of required) if (!files.has(file)) throw new Error(`Missing release file: ${file}`);
for (const file of files) {
  if (!required.includes(file)) throw new Error(`Unexpected release file: ${file}`);
}
const read = (path) => JSON.parse(execFileSync("tar", ["-xOf", pack.filename, `package/${path}`], { encoding: "utf8" }));
const pkg = read("package.json");
const lock = read("npm-shrinkwrap.json");
if (pkg.name !== pack.name || pkg.version !== pack.version || pkg.mcpName !== "com.lookprep/lookprep" ||
    lock.version !== pkg.version || lock.packages[""].version !== pkg.version) throw new Error("Packed metadata mismatch");
if (Object.keys(pkg.dependencies ?? {}).join() !== "@modelcontextprotocol/sdk") throw new Error("Unexpected runtime dependencies");
console.log(`OK: ${pack.filename} ${integrity}`);
