#!/usr/bin/env bash
# SessionStart hook for the vendored Superpowers skills (.claude/skills/).
#
# Injects the full text of the `using-superpowers` skill into the session so
# the other Superpowers skills get invoked automatically. Adapted from
# upstream's hooks/session-start for a project-local install: upstream
# branches on $CLAUDE_PLUGIN_ROOT, which is only set for plugin installs.
#
# Never fail the session — a broken hook here must not block Claude Code, so
# any problem exits 0 with no context injected.

set -uo pipefail

ROOT="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "$0")/../.." && pwd)}"
SKILL="${ROOT}/.claude/skills/using-superpowers/SKILL.md"

[ -r "$SKILL" ] || exit 0
command -v jq >/dev/null 2>&1 || exit 0

jq -Rs --rawfile skill "$SKILL" '
  {
    hookSpecificOutput: {
      hookEventName: "SessionStart",
      additionalContext: (
        "<EXTREMELY_IMPORTANT>\nYou have superpowers.\n\n"
        + "**Below is the full content of your `using-superpowers` skill - "
        + "your introduction to using skills. For all other skills, use the "
        + "`Skill` tool:**\n\n"
        + $skill
        + "\n</EXTREMELY_IMPORTANT>"
      )
    }
  }
' </dev/null

exit 0
