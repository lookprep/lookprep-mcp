// Structural guard for .github/workflows/release.yml: which job may mint an
// id-token, the exact permissions of every job, what the publish job may run,
// and how actions and secrets are referenced. The package has no YAML parser,
// so the guard reads the workflow's fixed two-space layout; it refuses any
// layout it does not understand. Mutation cases prove the guard catches what
// it is for.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const workflow = readFileSync(new URL("../.github/workflows/release.yml", import.meta.url), "utf8");

const EXPECTED_JOBS = ["release-ref", "build", "publish", "registry", "github-release"];
/** null: the job declares no permissions and inherits the top level. */
const EXPECTED_PERMISSIONS = {
  "release-ref": null,
  build: { contents: "read" },
  publish: { contents: "read", "id-token": "write" },
  registry: { contents: "read" },
  "github-release": { contents: "write" },
};
const TOP_LEVEL_PERMISSIONS = { contents: "read" };
const EXPECTED_FILES = "LICENSE README.md dist/bridge.js dist/endpoint.js dist/index.js dist/instructions.js npm-shrinkwrap.json package.json";

/** The `permissions:` map at one indentation inside `text`, or null when there is none; throws on another shape. */
function permissionsAt(text, indent) {
  const pad = " ".repeat(indent);
  const lines = text.split("\n");
  const start = lines.findIndex((line) => line === `${pad}permissions:` || line.startsWith(`${pad}permissions: `));
  if (start === -1) return null;
  if (lines[start] !== `${pad}permissions:`) throw new Error(`permissions must be a block map, not: ${lines[start].trim()}`);
  const map = {};
  for (const line of lines.slice(start + 1)) {
    if (!line.startsWith(`${pad}  `) || line.trim() === "") break;
    const pair = /^ +([a-z-]+): ([a-z]+)$/.exec(line);
    if (!pair || line.length - line.trimStart().length !== indent + 2) throw new Error(`unreadable permission line: ${line.trim()}`);
    map[pair[1]] = pair[2];
  }
  return map;
}

