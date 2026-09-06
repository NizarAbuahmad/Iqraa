# Superpowers (vendored)

[Superpowers](https://github.com/obra/superpowers) by Jesse Vincent — a skills
library that pushes a coding agent through spec → plan → TDD → review instead of
straight into code. Vendored into this repo so it is active for anyone working
on Iqraa, including Claude Code web sessions (which run in throwaway containers
where a normal plugin install would not survive).

| | |
| --- | --- |
| Upstream | https://github.com/obra/superpowers |
| Version | 6.3.0 |
| Commit | `b36e0829c6d0140e93cfef2ca599b1b07d4a7797` |
| Vendored | 2026-08-22 |
| License | MIT — see [`LICENSE-superpowers`](./LICENSE-superpowers) |

## What is here

- `skills/` — the 14 upstream skills, unmodified except for the rename below.
- `hooks/superpowers-session-start.sh` — injects the `using-superpowers` skill
  at session start so the rest trigger on their own.
- `settings.json` — registers that hook on `startup|clear|compact`.
- `scripts/sync-superpowers.sh` — re-syncs `skills/` from upstream.

The skills: `brainstorming`, `dispatching-parallel-agents`, `executing-plans`,
`finishing-a-development-branch`, `receiving-code-review`,
`requesting-code-review`, `subagent-driven-development`, `systematic-debugging`,
`test-driven-development`, `using-git-worktrees`, `using-superpowers`,
`verification-before-completion`, `writing-plans`, `writing-skills`.

## The one modification

Upstream ships as a Claude Code **plugin**, where skills are addressed as
`superpowers:brainstorming`. Vendored as **project skills** they are addressed
by bare name (`brainstorming`), so every `superpowers:<name>` cross-reference in
the skill text was rewritten to `<name>`. Without that rewrite each
skill-to-skill handoff resolves to nothing. `sync-superpowers.sh` reapplies it.

The upstream session-start hook was also rewritten rather than copied: it
branches on `$CLAUDE_PLUGIN_ROOT`, which is only set for plugin installs, and
would emit the wrong JSON shape here.

## Updating

```bash
.claude/scripts/sync-superpowers.sh          # or: ... <git-ref>
```

Then update the version and commit in the table above and review `git diff`.

## If you would rather have the plugin

The vendored copy and the upstream plugin define the same skill names. Running
`/plugin install superpowers@claude-plugins-official` in your own Claude Code
gives you auto-updates across every project — but if you do that while this
directory exists, the skills are defined twice for this repo. Pick one.
