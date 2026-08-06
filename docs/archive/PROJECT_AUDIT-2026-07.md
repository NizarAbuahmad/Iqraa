# Iqraa Project Audit

**Date:** 2026-08-01  
**Repo:** https://github.com/NizarAbuahmad/Iqraa.git  
**Branch:** `main` @ `77c6fb6`  
**Context:** Migrated from Replit → Cursor; audit only — **no files were modified** for product code as part of this audit (this report file is the deliverable).  
**Status:** Awaiting approval before any cleanup or refactor.

---

## Executive summary

Iqraa is a **pnpm monorepo** for an Arabic/English teaching assistant (“Iqra”). The **product frontend is Expo** (`artifacts/mobile`, web + native). The **product backend is Express** (`artifacts/api-server`). Shared packages live under `lib/`. Much of the tree is still **Replit-shaped**: artifact TOMLs, Replit env vars, a design sandbox, agent memory, and large chat attachments.

**Primary package.json:** root `package.json` (workspace orchestrator).  
**Product apps to run:** `@workspace/api-server` + `@workspace/mobile`.  
**Not product UI:** `@workspace/mockup-sandbox`.

**Highest-priority blockers for Cursor/Windows + production deploy:**

1. `node_modules` is not installed yet.
2. `pnpm-workspace.yaml` strips **Windows** (and macOS) native binaries for esbuild/lightningcss/rollup — Replit linux-x64 only.
3. Mobile `dev` / `build` scripts require Replit domain env vars.
4. OpenAI client expects Replit AI Integration env vars (`AI_INTEGRATIONS_OPENAI_*`), not a plain `OPENAI_API_KEY`.
5. No Dockerfile / CI / `.env.example`; OpenAPI is out of sync with real API routes.
6. Large PDFs (~100MB+) are tracked in git (plus one LFS file).

---

## Current architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Root workspace (pnpm)                        │
│  package.json · pnpm-workspace.yaml · tsconfig*.json             │
└─────────────┬───────────────────────────────┬───────────────────┘
              │                               │
     ┌────────▼────────┐             ┌────────▼────────┐
     │   artifacts/    │             │      lib/       │
     │  (runnable apps)│             │ (shared libs)   │
     └────────┬────────┘             └────────┬────────┘
              │                               │
   ┌──────────┼──────────┐     ┌──────────────┼──────────────────┐
   │          │          │     │              │                  │
   ▼          ▼          ▼     ▼              ▼                  ▼
 api-server  mobile  mockup-  db         api-spec          integrations-
 (Express)   (Expo)  sandbox  (Drizzle)  → codegen         openai-ai-*
             product  design  Postgres   api-zod           (OpenAI wrapper)
             UI       only               api-client-react
```

### Runtime dependency graph (workspace packages)

```
@workspace/api-spec  --(orval codegen)-->  @workspace/api-zod
                                       \-> @workspace/api-client-react

@workspace/api-server
  ├── @workspace/api-zod
  ├── @workspace/db
  └── @workspace/integrations-openai-ai-server

@workspace/mobile
  └── @workspace/api-client-react   (declared; not imported in app source)
      + hand-written services/apiClient.ts / RemoteAIService.ts