/** The workflow without comment lines, for every check. */
function withoutComments(text) {
  return text.split("\n").filter((line) => !/^\s*#/.test(line)).join("\n");
}

/** Shell only: step names and heredoc bodies (the JavaScript the steps feed to node) removed. */
function shellOnly(text) {
  return text
    .replace(/<<'JS'\n[\s\S]*?\n\s*JS\n/g, "<<'JS'\n")
    .split("\n")
    .filter((line) => !/^\s*- name:/.test(line))
    .join("\n");
}

/** Every problem the guard finds; an empty list means the workflow passes. */
export function workflowProblems(source) {
  const text = withoutComments(source);
  const problems = [];
  const jobsAt = text.indexOf("\njobs:\n");
  if (jobsAt === -1) return ["no top-level jobs: map"];
  const head = text.slice(0, jobsAt);
  if (/id-token/.test(head)) problems.push("the top level grants id-token");
  try {
    const top = permissionsAt(head, 0);
    if (JSON.stringify(top) !== JSON.stringify(TOP_LEVEL_PERMISSIONS)) problems.push(`top-level permissions are ${JSON.stringify(top)}`);
  } catch (error) {
    problems.push(`top level: ${error.message}`);
  }
  if (!/\n {2}push:\n {4}tags: \["v\*"\]\n {2}workflow_dispatch:/.test(head)) problems.push("triggers are not a v* tag push and workflow_dispatch");

  const blocks = text.slice(jobsAt + 1).split(/\n(?=  [a-z][a-z-]*:\n)/).slice(1);
  const jobs = Object.fromEntries(blocks.map((block) => [/^ {2}([a-z][a-z-]*):/.exec(block)[1], block]));
  if (JSON.stringify(Object.keys(jobs)) !== JSON.stringify(EXPECTED_JOBS)) problems.push(`jobs are ${Object.keys(jobs).join(", ")}`);
  for (const [name, block] of Object.entries(jobs)) {
    try {
      const actual = permissionsAt(block, 4);
      if (JSON.stringify(actual) !== JSON.stringify(EXPECTED_PERMISSIONS[name] ?? null)) {
        problems.push(`${name} permissions are ${JSON.stringify(actual)}, expected ${JSON.stringify(EXPECTED_PERMISSIONS[name] ?? null)}`);
      }
    } catch (error) {
      problems.push(`${name}: ${error.message}`);
    }
    if (name !== "publish" && /id-token/.test(block)) problems.push(`${name} mentions id-token`);
    if (!block.includes("github.repository == 'lookprep/lookprep-mcp'")) problems.push(`${name} is not limited to the public repository`);
  }

  const publish = jobs.publish ?? "";
  const publishShell = shellOnly(publish);
  if (/actions\/checkout@/.test(publish)) problems.push("publish checks out code");
  if (/\bnpx\b/.test(publish)) problems.push("publish runs npx");
  if (/scripts\//.test(publish)) problems.push("publish runs a package script");
  for (const [, command] of publishShell.matchAll(/(?:^|[\s|;&(])npm ([a-z-]+)/g)) {
    if (!["publish", "--version"].includes(command)) problems.push(`publish runs npm ${command}`);
  }
  if ((publish.match(/\bnpm publish\b/g) ?? []).length !== 1 ||
      !publish.includes('npm publish "./$TARBALL" --ignore-scripts --provenance --access public')) {
    problems.push("publish must run exactly one npm publish of the tarball with --ignore-scripts --provenance --access public");
  }
  for (const [, argument] of publishShell.matchAll(/(?:^|[\s|;&(])node (\S+)/g)) {
    if (!["-e", "--input-type=module"].includes(argument)) problems.push(`publish runs node ${argument}`);
  }
  if (!publish.includes(`EXPECTED_FILES: ${EXPECTED_FILES}\n`)) problems.push("publish does not fix the expected tarball file list");
  for (const check of ["does not match the build job's integrity", "tar\", [\"-tzf\"", "has install scripts", "are not exactly @modelcontextprotocol/sdk"]) {
    if (!publish.includes(check)) problems.push(`publish lacks the check: ${check}`);
  }
  if (!/environment: npm\n/.test(publish)) problems.push("publish is not in the npm environment");
  if (/environment:/.test(jobs.build ?? "")) problems.push("build holds a deployment environment");

  for (const [, reference] of text.matchAll(/uses: (\S+)/g)) {
    if (!/^actions\/[a-z-]+@[0-9a-f]{40}$/.test(reference)) problems.push(`action not pinned to an official commit: ${reference}`);
  }
  const secrets = [...new Set([...text.matchAll(/secrets\.([A-Za-z_]+)/g)].map((match) => match[1]))];
  if (JSON.stringify(secrets) !== JSON.stringify(["MCP_PRIVATE_KEY"])) problems.push(`secrets referenced: ${secrets.join(", ")}`);
  if (!/environment: mcp-registry\n/.test(jobs.registry ?? "")) problems.push("registry is not in the mcp-registry environment");
  return problems;
}

test("the release workflow passes the guard", () => {
  assert.deepEqual(workflowProblems(workflow), []);
});

const replaceOnce = (text, from, to) => {
  assert.ok(text.includes(from), `mutation anchor missing: ${from}`);
  return text.replace(from, to);
};
const buildPermissions = "    permissions:\n      contents: read\n    outputs:";

for (const [label, mutate, pattern] of [
  ["id-token at the top level", (text) => replaceOnce(text, "\npermissions:\n  contents: read\n", "\npermissions:\n  contents: read\n  id-token: write\n"), /top level grants id-token/],
  ["an extra permission on build", (text) => replaceOnce(text, buildPermissions, "    permissions:\n      contents: read\n      actions: write\n    outputs:"), /build permissions are/],
  ["id-token on build", (text) => replaceOnce(text, buildPermissions, "    permissions:\n      contents: read\n      id-token: write\n    outputs:"), /build/],
  ["npx in publish", (text) => replaceOnce(text, '        run: npm publish "./$TARBALL"', '        run: npx some-tool && npm publish "./$TARBALL"'), /publish runs npx/],
  ["another npm command in publish", (text) => replaceOnce(text, '        run: npm publish "./$TARBALL"', '        run: npm install && npm publish "./$TARBALL"'), /publish runs npm install/],
  ["node running a file in publish", (text) => replaceOnce(text, '        run: npm publish "./$TARBALL"', '        run: node ./dist/index.js && npm publish "./$TARBALL"'), /publish runs node \.\/dist\/index\.js/],
  ["a checkout in publish", (text) => replaceOnce(text, "      - uses: actions/download-artifact@", "      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1\n      - uses: actions/download-artifact@"), /publish checks out code/],
  ["a changed file list", (text) => replaceOnce(text, `EXPECTED_FILES: ${EXPECTED_FILES}`, `EXPECTED_FILES: ${EXPECTED_FILES} dist/extra.js`), /expected tarball file list/],
  ["an unpinned action", (text) => replaceOnce(text, "actions/setup-node@249970729cb0ef3589644e2896645e5dc5ba9c38", "actions/setup-node@v6"), /not pinned/],
  ["another secret", (text) => replaceOnce(text, "secrets.MCP_PRIVATE_KEY", "secrets.NPM_TOKEN"), /secrets referenced/],
]) {
  test(`the guard catches ${label}`, () => {
    const problems = workflowProblems(mutate(workflow));
    assert.ok(problems.some((problem) => pattern.test(problem)), problems.join("\n") || "no problem reported");
  });
}
