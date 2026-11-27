<p align="center">
  <a href="https://lookprep.com">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/lookprep/lookprep-mcp/main/assets/lookprep-wordmark-reversed.svg">
      <img src="https://raw.githubusercontent.com/lookprep/lookprep-mcp/main/assets/lookprep-wordmark.svg" alt="LookPrep" width="220">
    </picture>
  </a>
</p>

<h1 align="center">LookPrep MCP server</h1>

<p align="center">
  A hosted, read-only MCP server that lets an AI assistant explain named lip filler looks, show them
  on stored demo simulations, look up LookPrep's current prices and give a person a link to make
  their own simulation on lookprep.com.
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/lookprep-mcp"><img src="https://img.shields.io/npm/v/lookprep-mcp?label=npm&color=171718" alt="npm version"></a>
  <a href="https://github.com/lookprep/lookprep-mcp/blob/main/LICENSE"><img src="https://img.shields.io/github/license/lookprep/lookprep-mcp?label=licence&color=171718" alt="Licence: MIT"></a>
  <a href="https://modelcontextprotocol.io"><img src="https://img.shields.io/badge/MCP-Streamable%20HTTP-171718" alt="MCP: Streamable HTTP"></a>
  <a href="https://nodejs.org"><img src="https://img.shields.io/badge/node-%3E%3D24-171718" alt="Node.js 24 or newer for the npm bridge"></a>
</p>

<p align="center">
  <a href="#add-it-to-your-assistant">Add it</a> ·
  <a href="#try-asking">Try asking</a> ·
  <a href="#tools">Tools</a> ·
  <a href="#how-a-hand-off-works">Hand-off</a> ·
  <a href="#what-it-will-not-do">What it will not do</a> ·
  <a href="#privacy">Privacy</a> ·
  <a href="#troubleshooting">Troubleshooting</a> ·
  <a href="#the-npm-bridge">npm bridge</a>
</p>

