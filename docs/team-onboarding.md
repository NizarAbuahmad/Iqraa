# Team onboarding: Claude Code on Iqrra

What each new developer sets up **themselves**, and what the repo already gives
them. Working rules (PRs, worktrees, secrets, brand spelling) are in
[`CLAUDE.md`](../CLAUDE.md), under *Working here with Claude Code*.

This repo is public. Never paste a key, token, connection string or `.env`
content into an issue, PR, commit, or Claude session.

## What the repo already provides

| File | What it gives you |
| --- | --- |
| `CLAUDE.md` | Project context and the team rules Claude reads at session start |
| `.claude/settings.json` | Shared permissions: pnpm, tests, typecheck, read-only `git` and `gh` are pre-approved; reading `.env` files, printing Cloud Run env, force-pushing and pushing to `main` are denied |
| `.mcp.json` | The Playwright MCP server (pinned version, no credentials). Claude Code asks you to approve a project MCP server the first time |
| *Limits of the deny list* | The deny rules are prefix matches. They do not cover PowerShell or every shell form, so branch protection and not reading `.env` files remain the real guards. |
| `.claude/agents/`, `.claude/skills/` | `api-dev`, `mobile-dev`, `test-writer`, `code-reviewer` agents and the vendored Superpowers skills |
| `.claude/settings.local.json`, `CLAUDE.local.md` | Yours; gitignored. Put personal permissions and preferences here |

## What you set up yourself

Access is granted per person by the project owner. **Do not share or reuse
anyone's keys.** Ask for the access, then sign in with your own account.

1. **A Claude seat.** Your own Claude account or team seat, signed in to Claude
   Code (`claude`, then `/login`). Seats are not shared.
2. **GitHub.** Collaborator access to the repo, then `gh auth login` with your own
   account. Work on a branch and open a PR; `main` is protected.
3. **Local tooling.** Node and pnpm as pinned in `.github/workflows/ci.yml`, plus
   Python for `artifacts/math-verifier`. Follow [`LOCAL_SETUP.md`](../LOCAL_SETUP.md);
   the local `.env` points at a local Postgres, not production.
4. **Only if your work needs them**, and only through your own account or IAM role:
   - **Google Cloud** (project `iqraa-auth-507315`): a role on Cloud Run and, for
     whoever rotates credentials, Secret Manager. Install `gcloud` and run
     `gcloud auth login`. No service-account key files.
   - **Neon** (Postgres): a member seat in the Neon organisation. Production
     schema changes go through migrations in CI, so most people never need it.
   - **Cloudflare** (Pages, the web host): a member seat. The web deploy runs from
     GitHub Actions, so day-to-day work needs none.
   - **Expo / EAS** (builds and OTA updates): an Expo account added to the project
     organisation. The OTA workflow uses the repository's own `EXPO_TOKEN`
     secret; you never handle it.
   - **Google Play Console**, **PostHog**, **Resend**: ask for a seat when a task
     needs one.
5. **Your first session.** Start Claude Code in a worktree, not the shared
   checkout (`git worktree add ../wt-<task> -b <branch> origin/main`), run
   `pnpm install`, `tsc --build`, and `pnpm run typecheck`, and ask Claude to read
   `CLAUDE.md` and `STATUS.md` before it edits anything.

## Left for the project owner

- Whether `main` should also require one approving review. It requires an
  up-to-date branch and a green `typecheck + tests` today, and no review.
- Which GitHub secrets, GCP roles and Neon / Cloudflare / Expo seats each person
  gets. This file only says what to ask for.
