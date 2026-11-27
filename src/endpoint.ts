/**
 * Where the bridge forwards to. LookPrep's MCP server is hosted; this package
 * only relays to it, so the endpoint is fixed unless the person running it
 * chooses LookPrep's second address, or explicitly opts in to any address
 * (for local testing against a stand-in server).
 */

/** The canonical hosted endpoint. */
export const DEFAULT_ENDPOINT = "https://mcp.lookprep.com/mcp";

/** Every address the override may name without the explicit opt-in. */
export const ALLOWED_ENDPOINTS: readonly string[] = [DEFAULT_ENDPOINT, "https://lookprep.com/mcp"];

/** Environment variable that selects one of `ALLOWED_ENDPOINTS`. */
export const ENDPOINT_ENV = "LOOKPREP_MCP_URL";

/** Set to exactly `1` to let `LOOKPREP_MCP_URL` name any http(s) address. */
export const ALLOW_ANY_ENDPOINT_ENV = "LOOKPREP_MCP_ALLOW_ANY_ENDPOINT";

export class EndpointError extends Error {}

export type ResolvedEndpoint = { url: URL; custom: boolean };

export function resolveEndpoint(env: Record<string, string | undefined> = process.env): ResolvedEndpoint {
  const raw = env[ENDPOINT_ENV]?.trim();
  if (!raw) return { url: new URL(DEFAULT_ENDPOINT), custom: false };
  if (ALLOWED_ENDPOINTS.includes(raw)) return { url: new URL(raw), custom: false };
  if (env[ALLOW_ANY_ENDPOINT_ENV] !== "1") {
    throw new EndpointError(
      `${ENDPOINT_ENV} must be one of ${ALLOWED_ENDPOINTS.join(" or ")}. ` +
        `To point the bridge at another server for testing, also set ${ALLOW_ANY_ENDPOINT_ENV}=1.`
    );
  }
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new EndpointError(`${ENDPOINT_ENV} is not a valid URL.`);
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new EndpointError(`${ENDPOINT_ENV} must be an http or https URL.`);
  }
  if (url.username || url.password) {
    throw new EndpointError(`${ENDPOINT_ENV} must not contain a user name or password.`);
  }
  return { url, custom: true };
}
