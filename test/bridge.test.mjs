// The built bridge (dist/), against a stand-in for the hosted server. The
// stdio tests talk raw JSON-RPC to the spawned bridge, so they see exactly
// what a client receives; the in-process tests use the SDK's in-memory
// transport with short timeouts. No request leaves the machine.
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createServer } from "node:net";
import { createInterface } from "node:readline";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { CallToolResultSchema, ListToolsResultSchema } from "@modelcontextprotocol/sdk/types.js";
import { createBridge } from "../dist/bridge.js";
import { INSTRUCTIONS } from "../dist/instructions.js";
import { FAKE_TOOLS, startFakeRemote, startSilentRemote } from "./fake-remote.mjs";

const entry = fileURLToPath(new URL("../dist/index.js", import.meta.url));
const { version } = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const INITIALIZE = { protocolVersion: "2025-11-25", capabilities: {}, clientInfo: { name: "raw-test", version: "1.0.0" } };

function bridgeEnv(url) {
  return { PATH: process.env.PATH ?? "", LOOKPREP_MCP_URL: url, LOOKPREP_MCP_ALLOW_ANY_ENDPOINT: "1" };
}

/** The bridge as a child process, spoken to in raw newline-delimited JSON-RPC. */
function rawBridge(t, url) {
  const child = spawn(process.execPath, [entry], { env: bridgeEnv(url), stdio: ["pipe", "pipe", "pipe"] });
  let stderr = "";
  child.stderr.on("data", (chunk) => (stderr += chunk));
  const pending = new Map();
  createInterface({ input: child.stdout }).on("line", (line) => {
    const message = JSON.parse(line);
    pending.get(message.id)?.(message);
    pending.delete(message.id);
  });
  const exited = new Promise((resolve) => child.on("exit", (code, signal) => resolve({ code, signal })));
  t.after(() => child.kill("SIGKILL"));
  let nextId = 1;
  return {
    child,
    exited,
    stderr: () => stderr,
    request(method, params = {}) {
      const id = nextId++;
      const answer = new Promise((resolve) => pending.set(id, resolve));
      child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id, method, params })}\n`);
      return answer;
    },
    notify(method, params = {}) {
      child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", method, params })}\n`);
    },
    async handshake() {
      const answer = await this.request("initialize", INITIALIZE);
      this.notify("notifications/initialized");
      return answer;
    },
  };
}

/** The bridge in this process, with an SDK client on an in-memory transport. */
async function inProcess(t, url, options = {}) {
  const bridge = createBridge({ endpoint: new URL(url), version, log: () => {}, ...options });
  const [clientSide, bridgeSide] = InMemoryTransport.createLinkedPair();
  await bridge.start(bridgeSide);
  const client = new Client({ name: "in-process-test", version: "1.0.0" });
  await client.connect(clientSide);
  t.after(async () => {
    await client.close();
    await bridge.close();
  });
  return client;
}

/** A loopback port with nothing listening on it. */
async function freePort() {
  const probe = createServer();
  await new Promise((resolve) => probe.listen(0, "127.0.0.1", resolve));
  const { port } = probe.address();
  await new Promise((resolve) => probe.close(resolve));
  return port;
}

const initializeCount = (remote) => remote.requests.filter((request) => request.message?.method === "initialize").length;

test("initialize is answered locally with the bridge's identity and the hosted server's instructions", async (t) => {
  const remote = await startFakeRemote();
  t.after(remote.close);
  const bridge = rawBridge(t, remote.url);
  const { result } = await bridge.handshake();
  assert.equal(result.protocolVersion, "2025-11-25");
  assert.deepEqual(result.serverInfo, { name: "lookprep-mcp", title: "LookPrep", version });
  assert.deepEqual(result.capabilities, { tools: { listChanged: false } });
  assert.equal(result.instructions, INSTRUCTIONS);
});

test("tools/list reaches the client as raw JSON, unknown fields included", async (t) => {
  const remote = await startFakeRemote();
  t.after(remote.close);
  const bridge = rawBridge(t, remote.url);
  await bridge.handshake();
  const { result } = await bridge.request("tools/list");
  assert.deepEqual(result.tools, FAKE_TOOLS, "every tool field, annotation and nested value as the server sent it");
  assert.equal(result.futureListField, "kept");
});

