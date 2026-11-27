// Offline release preflight: every version field, the package identity and the
// changelog agree with the release tag. Publishing is a separate step.
//   node scripts/check-release-metadata.mjs v<version>
import { readFileSync } from "node:fs";

const tag = process.argv[2];
if (typeof tag !== "string" || !/^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(tag)) {
  throw new Error("Usage: node scripts/check-release-metadata.mjs v<major>.<minor>.<patch>");
}
const version = tag.slice(1);
const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
const pkg = JSON.parse(read("package.json"));
const lock = JSON.parse(read("npm-shrinkwrap.json"));
const server = JSON.parse(read("server.json"));

const problems = [];
const expect = (label, actual, wanted) => {
  if (actual !== wanted) problems.push(`${label} is ${JSON.stringify(actual)}, expected ${JSON.stringify(wanted)}`);
};
expect("package.json version", pkg.version, version);
expect("npm-shrinkwrap.json version", lock.version, version);
expect('npm-shrinkwrap.json packages[""].version', lock.packages?.[""]?.version, version);
expect("server.json version", server.version, version);
const npmPackages = (server.packages ?? []).filter((entry) => entry.registryType === "npm");
expect("server.json npm package count", npmPackages.length, 1);
expect("server.json npm package version", npmPackages[0]?.version, version);
expect("server.json npm package identifier", npmPackages[0]?.identifier, pkg.name);
expect("package.json mcpName", pkg.mcpName, server.name);
if (!new RegExp(`^## ${version.replaceAll(".", "\\.")}( |$)`, "m").test(read("CHANGELOG.md"))) {
  problems.push(`CHANGELOG.md has no "## ${version}" section`);
}
if (problems.length) throw new Error(`Release metadata does not match ${tag}:\n- ${problems.join("\n- ")}`);
console.log(`OK: ${tag} matches package.json, npm-shrinkwrap.json, server.json and CHANGELOG.md`);
