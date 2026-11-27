# LookPrep MCP server

**Let your AI assistant explain named lip filler looks, show them side by side on demo faces, and
hand you to LookPrep to make your own simulation.**

[LookPrep](https://lookprep.com) makes simulations of how lip filler might look: from one photo of
a person's own face, it shows named lip looks and a lip flip at set amounts, side by side, to take
to a consultation. A simulation is for planning and discussion. It is not a prediction of a result
and not medical advice. Photo-based previews are for adults aged 18 or older.

This repository holds the public material for LookPrep's hosted MCP server: its
[`server.json`](server.json) for the official MCP Registry, this guide, and `lookprep-mcp`, a
small npm package for MCP clients that can only start local servers. The server itself is hosted
by LookPrep; most clients need nothing installed.

[Connect](#connect) · [What you can ask](#what-you-can-ask) · [Tools](#tools) ·
[Limits](#limits-and-what-it-will-not-do) · [Privacy](#privacy) · [Support](#support)

## Connect

The server is read-only and needs no account, key or sign-in:

```
https://mcp.lookprep.com/mcp
```

It speaks MCP over Streamable HTTP. The same server also answers at `https://lookprep.com/mcp`,
for a client that cannot reach the first address.

**Claude (web, desktop and mobile).** Open **Settings > Connectors**, choose **Add custom
connector**, name it `LookPrep` and paste the URL above. Leave the authentication settings empty.

**Claude Code.**

```bash
claude mcp add --transport http lookprep https://mcp.lookprep.com/mcp
```

The [LookPrep plugin](https://github.com/lookprep/skills) adds this server and the LookPrep skill
in one step:

```bash
claude plugin marketplace add lookprep/skills
claude plugin install lookprep@lookprep
```

**Cursor.** [Add to Cursor](https://cursor.com/en/install-mcp?name=lookprep&config=eyJ1cmwiOiJodHRwczovL21jcC5sb29rcHJlcC5jb20vbWNwIn0%3D),
or add this to `~/.cursor/mcp.json` (all projects) or `.cursor/mcp.json` (one project):

```json
{
  "mcpServers": {
    "lookprep": { "url": "https://mcp.lookprep.com/mcp" }
  }
}
```

**VS Code.** [Install in VS Code](https://insiders.vscode.dev/redirect?url=vscode%3Amcp%2Finstall%3F%257B%2522name%2522%253A%2522lookprep%2522%252C%2522type%2522%253A%2522http%2522%252C%2522url%2522%253A%2522https%253A%252F%252Fmcp.lookprep.com%252Fmcp%2522%257D),
or add this to `.vscode/mcp.json` in your workspace:

```json
{
  "servers": {
    "lookprep": { "type": "http", "url": "https://mcp.lookprep.com/mcp" }
  }
}
```

**Codex CLI.**

```bash
codex mcp add lookprep --url https://mcp.lookprep.com/mcp
```

**Gemini CLI.** Add this to `~/.gemini/settings.json`:

```json
{
  "mcpServers": {
    "lookprep": { "type": "http", "url": "https://mcp.lookprep.com/mcp" }
  }
}
```

If your Gemini CLI release does not accept `type`, use `{ "httpUrl": "https://mcp.lookprep.com/mcp" }`.

**Cline.** Add this to Cline's MCP settings file:

```json
{
  "mcpServers": {
    "lookprep": { "type": "streamableHttp", "url": "https://mcp.lookprep.com/mcp" }
  }
}
```

**Any other MCP client.** Add a remote server with transport Streamable HTTP (sometimes called
"HTTP") at the URL above, with no authentication.

### Clients that only start local servers

`lookprep-mcp` runs on your computer as a local (stdio) MCP server and forwards every request to
the hosted server. It has no tools of its own, so it always offers exactly what the hosted server
offers. It needs Node.js 24 or newer (the version its tests run on):

```json
{
  "mcpServers": {
    "lookprep": { "command": "npx", "args": ["-y", "lookprep-mcp"] }
  }
}
```

`npx -y lookprep-mcp --help` describes it. It records nothing, sets nothing on your computer and
sends requests only to `https://mcp.lookprep.com/mcp`. `LOOKPREP_MCP_URL` may switch it to
`https://lookprep.com/mcp`; any other address is refused. It answers your client's handshake at
once and connects to the hosted server in the background; if the hosted server cannot be reached,
each request returns an error that says so.

What is forwarded: `tools/list` reaches your client exactly as the hosted server sends it, every
field included. A `tools/call` result keeps its top-level fields and `structuredContent` as sent,
but the official MCP SDK the bridge is built on re-checks content blocks: fields of a content block
that the SDK version does not know are dropped, and a content block of a type it does not know
makes the call fail. (Today the hosted server sends only text blocks.) Cancelling a call cancels
it on the hosted server too. The bridge does not forward anything else: no resources, prompts or
sampling exist on the hosted server.

## What you can ask

- "What do Russian lips and cupid's bow lips each mean, and where do sources disagree?"
- "Show me natural lips at two different amounts on a demo face, side by side."
- "What would a lip flip look like compared with filler?"
- "How much does LookPrep cost, and what is free?"
- "I want to see these looks on my own face before my consultation. Where do I start?"

## Tools

Every tool is read-only, has a title, and is annotated `readOnlyHint: true`,
`destructiveHint: false`, `idempotentHint: true` and `openWorldHint: false`.

| Tool | Input | What it returns |
| --- | --- | --- |
| `list_lip_styles` | none | The named lip looks LookPrep can show as a simulation, each with a one-line summary, how consistently sources use the name, whether a demo exists and its page on lookprep.com, plus the lip flip. |
| `get_lip_style` | `style_id` | One look in detail: other names, what the name usually describes, where sources disagree, what the simulation shows, the demo settings and the cited sources with their type (clinical, trade or marketing). |
| `get_pricing` | none | Current prices in US dollars: the free preview, the fixed packs and custom selections, and how paying works. |
| `show_demo_look` | `style_id`, `amount`, `face_id` (all optional) | Before and after image links for a look on a stored demo face, the available settings, looks and faces, and a link to the same view on lookprep.com. The images were made in advance; nothing is created by the call. |
| `start_personal_preview` | `style_id`, or `looks` (a list of `style_id` and optional `amount`), both optional | A link into the LookPrep website for the person, optionally with looks and settings already selected, and the steps the person takes there. With `looks`, also the price of that selection, which requested looks were left out and why, and an instruction to pass on. The link carries no personal data. |

Every answer that describes an image carries the caption: "Simulation for planning and
discussion. Not a prediction of a result and not medical advice." Errors are specific (for example
"Unknown style. Call list_lip_styles for the ids."), so an assistant can correct its own call.

## Limits and what it will not do

What it will not do:

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

Limits:

- Inputs are short lowercase ids (at most 48 characters), bounded numbers and, for
  `start_personal_preview`, a list of at most 32 looks, of which up to 20 are kept. Unknown
  arguments are rejected, and a request body is at most 16 KiB.
- One JSON-RPC message per request, answered with JSON. No server-sent events, no batches, no
  resources, prompts or sampling. Clients using MCP `2026-07-28` need no handshake; older clients
  use `initialize` with `2025-11-25`, `2025-06-18` or `2025-03-26`.
- Requests are rate limited per client address and client name. A client that is limited gets
  HTTP 429 with a `Retry-After` header.
- Browser-based clients on any website can call it: it answers with
  `Access-Control-Allow-Origin: *` and never uses cookies or credentials.

## Privacy

The server receives only what a client sends to it: the tool name and short arguments such as
`russian` or `natural`, the name the client software gives for itself, and the IP address the
request comes from. It never receives a photo or details about the person an assistant acts for.

The IP address is used only to limit how many requests one caller can send. The server keeps it
only in memory, as a one-way digest, and deletes it after its one-minute counting window ends:
within two minutes while the server is handling traffic, otherwise when it next handles a request
or stops. LookPrep's usage records name only the tool, the outcome and the client software, never
arguments or IP addresses. Google Cloud keeps standard request logs, which include the IP address,
for 30 days, and Cloudflare carries the traffic. No response sets a cookie. The
[Privacy Policy](https://lookprep.com/privacy#agent-connector) describes this in full.

A link from `start_personal_preview` opens LookPrep's website, where the
[Privacy Policy](https://lookprep.com/privacy) and [Terms](https://lookprep.com/terms) apply.
Photos uploaded there stay private by default, and a person can delete their account, photos and
previews from [Delete data](https://lookprep.com/delete-data).

## Support

- Email [support@lookprep.com](mailto:support@lookprep.com), or see
  [Contact & support](https://lookprep.com/contact).
- For AI agents and the people who run them: [lookprep.com/agents](https://lookprep.com/agents).
- Report security issues privately as described in [SECURITY.md](SECURITY.md).

LookPrep is operated by REPLYPILOT sp. z o.o., a company registered in Poland.

## Licence

The files in this repository are released under the [MIT License](LICENSE). The LookPrep name,
logo and the demo images the server links to are not covered by that licence.