test("tools/call forwards the arguments and returns the result, unknown top-level fields included", async (t) => {
  const remote = await startFakeRemote();
  t.after(remote.close);
  const bridge = rawBridge(t, remote.url);
  await bridge.handshake();
  const echoed = await bridge.request("tools/call", { name: "echo", arguments: { text: "russian" } });
  assert.deepEqual(echoed.result, {
    content: [{ type: "text", text: '{"text":"russian"}' }],
    structuredContent: { text: "russian" },
    isError: false,
    futureResultField: "kept",
  });
  const failed = await bridge.request("tools/call", { name: "fails", arguments: {} });
  assert.equal(failed.result.isError, true);
  assert.match(failed.result.content[0].text, /Unknown style/);
  const call = remote.requests.find((request) => request.message?.params?.name === "echo");
  assert.deepEqual(call.message.params.arguments, { text: "russian" });
});

test("a JSON-RPC error from the hosted server passes through with its code and message, without a doubled prefix", async (t) => {
  const remote = await startFakeRemote();
  t.after(remote.close);
  const bridge = rawBridge(t, remote.url);
  await bridge.handshake();
  const { error } = await bridge.request("tools/call", { name: "no_such_tool", arguments: {} });
  assert.equal(error.code, -32602);
  assert.equal(error.message, "Unknown tool.");
});

test("a rate-limited request is reported in plain words and the next one works", async (t) => {
  const remote = await startFakeRemote();
  t.after(remote.close);
  const bridge = rawBridge(t, remote.url);
  await bridge.handshake();
  const { error } = await bridge.request("tools/call", { name: "limited", arguments: {} });
  assert.match(error.message, /limiting requests right now\. Wait a minute/);
  const echoed = await bridge.request("tools/call", { name: "echo", arguments: {} });
  assert.equal(echoed.result.isError, false);
});

test("an answer the bridge cannot read has its own message and keeps the connection", async (t) => {
  const remote = await startFakeRemote();
  t.after(remote.close);
  const bridge = rawBridge(t, remote.url);
  await bridge.handshake();
  const { error } = await bridge.request("tools/call", { name: "garbled", arguments: {} });
  assert.match(error.message, /sent an answer the bridge could not read/);
  assert.doesNotMatch(error.message, /Could not reach/);
  const echoed = await bridge.request("tools/call", { name: "echo", arguments: {} });
  assert.equal(echoed.result.isError, false);
  assert.equal(initializeCount(remote), 1, "no reconnection");
});

test("a tool result that is not a valid MCP tool result is reported in plain words as an internal error", async (t) => {
  const remote = await startFakeRemote();
  t.after(remote.close);
  const bridge = rawBridge(t, remote.url);
  await bridge.handshake();
  const { error } = await bridge.request("tools/call", { name: "invalid", arguments: {} });
  assert.equal(error.code, -32603);
  assert.match(error.message, /sent an answer the bridge could not read \(the tool result is not a valid MCP tool result\)/);
  assert.doesNotMatch(error.message, /Invalid tools\/call result|expected/);
});

test("with the hosted server unreachable the bridge starts, explains the failure and connects later", async (t) => {
  const port = await freePort();
  const bridge = rawBridge(t, `http://127.0.0.1:${port}/mcp`);
  await bridge.handshake();
  const { error } = await bridge.request("tools/list");
  assert.match(error.message, /Could not reach the LookPrep MCP server at http:\/\/127\.0\.0\.1/);
  assert.match(error.message, /Check the internet connection/);
  const remote = await startFakeRemote({ port });
  t.after(remote.close);
  const { result } = await bridge.request("tools/list");
  assert.deepEqual(result.tools.map((tool) => tool.name), FAKE_TOOLS.map((tool) => tool.name));
});

test("the bridge talks only to the endpoint and names itself in User-Agent", async (t) => {
  const remote = await startFakeRemote();
  t.after(remote.close);
  const bridge = rawBridge(t, remote.url);
  await bridge.handshake();
  await bridge.request("tools/list");
  assert.ok(remote.requests.length >= 3, "initialize, the initialized notification and tools/list");
  for (const request of remote.requests) {
    assert.equal(request.url, "/mcp");
    assert.equal(request.headers["user-agent"], `lookprep-mcp/${version}`);
    assert.equal(request.headers.cookie, undefined);
  }
});

