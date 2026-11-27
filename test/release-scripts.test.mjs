// The offline release gates the release workflow runs. Temporary local Git
// repositories only; nothing is published or fetched.
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { resolveRelease } from "../scripts/check-npm-release-ref.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const { version } = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"));
const node = (script, ...args) => spawnSync(process.execPath, [path.join(root, "scripts", script), ...args], { encoding: "utf8" });

test("check-release-metadata accepts the package's own version and refuses any other", () => {
  const ok = node("check-release-metadata.mjs", `v${version}`);
  assert.equal(ok.status, 0, ok.stderr);
  const wrong = node("check-release-metadata.mjs", "v99.0.0");
  assert.notEqual(wrong.status, 0);
  assert.match(wrong.stderr, /package\.json version is "1|package\.json version is/);
  assert.notEqual(node("check-release-metadata.mjs", "1.0.0").status, 0, "the tag needs its v");
});

test("check-server-json accepts server.json", () => {
  const result = node("check-server-json.mjs");
  assert.equal(result.status, 0, result.stderr);
});

test("changelog-section prints the version's notes and refuses a missing one", () => {
  const result = node("changelog-section.mjs", version);
  assert.equal(result.status, 0, result.stderr);
  assert.ok(result.stdout.trim().length > 0);
  assert.doesNotMatch(result.stdout, /^## /m);
  assert.notEqual(node("changelog-section.mjs", "99.0.0").status, 0);
});

function fixture(t, { pkgVersion = "1.2.3", onMain = true } = {}) {
  const dir = mkdtempSync(path.join(tmpdir(), "release-ref-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const git = (...args) => execFileSync("git", ["-c", "user.name=test", "-c", "user.email=test@example.com", ...args], { cwd: dir, encoding: "utf8" }).trim();
  git("init", "-q", "-b", "main");
  writeFileSync(path.join(dir, "package.json"), JSON.stringify({ name: "lookprep-mcp", version: pkgVersion }));
  git("add", "-A");
  git("commit", "-q", "-m", "release");
  if (!onMain) {
    git("checkout", "-q", "-b", "side");
    writeFileSync(path.join(dir, "side.txt"), "x");
    git("add", "-A");
    git("commit", "-q", "-m", "side");
  }
  git("tag", "v1.2.3");
  const sha = git("rev-parse", "HEAD");
  git("checkout", "-q", "main");
  git("update-ref", "refs/remotes/origin/main", "main");
  return { dir, sha };
}

const push = (sha, extra = {}) => ({
  tag: "v1.2.3",
  eventName: "push",
  ref: "refs/tags/v1.2.3",
  repository: "lookprep/lookprep-mcp",
  event: { created: true, deleted: false, forced: false, after: sha },
  workflowSha: sha,
  ...extra,
});

test("a new stable tag on main with the same package version is released", (t) => {
  const { dir, sha } = fixture(t);
  assert.deepEqual(resolveRelease({ ...push(sha), cwd: dir }), { tag: "v1.2.3", version: "1.2.3", sha });
});

test("the release gate refuses everything else", (t) => {
  const { dir, sha } = fixture(t);
  const refuse = (extra, pattern) => assert.throws(() => resolveRelease({ ...push(sha, extra), cwd: dir }), pattern);
  refuse({ repository: "someone/lookprep-mcp" }, /Unexpected repository/);
  refuse({ tag: "v1.2.3-rc.1", ref: "refs/tags/v1.2.3-rc.1" }, /stable/);
  refuse({ event: { created: false, after: sha } }, /newly created/);
  refuse({ event: { created: true, forced: true, after: sha } }, /newly created/);
  refuse({ workflowSha: "0".repeat(40) }, /must equal the release tag commit/);
  refuse({ eventName: "schedule" }, /Unsupported/);
});

test("a manual run resumes an existing tag on main without the push checks", (t) => {
  const { dir, sha } = fixture(t);
  assert.equal(resolveRelease({ tag: "v1.2.3", eventName: "workflow_dispatch", repository: "lookprep/lookprep-mcp", workflowSha: "f".repeat(40), cwd: dir }).sha, sha);
});

test("a tag off main or with another package version is refused", (t) => {
  const off = fixture(t, { onMain: false });
  assert.throws(() => resolveRelease({ ...push(off.sha), cwd: off.dir }));
  const mismatch = fixture(t, { pkgVersion: "1.2.4" });
  assert.throws(() => resolveRelease({ ...push(mismatch.sha), cwd: mismatch.dir }), /does not match/);
});
