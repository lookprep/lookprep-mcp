// Offline structural check of server.json for the official MCP Registry.
// The release workflow also runs the Registry's own `mcp-publisher validate`.
import { readFileSync } from "node:fs";

const SCHEMA = "https://static.modelcontextprotocol.io/schemas/2025-12-11/server.schema.json";
const ENDPOINT = "https://mcp.lookprep.com/mcp";
const server = JSON.parse(readFileSync(new URL("../server.json", import.meta.url), "utf8"));
const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));

const problems = [];
const check = (ok, message) => ok || problems.push(message);
const allowedTop = ["$schema", "name", "title", "description", "websiteUrl", "repository", "icons", "version", "remotes", "packages"];
check(server.$schema === SCHEMA, `$schema must be ${SCHEMA}`);
check(server.name === "com.lookprep/lookprep", "name must be com.lookprep/lookprep");
check(typeof server.description === "string" && server.description.length >= 1 && server.description.length <= 100, "description must be 1 to 100 characters");
check(typeof server.title === "string" && server.title.length <= 100, "title must be at most 100 characters");
check(/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(server.version), "version must be MAJOR.MINOR.PATCH");
check(server.websiteUrl === "https://lookprep.com", "websiteUrl must be https://lookprep.com");
check(server.repository?.url === "https://github.com/lookprep/lookprep-mcp" && server.repository?.source === "github", "repository must be github.com/lookprep/lookprep-mcp");
check(Object.keys(server).every((key) => allowedTop.includes(key)), `only ${allowedTop.join(", ")} are expected at the top level`);
check(Array.isArray(server.icons) && server.icons.every((icon) => /^https:\/\/\S+$/.test(icon.src) && icon.src.length <= 255), "icons must be https URLs");
check(Array.isArray(server.remotes) && server.remotes.length === 1, "exactly one remote");
check(server.remotes?.[0]?.type === "streamable-http" && server.remotes?.[0]?.url === ENDPOINT, `the remote must be streamable-http at ${ENDPOINT}`);
check(Array.isArray(server.packages) && server.packages.length === 1, "exactly one package");
const [npm] = server.packages ?? [];
check(npm?.registryType === "npm" && npm?.registryBaseUrl === "https://registry.npmjs.org", "the package must be on npm");
check(npm?.identifier === pkg.name && npm?.version === server.version, "the package must be this package at the server.json version");
check(npm?.transport?.type === "stdio", "the package transport must be stdio");
check(pkg.mcpName === server.name, "package.json mcpName must equal the server name (the Registry checks it on npm)");
check(pkg.version === server.version, "package.json and server.json must carry the same version");
if (problems.length) throw new Error(`server.json:\n- ${problems.join("\n- ")}`);
console.log(`OK: server.json ${server.name} ${server.version}`);
