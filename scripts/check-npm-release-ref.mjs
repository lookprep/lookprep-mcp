// Release authorization gate for the public repository's release workflow.
// A push must be a newly created stable tag on main; a manual run (which only
// resumes the Registry and GitHub Release steps, never npm) names an existing
// stable tag on main. Either way package.json at the tag must carry the tag's
// version. Contacts nothing and publishes nothing.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

export const RELEASE_REPOSITORY = "lookprep/lookprep-mcp";
export const PACKAGE_NAME = "lookprep-mcp";

export function resolveRelease({ tag, eventName, ref, repository, event, workflowSha, cwd = process.cwd() }) {
  if (repository !== RELEASE_REPOSITORY) throw new Error("Unexpected repository");
  if (!/^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(tag ?? "")) {
    throw new Error("Release tag must be stable v<major>.<minor>.<patch>");
  }
  const git = (...args) => execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  if (eventName === "push") {
    if (ref !== `refs/tags/${tag}` || event?.created !== true || event?.deleted || event?.forced) {
      throw new Error("Only a newly created release tag may publish");
    }
  } else if (eventName !== "workflow_dispatch") {
    throw new Error("Unsupported release event");
  }
  const sha = git("rev-parse", "--verify", `refs/tags/${tag}^{commit}`);
  git("merge-base", "--is-ancestor", sha, "refs/remotes/origin/main");
  if (eventName === "push") {
    // npm provenance names the workflow commit, so it must be the tag commit.
    if (workflowSha !== sha) throw new Error("Workflow commit must equal the release tag commit");
    if (![sha, git("rev-parse", `refs/tags/${tag}`)].includes(event.after)) {
      throw new Error("Pushed tag no longer matches the event");
    }
  }
  const pkg = JSON.parse(git("show", `${sha}:package.json`));
  if (pkg.name !== PACKAGE_NAME || `v${pkg.version}` !== tag) {
    throw new Error("Release tag does not match the package name and version");
  }
  return { tag, version: pkg.version, sha };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = resolveRelease({
    tag: process.env.RELEASE_TAG,
    eventName: process.env.GITHUB_EVENT_NAME,
    workflowSha: process.env.GITHUB_SHA,
    ref: process.env.GITHUB_REF,
    repository: process.env.GITHUB_REPOSITORY,
    event: JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, "utf8")),
  });
  for (const [key, value] of Object.entries(result)) console.log(`${key}=${value}`);
}
