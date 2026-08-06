# Iqraa Cleanup Plan

**Status:** Proposal only — **do not implement until approved**  
**Based on:** `PROJECT_AUDIT.md`  
**Date:** 2026-08-01  

This plan lists every path recommended for **delete**, **move**, or **rename**, with why.  
It does **not** include feature work, OpenAPI sync, Docker/CI, or env-script rewrites (those are follow-on phases after structural cleanup).

---

## Principles

1. Product path stays: `artifacts/api-server`, `artifacts/mobile`, `lib/db`, `lib/api-*` (except unused client decision), `lib/integrations-openai-ai-server`.
2. Prefer **delete dead duplicates** over keeping “just in case.”
3. Prefer **move large/non-code assets out of git** before delete, when content may still be needed.
4. **Renames** (`artifacts/` → `apps/`) are optional and high-churn — separate approval.
5. No history rewrite / force-push unless you explicitly ask later.

---

## Safe changes

Low chance of breaking the running product. Still wait for approval before applying.

### Delete — legacy duplicate OpenAI tree (unused, not a package)

| Action | Path | Why |
|--------|------|-----|
| **DELETE** | `lib/integrations/` (entire folder) | Legacy dump; no `package.json`; nothing imports it. Canonical code is `lib/integrations-openai-ai-server`. |
| **DELETE** | `lib/integrations/openai_ai_integrations/src/client/audio/audio-playback-worklet.js` | Part of above |
| **DELETE** | `lib/integrations/openai_ai_integrations/src/client/audio/audio-utils.ts` | Part of above |
| **DELETE** | `lib/integrations/openai_ai_integrations/src/client/audio/index.ts` | Part of above |
| **DELETE** | `lib/integrations/openai_ai_integrations/src/client/audio/useAudioPlayback.ts` | Part of above |
| **DELETE** | `lib/integrations/openai_ai_integrations/src/client/audio/useVoiceRecorder.ts` | Part of above |
| **DELETE** | `lib/integrations/openai_ai_integrations/src/server/audio/client.ts` | Part of above |
| **DELETE** | `lib/integrations/openai_ai_integrations/src/server/audio/index.ts` | Part of above |
| **DELETE** | `lib/integrations/openai_ai_integrations/src/server/batch/index.ts` | Part of above |
| **DELETE** | `lib/integrations/openai_ai_integrations/src/server/batch/utils.ts` | Part of above |
| **DELETE** | `lib/integrations/openai_ai_integrations/src/server/image/client.ts` | Part of above |
| **DELETE** | `lib/integrations/openai_ai_integrations/src/server/image/index.ts` | Part of above |

Also update `pnpm-workspace.yaml`: remove workspace glob `lib/integrations/*` (no package remains).

### Delete — orphan React OpenAI package (zero importers)

| Action | Path | Why |
|--------|------|-----|
| **DELETE** | `lib/integrations-openai-ai-react/` (entire package) | No app imports `@workspace/integrations-openai-ai-react`. |
| **DELETE** | `lib/integrations-openai-ai-react/package.json` | Part of above |
| **DELETE** | `lib/integrations-openai-ai-react/tsconfig.json` | Part of above |
| **DELETE** | `lib/integrations-openai-ai-react/src/index.ts` | Part of above |
| **DELETE** | `lib/integrations-openai-ai-react/src/audio/*` | Part of above |

### Delete — scaffold scripts content (keep folder only if you want tooling later)

| Action | Path | Why |
|--------|------|-----|
| **DELETE** | `scripts/src/hello.ts` | Scaffold “hello” only; not used by product |
| **DELETE** | `scripts/post-merge.sh` | Replit `[postMerge]` hook; irrelevant on Cursor/GitHub unless you rewire it |
| **DELETE or EMPTY** | `scripts/` package | If nothing remains, remove whole `scripts/` package from workspace (`scripts/package.json`, `scripts/tsconfig.json`) **or** keep empty package for future tooling |

**Recommendation:** delete entire `scripts/` package and remove `"scripts"` from `pnpm-workspace.yaml` + root typecheck filter until real scripts exist.

### Delete — Python Replit stub (no Node wiring found)

