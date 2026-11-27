#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createBridge } from "./bridge.ts";
import { ALLOW_ANY_ENDPOINT_ENV, ALLOWED_ENDPOINTS, DEFAULT_ENDPOINT, ENDPOINT_ENV, EndpointError, resolveEndpoint } from "./endpoint.ts";

/** Longest wait for a clean shutdown before the bridge exits anyway. */
const SHUTDOWN_GRACE_MS = 1_000;

const { version } = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as { version: string };

const HELP = `lookprep-mcp ${version}

A local stdio MCP server that forwards to LookPrep's hosted, read-only MCP
server at ${DEFAULT_ENDPOINT}. Use it with MCP clients that can only start
local servers; clients that accept a remote server URL can connect to the
hosted server directly.

Usage:
  npx -y lookprep-mcp          start the bridge on stdin/stdout
  npx -y lookprep-mcp --help   show this text
  npx -y lookprep-mcp --version

Environment:
  ${ENDPOINT_ENV}   the hosted endpoint, one of:
                     ${ALLOWED_ENDPOINTS.join("\n                     ")}
  ${ALLOW_ANY_ENDPOINT_ENV}=1   allow any http(s) ${ENDPOINT_ENV}, for testing only

The bridge records nothing and sends requests only to the endpoint above.
More: https://github.com/lookprep/lookprep-mcp
`;

function fail(message: string): never {
  process.stderr.write(`lookprep-mcp: ${message}\n`);
  process.exit(2);
}

async function main(args: readonly string[]) {
  if (args.includes("--help") || args.includes("-h")) {
    process.stdout.write(HELP);
    return;
  }
  if (args.includes("--version") || args.includes("-v")) {
    process.stdout.write(`${version}\n`);
    return;
  }
  if (args.length > 0) fail(`unknown argument ${JSON.stringify(args[0]).slice(0, 64)}. Run with --help.`);

  let endpoint: URL;
  try {
    const resolved = resolveEndpoint();
    endpoint = resolved.url;
    if (resolved.custom) process.stderr.write(`lookprep-mcp: forwarding to ${endpoint.href} (${ALLOW_ANY_ENDPOINT_ENV}=1).\n`);
  } catch (error) {
    if (error instanceof EndpointError) fail(error.message);
    throw error;
  }

  const bridge = createBridge({ endpoint, version });
  let stopping = false;
  const stop = async () => {
    if (stopping) return;
    stopping = true;
    // Hard guard: exit even if closing hangs on the network. Unref'd, so it never keeps the process alive.
    setTimeout(() => process.exit(0), SHUTDOWN_GRACE_MS).unref();
    await bridge.close();
    process.exit(0);
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
  process.stdin.on("end", stop);
  process.stdin.on("close", stop);

  await bridge.start(new StdioServerTransport());
}

main(process.argv.slice(2)).catch((error) => {
  fail(error instanceof Error ? error.message : String(error));
});
