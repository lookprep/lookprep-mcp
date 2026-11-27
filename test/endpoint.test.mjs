import assert from "node:assert/strict";
import test from "node:test";
import { ALLOWED_ENDPOINTS, DEFAULT_ENDPOINT, EndpointError, resolveEndpoint } from "../dist/endpoint.js";

test("the default endpoint is the hosted server", () => {
  assert.equal(DEFAULT_ENDPOINT, "https://mcp.lookprep.com/mcp");
  assert.deepEqual(ALLOWED_ENDPOINTS, ["https://mcp.lookprep.com/mcp", "https://lookprep.com/mcp"]);
  assert.equal(resolveEndpoint({}).url.href, DEFAULT_ENDPOINT);
  assert.equal(resolveEndpoint({ LOOKPREP_MCP_URL: "  " }).url.href, DEFAULT_ENDPOINT);
});

test("the override accepts exactly LookPrep's two addresses", () => {
  assert.deepEqual(resolveEndpoint({ LOOKPREP_MCP_URL: "https://lookprep.com/mcp" }), { url: new URL("https://lookprep.com/mcp"), custom: false });
  for (const refused of [
    "https://lookprep.com/mcp/",
    "http://mcp.lookprep.com/mcp",
    "https://mcp.lookprep.com.example/mcp",
    "https://example.com/mcp",
    "https://staging.example/mcp",
  ]) {
    assert.throws(() => resolveEndpoint({ LOOKPREP_MCP_URL: refused }), EndpointError, refused);
  }
});

test("any other address needs the explicit opt-in, exactly 1", () => {
  assert.throws(() => resolveEndpoint({ LOOKPREP_MCP_URL: "http://127.0.0.1:9/mcp", LOOKPREP_MCP_ALLOW_ANY_ENDPOINT: "true" }), EndpointError);
  assert.deepEqual(resolveEndpoint({ LOOKPREP_MCP_URL: "http://127.0.0.1:9/mcp", LOOKPREP_MCP_ALLOW_ANY_ENDPOINT: "1" }), {
    url: new URL("http://127.0.0.1:9/mcp"),
    custom: true,
  });
  for (const refused of ["file:///etc/passwd", "not a url", "https://user:pass@example.com/mcp"]) {
    assert.throws(() => resolveEndpoint({ LOOKPREP_MCP_URL: refused, LOOKPREP_MCP_ALLOW_ANY_ENDPOINT: "1" }), EndpointError, refused);
  }
});