| Action | Path | Why |
|--------|------|-----|
| **DELETE** | `main.py` | Prints “Hello from repl-nix-workspace!” only |
| **DELETE** | `pyproject.toml` | Declares `pymupdf` for unused Python stub |
| **DELETE** | `uv.lock` | Lockfile for that Python project |

> Note: root `package.json` also has `pdf-parse` (Node). That is separate — see “Needs verification.”

### Delete — agent-generated logo outputs (duplicates of brand experiments)

| Action | Path | Why |
|--------|------|-----|
| **DELETE** | `.agents/outputs/` (entire folder) | Generated PNGs from agent icon scripts; product icons already live under `artifacts/mobile/assets/` |
| **DELETE** | `.agents/outputs/full_3x.png` | Part of above |
| **DELETE** | `.agents/outputs/icon_mark.png` | Part of above |
| **DELETE** | `.agents/outputs/icon_tight.png` | Part of above |
| **DELETE** | `.agents/outputs/lockup.png` | Part of above |
| **DELETE** | `.agents/outputs/lockup_clean.png` | Part of above |
| **DELETE** | `.agents/outputs/logo_full.png` | Part of above |
| **DELETE** | `.agents/outputs/onemerald.png` | Part of above |
| **DELETE** | `.agents/outputs/onemerald_v2.png` | Part of above |
| **DELETE** | `.agents/outputs/variants.png` | Part of above |

### Delete — one-off agent logo scripts (optional but safe if icons finalized)

| Action | Path | Why |
|--------|------|-----|
| **DELETE** | `.agents/scripts/build_app_icons.py` | One-off asset generation |
| **DELETE** | `.agents/scripts/build_app_icons2.py` | One-off asset generation |
| **DELETE** | `.agents/scripts/build_icons_final.py` | One-off asset generation |
| **DELETE** | `.agents/scripts/crop_logo.py` | One-off asset generation |
| **DELETE** | `.agents/scripts/extract_logo.py` | One-off asset generation |
| **DELETE** | `.agents/scripts/gen_assets.py` | One-off asset generation |

### Delete — pasted prompt text in attachments (not runtime)

| Action | Path | Why |
|--------|------|-----|
| **DELETE** | `attached_assets/Pasted-1-Interactive-Classroom-2-0-Hero-Feature-Transform-acti_1785322085822.txt` | Chat paste / planning prompt |
| **DELETE** | `attached_assets/Pasted-Given-your-objective-an-investor-ready-MVP-not-a-produc_1785355908058.txt` | Chat paste |
| **DELETE** | `attached_assets/Pasted-I-agree-Since-you-re-moving-from-a-prototype-to-a-usabl_1785249939226.txt` | Chat paste |
| **DELETE** | `attached_assets/Pasted-I-would-not-ask-the-AI-developer-to-build-one-activity-_1785250550894.txt` | Chat paste |
| **DELETE** | `attached_assets/Pasted-Use-the-following-as-the-master-prompt-for-your-develop_1785069044337.txt` | Chat paste |

### Edit-only (safe config hygiene — listed for completeness; not file deletes)

These are **file edits**, not deletes — include in Safe phase if you approve “Safe + config”:

| Action | Path | Why |
|--------|------|-----|
| **EDIT** | `.gitignore` | Add `.config/`, `attached_assets/` (after untrack), `.agents/outputs/`, `.env`, `.env.local` |
| **EDIT** | `package.json` | Remove unused `"@replit/connectors-sdk"` dependency (no imports found) |
| **EDIT** | `pnpm-workspace.yaml` | Drop `lib/integrations/*`; later also fix Windows binary overrides (Phase A — separate) |

### Keep (do not delete in Safe phase)

| Path | Why keep for now |
|------|------------------|
| `.agents/memory/*.md` | Useful architecture notes; low cost |
| `artifacts/api-server/` | Product backend |
| `artifacts/mobile/` | Product frontend |
| `lib/db/`, `lib/api-spec/`, `lib/api-zod/`, `lib/integrations-openai-ai-server/` | Active shared libs |
| `PROJECT_AUDIT.md`, `CLEANUP_PLAN.md` | Planning docs |

---

## Changes that need verification

Confirm before delete/move. Product may still depend indirectly, or content may be valuable offline.