@workspace/mockup-sandbox          (no @workspace/* deps)
@workspace/integrations-openai-ai-react  (orphan)
@workspace/scripts                 (scaffold only)
```

### How the application starts

| App | Dev command | What happens |
|-----|-------------|--------------|
| API | `pnpm --filter @workspace/api-server run dev` | `build.mjs` (esbuild) → `node dist/index.mjs`; listens on `PORT` |
| Mobile | `pnpm --filter @workspace/mobile run dev` | Expo start; **currently wired to Replit env** |
| Mobile web prod | `build` then `serve` | Static Expo web build + `server/serve.js` |
| Mockup | `pnpm --filter @workspace/mockup-sandbox run dev` | Vite; needs `PORT` + `BASE_PATH` |

API entry flow:

1. `artifacts/api-server/src/index.ts` — requires `PORT`, starts listener  
2. `src/app.ts` — Express + pino-http + cors + JSON → mounts `/api`  
3. `src/routes/index.ts` — health, auth, workspace, chat, generate  

Mobile entry:

1. Expo Router (`main`: `expo-router/entry`)  
2. `artifacts/mobile/app/_layout.tsx` + route groups `(auth)`, `(tabs)`, `ai-tools/`, `curriculum/`, `workspace/`  

---

## 1. Repository structure (top-level)

| Path | Purpose | Actively used? | Keep / clean? |
|------|---------|----------------|---------------|
| `artifacts/` | Runnable apps (Replit “artifacts” naming) | **Yes** — product + tooling | Keep; rename later if desired |
| `lib/` | Shared TypeScript packages | **Yes** (most) | Keep; remove legacy duplicate |
| `scripts/` | Workspace scripts package | Minimal (`hello`) | Keep folder; content is scaffold |
| `attached_assets/` | Replit chat uploads (PDFs, logos, pasted prompts) | Reference / scratch | **Not needed in git** for deploy |
| `.agents/` | Replit agent memory, scripts, image outputs | Dev memory only | Optional; trim outputs |
| `.config/` | Local npm / vscode-server state | Machine-local | Should be gitignored (not tracked today) |
| `.local/` | Replit runtime cache (skills, stores, logs) | Replit only | Already gitignored — keep ignored |
| `.replit`, `.replitignore`, `replit.md` | Replit project config / docs | Replit only | Keep until Replit abandoned; then remove |
| `package.json` | **Primary** workspace orchestrator | **Yes** | Keep |
| `pnpm-workspace.yaml` | Workspace + catalog + platform overrides | **Yes** | Keep; **fix Windows overrides** |
| `pnpm-lock.yaml` | Lockfile | **Yes** | Keep |
| `tsconfig.json` / `tsconfig.base.json` | TS project references / base | **Yes** | Keep |
| `main.py`, `pyproject.toml`, `uv.lock` | Stub Python (`pymupdf`, “Hello from repl-nix-workspace”) | Not used by Node apps | Likely removable after confirming PDF pipeline |
| `.npmrc` | pnpm peer settings | **Yes** | Keep |
| `.gitattributes` | LFS rules | **Yes** | Keep |
| `.gitignore` | Ignore rules | **Yes** | Extend (see recommendations) |

---

## 2. Identify: frontend / backend / shared / mobile / generated

### Frontend (product)

- **`artifacts/mobile`** (`@workspace/mobile`) — Expo 54 + Expo Router  
  - Targets: **iOS, Android, and Web** (`react-native-web`)  
  - This is the real product UI (auth, Iqra chat, AI tools, classroom, curriculum, workspace)

### Frontend (non-product)

- **`artifacts/mockup-sandbox`** (`@workspace/mockup-sandbox`) — Vite + shadcn “Component Preview Server” for Replit Canvas (`kind = "design"`). Not wired to auth/API product flows.

### Backend

- **`artifacts/api-server`** (`@workspace/api-server`) — Express 5  
  - Routes under `/api`:  
    - `/healthz`  
    - `/auth/*` (register, login, logout, refresh, me, password reset, profile)  
    - `/workspace/*` (saved materials)  
    - `/chat`  
    - `/generate/*` (lesson-plan, worksheet, quiz, homework, activity, classroom-activity)

### Shared libraries (`lib/`)

| Package | Role |
|---------|------|
| `@workspace/db` | PostgreSQL + Drizzle ORM schemas/pool |
| `@workspace/api-spec` | OpenAPI source + Orval codegen |
| `@workspace/api-zod` | Generated Zod schemas/types |
| `@workspace/api-client-react` | Generated React Query client (**unused by mobile source**) |
| `@workspace/integrations-openai-ai-server` | Server OpenAI client (used by API) |
| `@workspace/integrations-openai-ai-react` | React audio hooks (**unused**) |

### Mobile code

- Entire product app is mobile-first Expo under `artifacts/mobile` (also ships web).

### Generated artifacts

| Location | Generated by |
|----------|--------------|
| `lib/api-zod/src/generated/**` | Orval from `openapi.yaml` |
| `lib/api-client-react/src/generated/**` | Orval from `openapi.yaml` |
| `artifacts/api-server/dist/**` | esbuild (`build.mjs`) — gitignored |
| `artifacts/mobile/.expo`, `static-build/` | Expo build — gitignored |
| `*.tsbuildinfo` | TypeScript incremental — gitignored |

“Artifacts” folder name means **apps** in Replit terms, not only build output.

---

## 3. Actively used vs Replit / leftover

### Actively used (product path)

- `artifacts/api-server/**`
- `artifacts/mobile/**` (app, services, tests)
- `lib/db/**`
- `lib/integrations-openai-ai-server/**`
- `lib/api-spec/openapi.yaml` + codegen config (partially stale vs server)
- Root pnpm/TS config

### Tooling / useful but not product

- `artifacts/mockup-sandbox/**` — design sandbox
- `.agents/memory/**` — agent notes (auth, AI integration)
- `scripts/post-merge.sh` — Replit post-merge hook

### Appears generated by Replit or no longer needed for Cursor production

| Item | Why |
|------|-----|
| `.replit`, `.replitignore`, `artifacts/*/.replit-artifact/` | Replit deploy/workflows |
| `lib/integrations/openai_ai_integrations/**` | Legacy duplicate; **no package.json**, unused |
| `@workspace/integrations-openai-ai-react` | No importers |
| `@workspace/scripts` `hello` | Scaffold |
| `main.py` / `pyproject.toml` / `uv.lock` | Replit Nix Python stub |
| `attached_assets/**` | Chat dumps + large curriculum PDFs |
| `.agents/outputs/**` | Generated PNGs from agent scripts |
| Root `@replit/connectors-sdk` dependency | Replit connector SDK |
| Mobile `dev` script Replit env vars | Won’t work as-is on Cursor |
| `pnpm-workspace.yaml` platform binary stripping | Replit linux-only optimization |

---

## 4. Duplicate code / duplicate projects

1. **OpenAI integration duplicated**  
   - Canonical: `lib/integrations-openai-ai-server` (+ unused react twin)  
   - Legacy dump: `lib/integrations/openai_ai_integrations` (same modules, not a workspace package)

2. **Two API client approaches on mobile**  
   - Declared: `@workspace/api-client-react` (generated, unused in TS/TSX imports)  
   - Actual: `artifacts/mobile/services/apiClient.ts` + `RemoteAIService.ts`

3. **OpenAPI vs real Express routes (contract drift)**  
   - Spec has `/openai/conversations*` — **not implemented** in `routes/`  
   - Spec missing `/auth/*`, `/workspace/*`, and several `/generate/*` routes that **are** implemented  
   - Codegen therefore does not reflect the real backend

4. **Dual AI generation surfaces**  
   - Server: `routes/generate.ts`  
   - Mobile: local/mock generators + remote service fallback  

5. **Many local git branches** (`subrepl-*`, `replit-agent`) — Replit sub-repl history; not duplicate apps, but noisy remotes/branches

6. **No second product web SPA** — only Expo web + mockup sandbox (not a duplicate product)

---

## 5. Primary package.json and build / dev workflow

### Primary package.json

**Root `./package.json`** (`name: "workspace"`) is the primary orchestrator:

```json
"build": "pnpm run typecheck && pnpm -r --if-present run build"
"typecheck": "pnpm run typecheck:libs && pnpm -r --filter \"./artifacts/**\" --filter \"./scripts\" --if-present run typecheck"
```

App-specific package.json files:

- `artifacts/api-server/package.json` — API build/start  
- `artifacts/mobile/package.json` — Expo + tests  
- `artifacts/mockup-sandbox/package.json` — Vite sandbox  
- `lib/*/package.json` — libraries  
- `scripts/package.json` — util scripts  

### Development workflow (intended on Replit)

1. Install: `pnpm install` (enforced; npm/yarn blocked by `preinstall`)  
2. DB: set `DATABASE_URL`, then `pnpm --filter @workspace/db run push`  
3. API: `pnpm --filter @workspace/api-server run dev`  
4. Mobile: `pnpm --filter @workspace/mobile run dev` (Replit Expo proxy)  
5. Optional codegen: `pnpm --filter @workspace/api-spec run codegen`  
6. Typecheck/build all: `pnpm run typecheck` / `pnpm run build`  
7. Mobile unit tests: `pnpm --filter @workspace/mobile run test` (also Replit validation workflow)

### Build process

| Package | Build |
|---------|-------|
| api-server | esbuild bundle → `dist/index.mjs` |
| mobile | `scripts/build.js` → Expo static web (+ Replit domain injection) |
| mockup-sandbox | `vite build` |
| libs | Mostly consumed as TypeScript source via workspace exports (no separate emit for most) |

### Current machine notes (Cursor / Windows)

- Node `v24.15.0`, pnpm `11.18.0` present  
- **`node_modules` missing** — install not run yet  
- Git identity is configured; `origin` → GitHub Iqraa; clean working tree  

---

## 6. Required environment variables

### Backend / shared (required for full API)

| Variable | Required for | Notes |
|----------|--------------|-------|
| `PORT` | API listen | **Hard-required** in `index.ts` (no default) |
| `DATABASE_URL` | `@workspace/db` | Postgres connection string |
| `SESSION_SECRET` | Auth JWT/cookies | Used in `auth.ts` / middleware |
| `AI_INTEGRATIONS_OPENAI_API_KEY` | Chat + generate | Replit AI Integrations naming |
| `AI_INTEGRATIONS_OPENAI_BASE_URL` | Chat + generate | Custom base URL for Replit proxy |
| `NODE_ENV` | Logging / auth behavior | `development` / `production` |
| `LOG_LEVEL` | Optional | Defaults to `info` |

### Mobile

| Variable | Required for | Notes |
|----------|--------------|-------|
| `PORT` | Expo packager (Replit script) | Set in artifact.toml to `18115` |
| `EXPO_PUBLIC_DOMAIN` | API base URL in client | Used by `apiClient.ts` / `RemoteAIService.ts` |
| `EXPO_PUBLIC_REPL_ID` | Replit Expo tooling | Build/dev scripts |
| `REPLIT_DEV_DOMAIN` / `REPLIT_EXPO_DEV_DOMAIN` / `REPL_ID` | Mobile `dev` script | **Replit-only** today |
| `REPLIT_INTERNAL_APP_DOMAIN` | Mobile production build domain | `scripts/build.js` |
| `BASE_PATH` | Web serve / build | Default `/` |

### Mockup sandbox

| Variable | Notes |
|----------|-------|
| `PORT` | Required (no default) |
| `BASE_PATH` | Used by Vite config |
| `REPL_ID` | Gates Replit Vite plugins |

### Not found / gaps

- No `.env`, `.env.example`, or secrets template in repo  
- No standard `OPENAI_API_KEY` — only Replit integration vars  
- No documented `JWT_SECRET` (by design: `SESSION_SECRET` only)

---

## 7. Issues that will prevent deployment (and local Cursor runs)

### Critical

1. **Dependencies not installed** (`node_modules` absent).  
2. **Platform binary overrides** in `pnpm-workspace.yaml` force linux-x64 and **disable win32/darwin** esbuild, lightningcss, rollup, Expo ngrok bins — local Windows/mac installs and builds will break or misbehave.  
3. **Mobile scripts are Replit-bound** — `dev` and `build.js` fail without Replit domain env; need Cursor-local equivalents (`localhost` + API URL).  
4. **Secrets / infra not provisioned in this environment** — Postgres, `SESSION_SECRET`, OpenAI (or Replit AI proxy) must be supplied.  
5. **No container/CI deploy definition** for non-Replit hosts (no Dockerfile, no GitHub Actions, no compose). Replit deploy is defined only via `.replit` + `artifact.toml`.

### High

6. **OpenAPI/codegen drift** — generated clients don’t match auth/workspace APIs; unsafe to treat codegen as source of truth until synced.  
7. **Repo weight** — multiple multi‑MB/PDF curriculum files in `attached_assets` (tens of MB; one LFS object ~58MB historically). Hurts clone/deploy.  
8. **API `dev` is not hot-reload** — rebuilds then starts; slower local DX.  
9. **Shell scripts** (`export`, `sh -c` in `preinstall`, `post-merge.sh`) — assume Unix; fragile on Windows without Git Bash/WSL.  
10. **Python stub** (`pymupdf`) may be intended for PDF parsing, but Node app does not clearly wire it; PDF handling path is unclear for production.

### Medium

11. Unused packages increase install surface and confusion.  
12. `.gitignore` does not ignore `.config/` or `attached_assets/` (if those appear later).  
13. Root still depends on `@replit/connectors-sdk`.  
14. Health/docs mention port 5000 vs artifact port 8080 — documentation inconsistency only if env not set explicitly.

---

## Problems found

| Severity | Problem |
|----------|---------|
| Critical | Windows native dependency overrides block local Cursor installs/builds |
| Critical | Replit-only mobile env/domain assumptions |
| Critical | Missing env template + external services (DB, AI, session secret) |
| Critical | No non-Replit deployment path |
| High | OpenAPI out of sync with Express routes |
| High | Large binary assets committed |
| High | Duplicate/legacy OpenAI trees |
| Medium | Generated API client unused by mobile |
| Medium | Orphan react OpenAI package + scripts hello scaffold |
| Medium | Mockup sandbox mixed into product workspace without clear “dev-only” labeling |
| Medium | Unix shell assumptions in npm scripts |
| Low | Placeholder `replit.md` sections never filled |
| Low | Multiple stale local `subrepl-*` branches |

---

## Cleanup recommendations

**Do not apply until approved.** Suggested order:

1. **Make Windows/mac installs work**  
   - Remove or narrow `pnpm-workspace.yaml` overrides that zero out `win32`/`darwin` optional deps.  
   - Prefer keeping linux-only overrides only in CI/Replit if needed.

2. **Add local Cursor scripts**  
   - `api-server`: `dev` with `tsx` watch or default `PORT=5000`.  
   - `mobile`: `expo start` without Replit proxy; `EXPO_PUBLIC_API_URL` or `EXPO_PUBLIC_DOMAIN=localhost:<api-port>`.  
   - Add root scripts: `dev:api`, `dev:mobile`, `dev`.

3. **Add `.env.example`** documenting all vars above; gitignore `.env`.

4. **Remove or quarantine dead code**  
   - Delete `lib/integrations/openai_ai_integrations` (legacy).  
   - Drop or wire `@workspace/integrations-openai-ai-react`.  
   - Decide: adopt `@workspace/api-client-react` in mobile **or** remove the dependency.  
   - Remove `scripts` hello / or replace with real ops scripts.  
   - Confirm whether Python/`pymupdf` is required; if not, remove `main.py`, `pyproject.toml`, `uv.lock`.

5. **Detach Replit-only surface from production path**  
   - Keep `.replit*` temporarily if still using Replit, else archive.  
   - Stop treating `mockup-sandbox` as a deployable product service.

6. **Assets hygiene**  
   - Move curriculum PDFs out of git (object storage / private drive).  
   - Keep only small brand assets under `artifacts/mobile/assets`.  
   - Ignore or untrack `attached_assets/` and `.agents/outputs/`.

7. **Sync OpenAPI** with real auth/workspace/generate routes; regenerate clients; delete phantom `/openai/conversations` or implement them.

---

## Deployment recommendations

### Target shape (non-Replit)

| Service | Suggest |
|---------|---------|
| API | Node 24 container or PaaS (Railway/Fly/Render) running `node artifacts/api-server/dist/index.mjs` |
| DB | Managed Postgres; migrate with Drizzle (`push` for early MVP, prefer migrations later) |
| AI | Real OpenAI (or Azure OpenAI) — map env to current client or rename to `OPENAI_API_KEY` + `OPENAI_BASE_URL` |
| Mobile web | Static host (CDN) **or** small Node `serve.js` behind reverse proxy |
| Native | EAS Build (Expo) when ready |

### Minimal production checklist

- [ ] `pnpm install` works on target OS  
- [ ] `pnpm --filter @workspace/api-server run build`  
- [ ] Set `PORT`, `DATABASE_URL`, `SESSION_SECRET`, AI keys  
- [ ] `pnpm --filter @workspace/db run push` (or migrations)  
- [ ] Health check: `GET /api/healthz`  
- [ ] Mobile `EXPO_PUBLIC_DOMAIN` points at public API host  
- [ ] CORS configured for real frontend origin (currently open `cors()`)  
- [ ] Secure cookies / HTTPS in production  
- [ ] Remove secrets from any Replit leftovers; rotate `SESSION_SECRET`  

### Replit deploy (if still used)

Already partially defined in `artifact.toml` files (API port 8080, mobile serve). Still depends on Replit-provisioned DB + AI integrations.

---

## Recommended clean production-ready folder structure

Rename is optional; clarity matters more than perfect names. Proposed target:

```
iqraa/
├── apps/
│   ├── api/                 # was artifacts/api-server
│   └── mobile/              # was artifacts/mobile (Expo)
├── packages/
│   ├── db/                  # was lib/db
│   ├── api-spec/            # OpenAPI + orval
│   ├── api-zod/             # generated
│   ├── api-client/          # generated (use it or drop)
│   └── openai/              # single server integration package
├── tooling/
│   └── scripts/             # CI/codegen helpers only
├── docs/
│   ├── PROJECT_AUDIT.md
│   └── ARCHITECTURE.md
├── .env.example
├── package.json             # workspace root
├── pnpm-workspace.yaml
└── tsconfig.base.json
```

**Move out of the product repo (or gitignore):**

- `attached_assets/`  
- `.agents/outputs/`  
- `mockup-sandbox` → optional `apps/design-sandbox` or separate repo  
- Replit config once fully off Replit  

---

## Risks

| Risk | Impact |
|------|--------|
| Force-cleaning Replit files before local scripts exist | Team can’t run app |
| Deleting `attached_assets` without backup | Loss of curriculum source PDFs |
| Changing AI env var names without adapter | Production chat/generate outage |
| Force-push / history rewrite for binary cleanup | Collaborator pain; coordinate first |
| Adopting generated client while OpenAPI is stale | Wrong types / missing auth endpoints |
| Leaving CORS wide open | Security issue in production |
| Relying on `drizzle-kit push` in prod | Schema drift / data loss risk — need migrations for real prod |
| Windows override fix forgotten | Cursor on Windows remains broken |

---

## Next steps (awaiting your approval)

Suggested sequence after you approve:

1. **Phase A — Local viability (no feature work)**  
   - Fix pnpm platform overrides for Windows  
   - `pnpm install`  
   - Add `.env.example` + local `dev` scripts for API + mobile  
   - Document “first run on Cursor” in README  

2. **Phase B — Hygiene**  
   - Remove legacy `lib/integrations/openai_ai_integrations`  
   - Ignore/untrack bulky attachments (after you confirm backup)  
   - Trim unused packages or wire them intentionally  

3. **Phase C — Contract & deploy**  
   - Sync OpenAPI ↔ Express  
   - Add Dockerfile + GitHub Actions (lint/typecheck/test/build)  
   - Choose hosting for API + Postgres + Expo web  

4. **Phase D — Features**  
   - Only after A–C baseline is green  

---

## Appendix A — Top-level folder purpose (quick map)

- **`artifacts/`** — Apps (API, Expo mobile, design sandbox)  
- **`lib/`** — Shared libraries + codegen outputs  
- **`scripts/`** — Workspace utility package  
- **`attached_assets/`** — Replit uploads (PDFs/images/prompts)  
- **`.agents/`** — Agent memory/scripts/outputs  
- **`.local/` / `.config/`** — Local/Replit machine state (should not ship)  

## Appendix B — Package map

| Name | Path | Status |
|------|------|--------|
| `workspace` | `/package.json` | Active orchestrator |
| `@workspace/api-server` | `artifacts/api-server` | Active backend |
| `@workspace/mobile` | `artifacts/mobile` | Active frontend |
| `@workspace/mockup-sandbox` | `artifacts/mockup-sandbox` | Design tooling |
| `@workspace/db` | `lib/db` | Active |
| `@workspace/api-spec` | `lib/api-spec` | Active (stale spec) |
| `@workspace/api-zod` | `lib/api-zod` | Generated / active (partial use) |
| `@workspace/api-client-react` | `lib/api-client-react` | Generated / unused by app |
| `@workspace/integrations-openai-ai-server` | `lib/integrations-openai-ai-server` | Active |
| `@workspace/integrations-openai-ai-react` | `lib/integrations-openai-ai-react` | Orphan |
| `@workspace/scripts` | `scripts` | Scaffold |
| *(none)* | `lib/integrations/openai_ai_integrations` | Legacy duplicate |

## Appendix C — Approval gate

**No cleanup, renames, deletes, or deploy config changes have been applied.**  

Please reply with what you want next, for example:

- “Approve Phase A”  
- “Approve full cleanup A–C”  
- Or call out exceptions (e.g. keep `attached_assets`, keep Replit files, keep mockup-sandbox)