test("against a server that never answers, initialize is still answered at once", async (t) => {
  const remote = await startSilentRemote();
  t.after(remote.close);
  const bridge = rawBridge(t, remote.url);
  const started = Date.now();
  const { result } = await bridge.handshake();
  assert.equal(result.serverInfo.name, "lookprep-mcp");
  assert.ok(Date.now() - started < 1_500, `initialize took ${Date.now() - started} ms`);
});

for (const [label, stop] of [
  ["closing stdin", (child) => child.stdin.end()],
  ["SIGTERM", (child) => child.kill("SIGTERM")],
]) {
  test(`the bridge exits within 2 s on ${label}, even while the hosted server never answers`, async (t) => {
    const remote = await startSilentRemote();
    t.after(remote.close);
    const bridge = rawBridge(t, remote.url);
    await bridge.handshake();
    // A request in flight towards the silent server, and the background connection still pending.
    void bridge.request("tools/list");
    await new Promise((resolve) => setTimeout(resolve, 200));
    const started = Date.now();
    stop(bridge.child);
    assert.deepEqual(await bridge.exited, { code: 0, signal: null });
    assert.ok(Date.now() - started < 2_000, `exit took ${Date.now() - started} ms`);
  });
}

test("a cancelled call is cancelled upstream", async (t) => {
  const remote = await startFakeRemote({ slowMs: 5_000 });
  t.after(remote.close);
  const client = await inProcess(t, remote.url);
  const controller = new AbortController();
  const call = client.request({ method: "tools/call", params: { name: "slow", arguments: {} } }, CallToolResultSchema, { signal: controller.signal });
  for (let attempt = 0; attempt < 100 && !remote.requests.some((request) => request.message?.params?.name === "slow"); attempt++) {
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  controller.abort("the user stopped it");
  await assert.rejects(call);
  const upstreamId = remote.requests.find((request) => request.message?.params?.name === "slow").message.id;
  for (let attempt = 0; attempt < 100 && !remote.requests.some((request) => request.message?.method === "notifications/cancelled"); attempt++) {
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  const cancelled = remote.requests.find((request) => request.message?.method === "notifications/cancelled");
  assert.ok(cancelled, "the hosted server received notifications/cancelled");
  assert.equal(cancelled.message.params.requestId, upstreamId);
});

test("a call that times out leaves the shared connection to the calls beside it", async (t) => {
  const remote = await startFakeRemote({ slowMs: 2_000 });
  t.after(remote.close);
  const client = await inProcess(t, remote.url, { timeoutMs: 300 });
  const slow = client.request({ method: "tools/call", params: { name: "slow", arguments: {} } }, CallToolResultSchema);
  const parallel = client.request({ method: "tools/call", params: { name: "echo", arguments: { text: "a" } } }, CallToolResultSchema);
  await assert.rejects(slow, /did not answer in time/);
  assert.equal((await parallel).isError, false);
  const after = await client.request({ method: "tools/list", params: {} }, ListToolsResultSchema);
  assert.equal(after.tools.length, FAKE_TOOLS.length);
  assert.equal(initializeCount(remote), 1, "the timeout did not close or replace the connection");
});

test("--version, --help and an unknown argument", () => {
  const run = (...args) => spawnSync(process.execPath, [entry, ...args], { encoding: "utf8", env: { PATH: process.env.PATH ?? "" }, timeout: 10_000 });
  assert.equal(run("--version").stdout, `${version}\n`);
  const help = run("--help");
  assert.equal(help.status, 0);
  assert.match(help.stdout, /https:\/\/mcp\.lookprep\.com\/mcp/);
  assert.match(help.stdout, /LOOKPREP_MCP_URL/);
  const unknown = run("--port", "80");
  assert.equal(unknown.status, 2);
  assert.match(unknown.stderr, /unknown argument "--port"/);
});

test("an endpoint outside the allowed list stops the bridge before any request", () => {
  const result = spawnSync(process.execPath, [entry], {
    encoding: "utf8",
    env: { PATH: process.env.PATH ?? "", LOOKPREP_MCP_URL: "https://mcp.lookprep.example/mcp" },
    timeout: 10_000,
  });
  assert.equal(result.status, 2);
  assert.match(result.stderr, /must be one of https:\/\/mcp\.lookprep\.com\/mcp or https:\/\/lookprep\.com\/mcp/);
});