### A. Large curriculum / brand files in `attached_assets/`

**Recommendation:** **MOVE out of git** (external backup / Drive / private bucket), then delete from repo. Do **not** delete without backup.

| Action | Path | Size (approx) | Why / verify |
|--------|------|---------------|--------------|
| **MOVE → external, then DELETE from git** | `attached_assets/TE010_Book-teacher_guiede,_10th_grade,_semster_one_1785147998881.pdf` | ~56 MB (LFS) | Curriculum source; not imported by app code — confirm KB doesn’t expect this path |
| **MOVE → external, then DELETE from git** | `attached_assets/10th_grade,_math,_2nd_semester_1785147978008.pdf` | ~32 MB | Same |
| **MOVE → external, then DELETE from git** | `attached_assets/10th_grade,_alchamy1st_semester_1785071530814.pdf` | ~28 MB | Same |
| **MOVE → external, then DELETE from git** | `attached_assets/Book10_2_Proof3_WEB-teacher_guiede,_10th_grade,_semster_two_1785147998881.pdf` | ~15 MB | Same |
| **MOVE → external, then DELETE from git** | `attached_assets/10th_grade,_math,_1st_semester_1785071530816.pdf` | ~12 MB | Same |
| **MOVE → external, then DELETE from git** | `attached_assets/2026_MT10_WB1__10th_grade,_math_excersice_book,_semster_one_1785147998882.pdf` | ~6 MB | Same |
| **MOVE → external, then DELETE from git** | `attached_assets/MA_10_WB2_6_11_2025-mather_exccersie_book,_semster_2_1785147998882.pdf` | ~4 MB | Same |
| **MOVE or KEEP selectively** | `attached_assets/0_ikraa_logo_1785351722832.png` | ~1.3 MB | Brand source — verify vs `artifacts/mobile/assets/images/*` |
| **MOVE or KEEP selectively** | `attached_assets/0_2_1785351868534.png` | ~1.4 MB | Brand source — verify duplicate |
| **MOVE or KEEP selectively** | `attached_assets/Iqra_logo_1785192418025.pdf` | ~0.03 MB | Logo vector source — may want in `docs/brand/` instead of delete |
| **DELETE after confirm unused** | `attached_assets/image_1785151788948.png` | ~0.1 MB | Likely chat screenshot |
| **DELETE after confirm unused** | `attached_assets/image_1785164980452.png` | ~0.08 MB | Likely chat screenshot |
| **DELETE after confirm unused** | `attached_assets/image_1785192010328.png` | ~0.1 MB | Likely chat screenshot |
| **DELETE after confirm unused** | `attached_assets/image_1785192218888.png` | ~0.09 MB | Likely chat screenshot |
| **DELETE after confirm unused** | `attached_assets/image_1785256020068.png` | ~0.11 MB | Likely chat screenshot |
| **DELETE after confirm unused** | `attached_assets/image_1785355482776.png` | ~0.16 MB | Likely chat screenshot |
| **DELETE after confirm unused** | `attached_assets/image_1785395211752.png` | ~0.07 MB | Likely chat screenshot |
| **DELETE folder when empty** | `attached_assets/` | — | After all files handled |

**Verification steps:**

1. Grep codebase for `attached_assets` path references.  
2. Confirm mobile knowledge-base / curriculum data is embedded or fetched elsewhere (not these PDF paths).  
3. Backup PDFs externally, then remove from git.

### B. Design sandbox (`mockup-sandbox`)

| Action | Path | Why / verify |
|--------|------|--------------|
| **Option 1 — DELETE** | `artifacts/mockup-sandbox/` (entire app) | Not product UI; heavy Radix/shadcn kit; Replit Canvas only |
| **Option 2 — MOVE** | `artifacts/mockup-sandbox/` → `tooling/mockup-sandbox/` or separate repo | Keep if you still design in Canvas-like previews |
| **DELETE with sandbox** | `artifacts/mockup-sandbox/.replit-artifact/artifact.toml` | Deploy metadata for design service |
| **DELETE with sandbox** | All of `artifacts/mockup-sandbox/src/components/ui/**` | shadcn kit unused by Expo app |
| **DELETE with sandbox** | `artifacts/mockup-sandbox/src/components/mockups/templates/BenchmadeFluencyCatalog-ofS7e3/` | Sample mockup only |

