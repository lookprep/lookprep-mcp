import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport, StreamableHTTPError } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import { CallToolRequestSchema, CallToolResultSchema, ErrorCode, ListToolsRequestSchema, McpError, ResultSchema } from "@modelcontextprotocol/sdk/types.js";
import { INSTRUCTIONS } from "./instructions.ts";

/**
 * A stdio MCP server that forwards every tool request to LookPrep's hosted
 * server. It holds no tool list of its own, so it can never offer a tool the
 * hosted server does not, or describe one differently. It records nothing and
 * sends nothing anywhere but the endpoint.
 *
 * The stdio side is available at once: `initialize` and `ping` are answered
 * locally, and the hosted server is connected in the background, so a slow or
 * unreachable network never delays the client's handshake or the shutdown.
 */

export type BridgeOptions = {
  endpoint: URL;
  version: string;
  /** Timeout for one forwarded request. */
  timeoutMs?: number;
  /** Timeout for connecting to the hosted server (its `initialize`). */
  connectTimeoutMs?: number;
  /** Writes diagnostics; stdout carries the protocol, so this must not. */
  log?: (message: string) => void;
  fetch?: typeof fetch;
};

export type Bridge = {
  server: Server;
  /** Serves `transport` at once and starts connecting to the hosted server in the background. */
  start(transport: Transport): Promise<void>;
  /** Stops without waiting for a pending connection to the hosted server. */
  close(): Promise<void>;
};

export const DEFAULT_TIMEOUT_MS = 30_000;
export const DEFAULT_CONNECT_TIMEOUT_MS = 8_000;

/**
 * An error sent back to the client as it is: the code, and the message without
 * the SDK's "MCP error <code>:" prefix (the client adds its own).
 */
class ForwardedError extends Error {
  constructor(
    readonly code: number,
    message: string,
    readonly data?: unknown
  ) {
    super(message);
  }
}

const SDK_PREFIX = /^MCP error -?\d+: /;

/** True for a failure to reach the server at all (DNS, refused, reset, TLS), as opposed to a bad answer. */
function isNetworkFailure(error: unknown) {
  return error instanceof TypeError && /fetch failed|network|ECONN|ENOTFOUND|EAI_AGAIN/i.test(`${error.message} ${String(error.cause ?? "")}`);
}

/** Plain-language text for a failure to reach or use the hosted server. */
export function describeRemoteFailure(endpoint: URL, error: unknown): string {
  const where = endpoint.href;
  if (error instanceof StreamableHTTPError) {
    // The SDK error carries the status only, not the Retry-After header.
    if (error.code === 429) return `The LookPrep MCP server at ${where} is limiting requests right now. Wait a minute and try again.`;
    if (error.code === 404) return `The LookPrep MCP server was not found at ${where} (HTTP 404).`;
    if (typeof error.code === "number" && error.code >= 500) {
      return `The LookPrep MCP server at ${where} answered with an error (HTTP ${error.code}). Try again later.`;
    }
    if (typeof error.code === "number" && error.code > 0) return `The LookPrep MCP server at ${where} refused the request (HTTP ${error.code}).`;
  }
  if (error instanceof McpError && error.code === ErrorCode.RequestTimeout) {
    return `The LookPrep MCP server at ${where} did not answer in time. Check the internet connection and try again.`;
  }
  const detail = (error instanceof Error ? (error.cause instanceof Error ? error.cause.message : error.message) : String(error)).slice(0, 200);
  if (isNetworkFailure(error)) {
    return `Could not reach the LookPrep MCP server at ${where} (${detail}). Check the internet connection, any proxy or firewall, and try again.`;
  }
  return `The LookPrep MCP server at ${where} sent an answer the bridge could not read (${detail}). Try again; if it keeps happening, update lookprep-mcp.`;
}

