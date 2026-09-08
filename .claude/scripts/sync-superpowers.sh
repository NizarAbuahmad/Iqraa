#!/usr/bin/env bash
# Re-sync the vendored Superpowers skills in .claude/skills/ from upstream.
#
#   .claude/scripts/sync-superpowers.sh [git-ref]
#
# Defaults to `main`. Review `git diff` afterwards and update the version and
# commit recorded in .claude/SUPERPOWERS.md before committing.

set -euo pipefail

REF="${1:-main}"
UPSTREAM="https://github.com/obra/superpowers.git"
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
DEST="${ROOT}/.claude/skills"

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

echo "Cloning ${UPSTREAM} @ ${REF}..."
git clone --quiet --depth 1 --branch "$REF" "$UPSTREAM" "$TMP/superpowers" 2>/dev/null \
  || git clone --quiet "$UPSTREAM" "$TMP/superpowers"
git -C "$TMP/superpowers" checkout --quiet "$REF"

VERSION="$(jq -r .version "$TMP/superpowers/.claude-plugin/plugin.json")"
COMMIT="$(git -C "$TMP/superpowers" rev-parse HEAD)"

rm -rf "$DEST"
mkdir -p "$DEST"
cp -R "$TMP/superpowers/skills/." "$DEST/"
cp "$TMP/superpowers/LICENSE" "${ROOT}/.claude/LICENSE-superpowers"

# Upstream ships as a plugin, where skills are addressed as
# `superpowers:<name>`. Vendored as project skills they are addressed by bare
# name, so rewrite the cross-references or every `Skill` call misses.
grep -rl 'superpowers:' "$DEST" | while read -r f; do
  sed -i 's/superpowers:\([a-z0-9][a-z0-9-]*\)/\1/g' "$f"
done

echo
echo "Synced Superpowers v${VERSION} (${COMMIT})"
echo "Update .claude/SUPERPOWERS.md with that version and commit, then review 'git diff'."