**Verification:** Confirm you do not plan to use Replit Canvas / component preview. Expo app does not import this package.

### C. Unused generated API client dependency

| Action | Path | Why / verify |
|--------|------|--------------|
| **Option A — DELETE package usage** | Remove `@workspace/api-client-react` from `artifacts/mobile/package.json` and `artifacts/mobile/tsconfig.json` references | Mobile uses hand-written `services/apiClient.ts` instead |
| **Option B — KEEP package** | Keep `lib/api-client-react/` | Only if you plan to adopt generated hooks soon |
| **Do not delete blindly** | `lib/api-client-react/` | Still part of Orval codegen pipeline from `api-spec` |

**Verification:** Decide adopt-vs-drop. If drop dependency only, keep generated package for future or also stop generating it in `orval.config.ts`.

### D. Root `pdf-parse` dependency

| Action | Path | Why / verify |
|--------|------|--------------|
| **EDIT / possibly REMOVE** | `package.json` → `"pdf-parse"` | Present at root; verify any import before removal (Python `pymupdf` is separate) |

### E. Agent memory docs

| Action | Path | Why / verify |
|--------|------|--------------|
| **KEEP or MOVE** | `.agents/memory/MEMORY.md` | Useful; optionally move → `docs/agents/` |
| **KEEP or MOVE** | `.agents/memory/ai-integration.md` | Documents Replit AI env — still relevant until env renamed |
| **KEEP or MOVE** | `.agents/memory/auth-workspace-api.md` | Auth notes |
| **KEEP or MOVE** | `.agents/memory/iqra-architecture.md` | Architecture notes |
| **DELETE folder if emptied** | `.agents/skills/` | Empty on disk; not valuable |
| **DELETE or KEEP** | `.agents/` root | After outputs/scripts removed, either keep `memory/` or move to `docs/` |

### F. Replit config (safe only after Cursor local scripts exist)

| Action | Path | Why / verify |
|--------|------|--------------|
| **DELETE after Cursor runbooks work** | `.replit` | Replit workflows/deploy; deleting early loses Replit run button if still used |
| **DELETE after Cursor runbooks work** | `.replitignore` | Replit-only |
| **DELETE or REPLACE** | `replit.md` | Partially stale; replace with `README.md` for Cursor |
| **DELETE after Cursor deploy path exists** | `artifacts/api-server/.replit-artifact/artifact.toml` | Replit API service definition |
| **DELETE after Cursor deploy path exists** | `artifacts/mobile/.replit-artifact/artifact.toml` | Replit Expo service definition |
| **DELETE with sandbox decision** | `artifacts/mockup-sandbox/.replit-artifact/artifact.toml` | Replit design service |

**Verification:** Explicit decision: “fully leave Replit” vs “keep dual deploy for a while.”

---

## High-risk changes

Do these only with explicit approval. High blast radius (imports, lockfile, deploy, git history).

### 1. Monorepo rename (`artifacts/` / `lib/` → `apps/` / `packages/`)

| Action | From | To | Why risky |
|--------|------|-----|-----------|
| **RENAME** | `artifacts/api-server/` | `apps/api/` | Breaks every import path, filters, artifact.toml, docs, CI mental model |
| **RENAME** | `artifacts/mobile/` | `apps/mobile/` | Same + Expo paths |
| **RENAME** | `artifacts/mockup-sandbox/` | `tooling/mockup-sandbox/` or delete | Coupled to sandbox decision |
| **RENAME** | `lib/db/` | `packages/db/` | Workspace name `@workspace/db` can stay, but all path refs change |
| **RENAME** | `lib/api-spec/` | `packages/api-spec/` | Codegen paths in Orval |
| **RENAME** | `lib/api-zod/` | `packages/api-zod/` | TS project references |
| **RENAME** | `lib/api-client-react/` | `packages/api-client/` | Same |
| **RENAME** | `lib/integrations-openai-ai-server/` | `packages/openai/` | Import paths in api-server |
| **EDIT** | `pnpm-workspace.yaml`, root `package.json`, all `tsconfig*`, Orval config, any relative imports | — | Must be atomic |

