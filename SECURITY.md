# Security policy

Report security issues privately to [support@lookprep.com](mailto:support@lookprep.com), the
contact LookPrep publishes in
[`/.well-known/security.txt`](https://lookprep.com/.well-known/security.txt), not in public
issues or pull requests. Include the affected URL, file or package version, what a client, an
agent or a person could do with it, and steps to reproduce.

## Scope

- The hosted MCP server at `https://mcp.lookprep.com/mcp` (also `https://lookprep.com/mcp`).
  Examples of security issues: a tool that returns data about a person, a session, a photo, a
  preview or a purchase; a hand-off link that can be made to lead outside lookprep.com; a request
  that makes the server keep state or set a cookie; a way around the input limits or the rate
  limits.
- The npm package `lookprep-mcp`: for example a way to make it send requests anywhere other than
  LookPrep's hosted server without the explicit testing switch, or to make it write, run or keep
  anything on the computer it runs on.
- This repository: `server.json`, the documentation and the release workflow. A change that could
  publish a listing or a package pointing anywhere other than LookPrep's hosted server counts as a
  security issue.
- The LookPrep [skill and plugins](https://github.com/lookprep/skills): report to the same address.

The server never accepts photos, consent, payment details or email addresses. If you find a way
to send any of these through it, please report it.

## Supported versions

The hosted server is always the current version; fixes are deployed there and need no action from
users. For the npm package, only the latest release is supported.
