// A stand-in for the hosted server: stateless Streamable HTTP, one JSON-RPC
// message per POST, JSON replies, GET 405, no sessions. Loopback only.
import { createServer } from "node:http";

export const FAKE_TOOLS = [
  {
    name: "echo",
    title: "Echo",
    description: "Returns its arguments.",
    inputSchema: { type: "object", properties: { text: { type: "string", maxLength: 48 } }, additionalProperties: false },
    outputSchema: { type: "object", properties: { text: { type: "string" } } },
    annotations: { title: "Echo", readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false, futureHint: "kept" },
    futureToolField: { nested: [1, 2, 3] },
  },
  {
    name: "fails",
    title: "Fails",
    description: "Always a tool error.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
];

export const FAKE_INSTRUCTIONS = "Fake instructions from the stand-in server.";

/**
 * Tools: `echo` (result with an extra top-level field), `fails` (a tool error),
 * `limited` (HTTP 429), `invalid` (a result that is not a tool result), `garbled` (a JSON content type with a body that is not
 * JSON), `slow` (answers after `slowMs`), anything else (-32602).
 */
export async function startFakeRemote({ port = 0, slowMs = 1_000 } = {}) {
  const requests = [];
  const server = createServer((request, response) => {
    let body = "";
    request.on("data", (chunk) => (body += chunk));
    request.on("end", () => {
      requests.push({ method: request.method, url: request.url, headers: request.headers, body, message: body ? JSON.parse(body) : undefined });
      if (request.method !== "POST") {
        response.writeHead(405, { Allow: "POST, OPTIONS" }).end();
        return;
      }
      const message = JSON.parse(body);
      const reply = (result, status = 200) => {
        response.writeHead(status, { "Content-Type": "application/json" });
        response.end(JSON.stringify({ jsonrpc: "2.0", id: message.id, ...result }));
      };
      if (message.id === undefined) {
        response.writeHead(202).end();
        return;
      }
      switch (message.method) {
        case "initialize":
          reply({
            result: {
              protocolVersion: message.params.protocolVersion,
              capabilities: { tools: { listChanged: false } },
              serverInfo: { name: "com.example/fake", version: "9.9.9" },
              instructions: FAKE_INSTRUCTIONS,
            },
          });
          return;
        case "tools/list":
          reply({ result: { tools: FAKE_TOOLS, futureListField: "kept" } });
          return;
        case "tools/call": {
          const { name, arguments: args } = message.params;
          if (name === "echo") {
            reply({ result: { content: [{ type: "text", text: JSON.stringify(args) }], structuredContent: args, isError: false, futureResultField: "kept" } });
          } else if (name === "fails") {
            reply({ result: { content: [{ type: "text", text: "Unknown style. Call list_lip_styles for the ids." }], isError: true } });
          } else if (name === "limited") {
            response.writeHead(429, { "Content-Type": "application/json", "Retry-After": "7" });
            response.end(JSON.stringify({ jsonrpc: "2.0", id: null, error: { code: -31429, message: "Too many requests." } }));
          } else if (name === "invalid") {
            reply({ result: { content: "not a list of content blocks" } });
          } else if (name === "garbled") {
            response.writeHead(200, { "Content-Type": "application/json" });
            response.end("{not json");
          } else if (name === "slow") {
            const timer = setTimeout(() => reply({ result: { content: [{ type: "text", text: "late" }], isError: false } }), slowMs);
            response.on("close", () => clearTimeout(timer));
          } else {
            reply({ error: { code: -32602, message: "Unknown tool." } });
          }
          return;
        }
        default:
          reply({ error: { code: -32601, message: "Method not found." } });
      }
    });
  });
  await new Promise((resolve) => server.listen(port, "127.0.0.1", resolve));
  const address = server.address();
  return {
    url: `http://127.0.0.1:${address.port}/mcp`,
    port: address.port,
    requests,
    close: () => {
      server.closeAllConnections();
      return new Promise((resolve) => server.close(resolve));
    },
  };
}

/** Accepts connections and reads requests, but never answers. */
export async function startSilentRemote() {
  const server = createServer(() => {});
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  return {
    url: `http://127.0.0.1:${server.address().port}/mcp`,
    close: () => {
      server.closeAllConnections();
      return new Promise((resolve) => server.close(resolve));
    },
  };
}