[LookPrep](https://lookprep.com) makes simulations of how lip filler might look: from one photo of
a person's own face, it shows named lip looks and a lip flip at set amounts, side by side, to take
to a consultation. A simulation is for planning and discussion. It is not a prediction of a result
and not medical advice. Photo-based previews are for adults aged 18 or older.

This server gives an assistant LookPrep's public catalogue. It cannot see a photo, create an
account or take a payment: when a person wants their own simulation, the assistant hands them a
link and the person continues on lookprep.com themselves. To see what the demo simulations look
like, open the [public demo](https://lookprep.com/demo).

```text
https://mcp.lookprep.com/mcp
```

Streamable HTTP, no account, key or sign-in. The same server also answers at
`https://lookprep.com/mcp`, for a client that cannot reach the first address. It is hosted by
LookPrep, so most clients need nothing installed.

## Add it to your assistant

| Client | Fastest path |
| --- | --- |
| Claude Code | `claude mcp add` command, or the LookPrep plugin |
| Claude (web, desktop; then mobile) | Custom connector (Customize > Connectors) |
| Cursor | One-click link, or `mcp.json` |
| VS Code | One-click link, or `.vscode/mcp.json` |
| Codex CLI | `codex mcp add` command |
| Gemini CLI | `~/.gemini/settings.json` |
| Cline | MCP settings file |
| A client that only starts local servers | `npx -y lookprep-mcp` |
| Any other MCP client | Remote server, Streamable HTTP, the URL above, no authentication |

### Claude Code

```bash
claude mcp add --transport http lookprep https://mcp.lookprep.com/mcp
```

The [LookPrep plugin](https://github.com/lookprep/skills) adds this server and the LookPrep skill
in one step:

```bash
claude plugin marketplace add lookprep/skills
claude plugin install lookprep@lookprep
```

### Claude (web and desktop)

**Claude (web and desktop).** Go to **Customize > Connectors**, click **+ Add**, then **Add custom
connector**. Name it `LookPrep`, paste `https://mcp.lookprep.com/mcp`, click **Continue** (once after the
URL and once after the settings Claude detects), choose **No sign in** under **Authentication**, and
click **Add**. On a Team or Enterprise plan, an Owner adds it under **Organization settings >
Connectors**, and members then connect it from **Customize > Connectors**. Once added, it also works
in the Claude mobile apps.

### Cursor

<a href="https://cursor.com/en/install-mcp?name=lookprep&config=eyJ1cmwiOiJodHRwczovL21jcC5sb29rcHJlcC5jb20vbWNwIn0%3D"><img src="https://img.shields.io/badge/Cursor-Add%20LookPrep-171718" alt="Add LookPrep to Cursor"></a>

<details>
<summary>Or add it by hand</summary>

Add this to `~/.cursor/mcp.json` (all projects) or `.cursor/mcp.json` (one project):

```json
{
  "mcpServers": {
    "lookprep": { "url": "https://mcp.lookprep.com/mcp" }
  }
}
```

</details>

### VS Code

<a href="https://insiders.vscode.dev/redirect?url=vscode%3Amcp%2Finstall%3F%257B%2522name%2522%253A%2522lookprep%2522%252C%2522type%2522%253A%2522http%2522%252C%2522url%2522%253A%2522https%253A%252F%252Fmcp.lookprep.com%252Fmcp%2522%257D"><img src="https://img.shields.io/badge/VS%20Code-Install%20LookPrep-171718" alt="Install LookPrep in VS Code"></a>

<details>
<summary>Or add it by hand</summary>

Add this to `.vscode/mcp.json` in your workspace:

```json
{
  "servers": {
    "lookprep": { "type": "http", "url": "https://mcp.lookprep.com/mcp" }
  }
}
```

</details>

### Codex CLI

```bash
codex mcp add lookprep --url https://mcp.lookprep.com/mcp
```

### Gemini CLI

<details>
<summary>Add this to <code>~/.gemini/settings.json</code></summary>

```json
{
  "mcpServers": {
    "lookprep": { "type": "http", "url": "https://mcp.lookprep.com/mcp" }
  }
}
```

If your Gemini CLI release does not accept `type`, use `{ "httpUrl": "https://mcp.lookprep.com/mcp" }`.

</details>

### Cline

<details>
<summary>Add this to Cline's MCP settings file</summary>

```json
{
  "mcpServers": {
    "lookprep": { "type": "streamableHttp", "url": "https://mcp.lookprep.com/mcp" }
  }
}
```

</details>

### Clients that only start local servers

Use the [npm bridge](#the-npm-bridge), which runs on your computer and forwards to the hosted
server:

```json
{
  "mcpServers": {
    "lookprep": { "command": "npx", "args": ["-y", "lookprep-mcp"] }
  }
}
```

### Any other MCP client

Add a remote server with transport Streamable HTTP (sometimes called "HTTP") at
`https://mcp.lookprep.com/mcp`, with no authentication.

## Try asking

- "What do Russian lips and cupid's bow lips each mean, and where do sources disagree?"
- "Show me natural lips at two different amounts on a demo face, side by side."
- "What would a lip flip look like compared with filler?"
- "How much does LookPrep cost, and what is free?"
- "Help me make a list of looks I like and questions for my injector."
- "I want to see these looks on my own face before my consultation. Where do I start?"

## Tools

| Tool | Arguments | What it returns |
| --- | --- | --- |
| `list_lip_styles` | none | The named lip looks LookPrep can show as a simulation, plus the lip flip: a one-line summary of each, how consistently sources use the name, whether a demo exists and the look's page on lookprep.com. |
| `get_lip_style` | `style_id` (required) | One look in detail: other names, what the name usually describes, where sources disagree, what the simulation shows, the demo settings and the cited sources with their type (clinical, trade or marketing). |
| `get_pricing` | none | Current prices in US dollars: the free preview, the fixed packs and custom selections, and how paying works. |
| `show_demo_look` | `style_id`, `amount`, `face_id`, all optional | Before and after image links for a look on a stored demo face, the available settings, looks and faces, and a link to the same view on lookprep.com. The images were made in advance; nothing is created by the call. |
| `start_personal_preview` | `style_id`, or `looks` (a list of `style_id` and optional `amount`), both optional | A link into the LookPrep website for the person, optionally with looks and settings already selected, and the steps the person takes there. With `looks` (and, from server version 1.1.0, with `style_id`), also the price of that selection, which requested looks were left out and why, and an instruction to pass on. The link carries no personal data. |

Every tool is read-only, has a title, and is annotated `readOnlyHint: true`,
`destructiveHint: false`, `idempotentHint: true` and `openWorldHint: false`.

Every answer that describes an image carries the caption: "Simulation for planning and
discussion. Not a prediction of a result and not medical advice." Errors are specific (for example
"Unknown style. Call list_lip_styles for the ids."), so an assistant can correct its own call.

## How a hand-off works

The assistant never makes a person's simulation. It asks for a link, and the person takes every
step that involves them on lookprep.com.

```text
  Person            Assistant                 LookPrep MCP server      lookprep.com
    |                   |                             |                      |
    | "I want to see    |                             |                      |
    |  these looks on   |                             |                      |
    |  my own face"     |                             |                      |
    |------------------>|  start_personal_preview     |                      |
    |                   |  looks: look ids, amounts   |                      |
    |                   |---------------------------->|                      |
    |                   |  link, steps, price         |                      |
    |                   |<----------------------------|                      |
    |  link and steps   |                             |                      |
    |<------------------|                             |                      |
    |                                                                        |
    |  opens the link in their own browser, confirms they are 18 or older,   |
    |  consents and uploads one photo of their own face                      |
    |----------------------------------------------------------------------->|
    |  one free preview; more looks only if they pay on LookPrep's checkout  |
    |<-----------------------------------------------------------------------|
```

1. The assistant calls `start_personal_preview` with look ids and settings only, or with nothing
   at all.
2. The server returns a link to lookprep.com, the steps the person takes there and, for a
   selection, its price. The link carries no personal data, and opening it uploads, generates and
   charges nothing.
3. The person opens the link, confirms they are 18 or older, consents and uploads their own
   photo, themselves. Payment, if they choose to pay, happens only on LookPrep's checkout page.

## What it will not do

- **No photos.** No tool accepts an image, a file or a URL. A personal simulation needs the person
  to open the link, confirm they are 18 or older, consent, and upload their own photo on
  lookprep.com, themselves.
- **No consent, payment details or email.** No tool accepts a consent flag, card details or an
  email address, and no tool returns a checkout link. Payment happens only on LookPrep's checkout
  page on lookprep.com, never through these tools.
- **No generation.** Nothing is generated when a tool is called. Demo images are stored files, the
  same ones the public [demo](https://lookprep.com/demo) shows.
- **No accounts or stored data.** No sign-in, cookies or sessions, and no access to anyone's
  photos, previews or purchases.
- **No medical advice.** The tools describe how look names are used and what a simulation shows.
  They never say a treatment is safe or suitable, and never recommend a product or an amount.
  Each simulated look is set to a named filler product and amount; these are the simulation's
  settings, not a recommendation.

### Limits

| Area | Limit |
| --- | --- |
| Inputs | Short lowercase ids (at most 48 characters) and bounded numbers. `start_personal_preview` reads a list of at most 32 looks, of which up to 20 are kept. Unknown arguments are rejected. |
| Requests | A request body is at most 16 KiB. One JSON-RPC message per request, answered with JSON. No server-sent events, no batches, no resources, prompts or sampling. |
| Protocol | Clients using MCP `2026-07-28` need no handshake; older clients use `initialize` with `2025-11-25`, `2025-06-18` or `2025-03-26`. |
| Rate limits | Per client address and client name. A client that is limited gets HTTP 429 with a `Retry-After` header. |
| Browsers | Browser-based clients on any website can call it: it answers with `Access-Control-Allow-Origin: *` and never uses cookies or credentials. |

## Privacy

The server receives only what a client sends to it: the tool name and short arguments such as
`russian` or `natural`, the name the client software gives for itself, and the IP address the
request comes from. It never receives a photo or details about the person an assistant acts for.

The IP address is used only to limit how many requests one caller can send. The server keeps it
only in memory, as a one-way digest, and deletes it after its one-minute counting window ends:
within two minutes while the server is handling traffic, otherwise when it next handles a request
or stops. LookPrep's usage records record only the tool, the outcome, the client software and the
protocol version it uses, when the call was made and how long the answer took, with details about
LookPrep's own server such as its version; never arguments or the IP address the call comes from.
A copy of each usage record goes to PostHog to count how the connector is used, with a new random
identifier for each request and no identifier that connects one request to another or to a person.
Google Cloud keeps standard request logs, which include the IP address, for 30 days, and Cloudflare
carries the traffic. No response sets a cookie. The [Privacy Policy](https://lookprep.com/privacy#agent-connector) describes this in full.

A link from `start_personal_preview` opens LookPrep's website, where the
[Privacy Policy](https://lookprep.com/privacy) and [Terms](https://lookprep.com/terms) apply.
Photos uploaded there stay private by default, and a person can delete their account, photos and
previews from [Delete data](https://lookprep.com/delete-data).

## Troubleshooting

- **Opening the URL in a browser shows an error (HTTP 405).** That is expected: the server answers
  only MCP `POST` requests. Add the URL to an MCP client instead.
- **HTTP 429.** You hit the rate limit; wait for the seconds in `Retry-After`.
- **A client offers SSE or "HTTP" transports.** Choose Streamable HTTP ("HTTP"); the server has no
  SSE stream.
- **No tools appear.** Check that authentication is set to none, and that the client supports
  remote servers; if it only starts local ones, use the [npm bridge](#the-npm-bridge).

## The npm bridge

[`lookprep-mcp`](https://www.npmjs.com/package/lookprep-mcp) is for MCP clients that can only
start local (stdio) servers. It runs on your computer and forwards every request to the hosted
server. It has no tools of its own, so it always offers exactly what the hosted server offers.

```bash
npx -y lookprep-mcp            # start the bridge on stdin and stdout
npx -y lookprep-mcp --help     # describe it
npx -y lookprep-mcp --version
```

- **Node.js 24 or newer** (the version its tests run on).
- **Records nothing and sets nothing on your computer.** It sends requests only to LookPrep's
  hosted endpoint, unless you turn on the testing switch below.
- **Starts at once.** It answers your client's handshake immediately and connects to the hosted
  server in the background; if the hosted server cannot be reached, each request returns an error
  that says so.

| Environment variable | Effect |
| --- | --- |
| `LOOKPREP_MCP_URL` | Optional. The hosted endpoint to forward to: `https://mcp.lookprep.com/mcp` (default) or `https://lookprep.com/mcp`. Any other address is refused unless `LOOKPREP_MCP_ALLOW_ANY_ENDPOINT=1`. |
| `LOOKPREP_MCP_ALLOW_ANY_ENDPOINT` | For testing only. Set to exactly `1` to let `LOOKPREP_MCP_URL` name a stand-in server; the bridge then says on stderr where it forwards. |

<details>
<summary>What is forwarded</summary>

`tools/list` reaches your client exactly as the hosted server sends it, every field included. A
`tools/call` result keeps its top-level fields and `structuredContent` as sent, but the official
MCP SDK the bridge is built on re-checks content blocks: fields of a content block that the SDK
version does not know are dropped, and a content block of a type it does not know makes the call
fail. (Today the hosted server sends only text blocks.) Cancelling a call cancels it on the hosted
server too. The bridge does not forward anything else: no resources, prompts or sampling exist on
the hosted server.

</details>

## Versioning and releases

- One version covers the npm package `lookprep-mcp` and the MCP Registry entry in
  [`server.json`](https://github.com/lookprep/lookprep-mcp/blob/main/server.json), under the name
  `com.lookprep/lookprep`. The Registry listing follows the first release.
- The major version matches the major version the hosted server reports in `serverInfo`; minor and
  patch versions are this repository's own. Registry versions are immutable, so every change to
  the listing or the package gets a new version.
- A `vX.Y.Z` tag publishes the npm package, the Registry listing and the GitHub Release. Changes
  are listed in [CHANGELOG.md](https://github.com/lookprep/lookprep-mcp/blob/main/CHANGELOG.md).
- The hosted server is always the current version; fixes are deployed there and need no action
  from you. For the npm package, only the latest release is supported.
- This repository is a release mirror: each release arrives as one snapshot commit.
  [CONTRIBUTING.md](https://github.com/lookprep/lookprep-mcp/blob/main/CONTRIBUTING.md) explains
  how issues and pull requests are handled and how to run the checks.

## Support and security

- Email [support@lookprep.com](mailto:support@lookprep.com), or see
  [Contact & support](https://lookprep.com/contact).
- For AI agents and the people who run them: [lookprep.com/agents](https://lookprep.com/agents).
- Questions and bug reports: [issues](https://github.com/lookprep/lookprep-mcp/issues).
- Report security issues privately as described in
  [SECURITY.md](https://github.com/lookprep/lookprep-mcp/blob/main/SECURITY.md), never in a public
  issue.
- The [LookPrep skill and plugins](https://github.com/lookprep/skills) teach an assistant how to
  use these tools for consultation planning.

LookPrep is operated by REPLYPILOT sp. z o.o., a company registered in Poland.

## Licence

The files in this repository are released under the
[MIT License](https://github.com/lookprep/lookprep-mcp/blob/main/LICENSE). The LookPrep name,
logo and the demo images the server links to are not covered by that licence.
