# Contributing

Questions and bug reports are welcome as
[issues](https://github.com/lookprep/lookprep-mcp/issues). Report security issues privately as
described in [SECURITY.md](SECURITY.md), never in a public issue or pull request.

This repository is a release mirror. Each release arrives as one snapshot commit from LookPrep's
private source repository, through a `release/vX.Y.Z` pull request, and a `vX.Y.Z` tag then
publishes the npm package, the MCP Registry listing and the GitHub Release. A maintainer who accepts
your pull request applies the change in that source, and it reaches this repository with the next
release; your pull request is then closed with a note saying so.

## Checks

With Node.js 24 or newer:

```bash
npm ci --ignore-scripts
bash scripts/check-local.sh
```

It builds the package (which type-checks it), runs the tests against a stand-in server on your own
computer, and checks `server.json` and every version field. No request leaves your computer.
`node scripts/live-check.mjs`, after a build, sends a few read-only requests to the hosted server
through the bridge; it is not part of the checks.

## Rules

- The bridge forwards; it never lists, renames or describes a tool itself.
- `package.json`, `npm-shrinkwrap.json` and `server.json` carry one version, and `CHANGELOG.md` has a
  section for it. `scripts/check-release-metadata.mjs` enforces this.
- The only runtime dependency is the official `@modelcontextprotocol/sdk`, at an exact version.
