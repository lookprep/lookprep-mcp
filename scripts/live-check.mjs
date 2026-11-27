// Optional live check, not part of any automated gate: start the built bridge,
// list the hosted server's tools through it and call one read-only tool.
// It sends three or four requests to the hosted server. Run after `npm run build`:
//   node scripts/live-check.mjs
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { fileURLToPath } from "node:url";

const expected = ["list_lip_styles", "get_lip_style", "get_pricing", "show_demo_look", "start_personal_preview"];
const transport = new StdioClientTransport({
  command: process.execPath,
  args: [fileURLToPath(new URL("../dist/index.js", import.meta.url))],
  env: { PATH: process.env.PATH ?? "", ...(process.env.LOOKPREP_MCP_URL ? { LOOKPREP_MCP_URL: process.env.LOOKPREP_MCP_URL } : {}) },
  stderr: "inherit",
});
const client = new Client({ name: "lookprep-mcp-live-check", version: "1.0.0" });
try {
  await client.connect(transport);
  const { tools } = await client.listTools();
  const names = tools.map((tool) => tool.name);
  console.log(`tools: ${names.join(", ")}`);
  if (JSON.stringify([...names].sort()) !== JSON.stringify([...expected].sort())) {
    throw new Error(`Unexpected tool list; expected ${expected.join(", ")}`);
  }
  const result = await client.callTool({ name: "list_lip_styles", arguments: {} });
  if (result.isError) throw new Error("list_lip_styles returned an error");
  console.log(`list_lip_styles: ${result.structuredContent?.styles?.length ?? "?"} looks`);
  console.log("OK: the bridge forwards to the hosted server.");
} finally {
  await client.close();
}
