# Changelog

One version covers the npm package `lookprep-mcp` and the MCP Registry listing in `server.json`.
Registry versions are immutable, so every change to the listing or the package gets a new version.
The major version matches the major version the hosted server reports in `serverInfo`; minor and
patch versions are this repository's own.

## 1.0.1 (27 Nov 2026)

README only; the bridge, the tools and the hosted server are unchanged.

- A LookPrep banner at the top (light and dark).
- A section "What an assistant can show": the stored demo images `show_demo_look` links to for one
  generated demo face (before, Russian lips, Natural lip enhancement), each with the simulation
  caption, and a row of the look illustrations from lookprep.com.
- The images are in `assets/` and the README loads them from this repository, so they also show
  on the npm package page.

## 1.0.0

First public release, for the hosted, read-only LookPrep MCP server at
`https://mcp.lookprep.com/mcp`.

- `server.json` for the official MCP Registry under the name `com.lookprep/lookprep`, with the
  hosted Streamable HTTP endpoint and the npm package.
- `lookprep-mcp` on npm: a stdio bridge for MCP clients that only start local servers. It forwards
  every tool request to the hosted server, so it offers exactly the tools the hosted server offers:
  `list_lip_styles`, `get_lip_style`, `get_pricing`, `show_demo_look` and `start_personal_preview`.