**Recommendation:** Defer until after Safe + Verification cleanup and local Cursor scripts work.

### 2. Delete entire product-adjacent packages without replacement

| Action | Path | Why high-risk |
|--------|------|---------------|
| **DELETE** | `lib/api-client-react/` entire package | Breaks codegen + mobile `package.json` / tsconfig references even if unused in source |
| **DELETE** | `lib/api-zod/` | api-server health route imports it |
| **DELETE** | `lib/api-spec/` | Source of truth for contracts (even if stale) |
| **DELETE** | `artifacts/mobile/server/serve.js` | Production web serve path on Replit |

### 3. Git history / LFS binary purge

| Action | Path | Why high-risk |
|--------|------|---------------|
| **HISTORY REWRITE** | Remove large PDFs from all commits / LFS | Requires `git filter-repo` or BFG + force-push; breaks clones |
| **LFS cleanup** | `attached_assets/TE010_Book-...pdf` | Coordinated LFS + remote cleanup |

**Recommendation:** First commit “stop tracking + delete from tree.” History purge only if repo size still hurts.

### 4. Platform override + install changes (not deletes, but high-risk ops)

| Action | Path | Why high-risk |
|--------|------|---------------|
| **EDIT** | `pnpm-workspace.yaml` `overrides` that zero win32/darwin binaries | Required for Windows, but can change lockfile / CI linux behavior |
| **EDIT** | Mobile `package.json` `dev` / `scripts/build.js` | Easy to break Expo web deploy while fixing Cursor local |

These belong in **Phase A (local viability)**, not structural delete — listed so they’re not mistaken for “safe cleanup.”

### 5. Local branches / remotes cleanup (git metadata)

| Action | Ref | Why high-risk if careless |
|--------|-----|---------------------------|
| **DELETE local branches** | `subrepl-*`, `replit-agent` | Safe locally if merged; verify nothing unique remains |
| **DELETE remotes** | `subrepl-*`, `gitsafe-backup` | May still be needed for recovery; confirm before `git remote remove` |

Not file-tree cleanup; do separately.

---

## Proposed execution order (after approval)

### Wave 1 — Safe (approve: “Safe”)

1. Delete `lib/integrations/`  
2. Delete `lib/integrations-openai-ai-react/`  
3. Delete `scripts/` package (or hello + post-merge only)  
4. Delete `main.py`, `pyproject.toml`, `uv.lock`  
5. Delete `.agents/outputs/` + `.agents/scripts/`  
6. Delete `attached_assets/Pasted-*.txt`  
7. Remove `@replit/connectors-sdk` from root `package.json`  
8. Update `.gitignore` + `pnpm-workspace.yaml` globs  

### Wave 2 — After verification (approve per item)

1. Backup then remove curriculum PDFs / unused images from `attached_assets/`  
2. Decide mockup-sandbox: delete vs move  
3. Decide api-client-react: drop mobile dep vs adopt  
4. Decide `.agents/memory`: keep vs move to `docs/`  
5. Decide Replit files: keep temporarily vs delete  

### Wave 3 — High-risk (explicit separate approval)

1. Rename `artifacts/` → `apps/`, `lib/` → `packages/`  
2. Optional git history purge of large binaries  
3. Platform override + mobile/API local script migration (Phase A)

---

## Out of scope for this cleanup plan

(Do later; not delete/move/rename of dead trees)

- Fix Windows esbuild overrides / `pnpm install`  
- Add `.env.example` and Cursor `dev` scripts  
- Sync OpenAPI with Express  
- Dockerfile / CI  
- CORS / production hardening  
- Feature development  

---

## Approval checklist

Reply with one of:

- **“Approve Wave 1 (Safe)”** — implement only Safe deletes/edits  
- **“Approve Wave 1 + assets backup plan”** — Safe + I’ll prepare attached_assets removal after you confirm backup location  
- **“Approve Wave 2 items: …”** — list which verification items  
- **“Approve rename to apps/packages”** — Wave 3 rename only when ready  
- **“Do not delete X”** — exceptions  

**Nothing will be modified until you approve.**
