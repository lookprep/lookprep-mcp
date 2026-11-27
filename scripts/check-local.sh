#!/usr/bin/env bash
# The package's own gate: build (which type-checks), tests, server.json and
# release metadata. Offline: no request leaves the machine.
#   bash scripts/check-local.sh
set -euo pipefail
cd "$(dirname "$0")/.."

node_executable="$(command -v "${NODE_EXECUTABLE:-node}")"
npm_executable="${NPM_EXECUTABLE:-npm}"
export PATH="$(dirname "$node_executable"):$PATH"
"$node_executable" -e 'const [major] = process.versions.node.split(".").map(Number); if (major < 24) throw new Error("Node 24 or newer is required")'
test -d node_modules || { echo "Run npm ci --ignore-scripts first." >&2; exit 1; }
"$npm_executable" run build
"$npm_executable" test
"$node_executable" scripts/check-server-json.mjs
"$node_executable" scripts/check-release-metadata.mjs "v$("$node_executable" -p 'require("./package.json").version')"
"$node_executable" scripts/changelog-section.mjs "$("$node_executable" -p 'require("./package.json").version')" > /dev/null
# The tarball a release would publish (packed to a temporary folder, never published).
pack_dir="$(mktemp -d)"
trap 'rm -rf -- "${pack_dir:?}"' EXIT
"$npm_executable" pack --ignore-scripts --json --pack-destination "$pack_dir" > "$pack_dir/npm-pack.json"
package_root="$PWD"
version="$("$node_executable" -p 'require("./package.json").version')"
(cd "$pack_dir" && "$node_executable" "$package_root/scripts/check-npm-release-package.mjs" npm-pack.json "v$version")
if git rev-parse --is-inside-work-tree > /dev/null 2>&1; then
  git diff --check -- .
fi