export function createBridge(options: BridgeOptions): Bridge {
  const { endpoint, version } = options;
  const timeout = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const connectTimeout = options.connectTimeoutMs ?? DEFAULT_CONNECT_TIMEOUT_MS;
  const log = options.log ?? ((message: string) => process.stderr.write(`lookprep-mcp: ${message}\n`));

  let client: Client | undefined;
  let connecting: Promise<Client> | undefined;
  let pendingTransport: StreamableHTTPClientTransport | undefined;
  let closed = false;

  async function connect(): Promise<Client> {
    const next = new Client({ name: "lookprep-mcp", version }, { capabilities: {} });
    const transport = new StreamableHTTPClientTransport(endpoint, {
      requestInit: { headers: { "User-Agent": `lookprep-mcp/${version}` } },
      ...(options.fetch ? { fetch: options.fetch } : {}),
    });
    pendingTransport = transport;
    next.onclose = () => {
      if (client === next) client = undefined;
    };
    try {
      await next.connect(transport, { timeout: connectTimeout });
    } catch (error) {
      await transport.close().catch(() => {});
      throw error;
    } finally {
      if (pendingTransport === transport) pendingTransport = undefined;
    }
    if (closed) {
      await next.close().catch(() => {});
      throw new McpError(ErrorCode.ConnectionClosed, "The bridge is shutting down.");
    }
    return next;
  }

  /**
   * The connected client, connecting when there is none. The hosted server is
   * stateless, so one connection serves every request for the bridge's life;
   * only a failed connection attempt is retried, by the next request.
   */
  function remote(): Promise<Client> {
    if (closed) return Promise.reject(new McpError(ErrorCode.ConnectionClosed, "The bridge is shutting down."));
    if (client) return Promise.resolve(client);
    connecting ??= connect()
      .then((connected) => (client = connected))
      .finally(() => {
        connecting = undefined;
      });
    return connecting;
  }

  /**
   * Forward one request and return the hosted server's result. A JSON-RPC
   * error from the server passes through with its code and message; every
   * other failure becomes a plain-language error and leaves the connection in
   * place for the other requests.
   */
  async function forward(method: "tools/list" | "tools/call", params: unknown, signal: AbortSignal) {
    let connected: Client;
    try {
      connected = await remote();
    } catch (error) {
      throw new ForwardedError(ErrorCode.InternalError, describeRemoteFailure(endpoint, error));
    }
    try {
      // ResultSchema is a loose object: the result's fields reach the client as the server sent them.
      return await connected.request({ method, params } as never, ResultSchema, { timeout, signal });
    } catch (error) {
      if (signal.aborted) throw error;
      if (error instanceof McpError && error.code !== ErrorCode.RequestTimeout && error.code !== ErrorCode.ConnectionClosed) {
        throw new ForwardedError(error.code, error.message.replace(SDK_PREFIX, ""), error.data);
      }
      throw new ForwardedError(ErrorCode.InternalError, describeRemoteFailure(endpoint, error));
    }
  }

  const server = new Server(
    { name: "lookprep-mcp", title: "LookPrep", version },
    { capabilities: { tools: { listChanged: false } }, instructions: INSTRUCTIONS }
  );
  // tools/list results are returned unvalidated, so every field the hosted server sends survives.
  server.setRequestHandler(ListToolsRequestSchema, (request, extra) => forward("tools/list", request.params, extra.signal) as never);
  // The SDK's Server re-validates tools/call results against its own CallToolResult schema (README, "Forwarding").
  // Check first, so an unreadable result is reported in plain words rather than as an invalid-params dump.
  server.setRequestHandler(CallToolRequestSchema, async (request, extra) => {
    const result = await forward("tools/call", request.params, extra.signal);
    const checked = CallToolResultSchema.safeParse(result);
    if (!checked.success) {
      throw new ForwardedError(ErrorCode.InternalError, describeRemoteFailure(endpoint, new Error("the tool result is not a valid MCP tool result")));
    }
    return result as never;
  });

  return {
    server,
    async start(transport) {
      await server.connect(transport);
      remote().catch((error) => {
        // Not fatal: each request tries again and reports the failure in plain words.
        if (!closed) log(describeRemoteFailure(endpoint, error));
      });
    },
    async close() {
      if (closed) return;
      closed = true;
      // Never wait for a pending connection: abort it.
      const aborting = pendingTransport?.close();
      await Promise.allSettled([server.close(), client?.close(), aborting]);
      client = undefined;
    },
  };
}
