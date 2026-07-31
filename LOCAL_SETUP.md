# Local setup (Cursor / Windows)

This guide runs Iqraa **without Replit**. The product UI is the Expo app in `artifacts/mobile` (web + native). The API is `artifacts/api-server`.

> Use **pnpm**, not npm or yarn.

---

## Prerequisites

| Tool | Notes |
|------|--------|
| **Node.js 24+** | Matches the Replit Node 24 workspace (`node -v`) |
| **pnpm 9+** | `npm install -g pnpm` or Corepack: `corepack enable` |
| **PostgreSQL 16+** | Local install or Docker |
| **OpenAI API key** (optional) | Needed for live chat/generate; mobile falls back to mocks if the API/AI call fails |
| **Git** | Already required for the repo |

Optional for native device testing: Expo Go on a phone, Android Studio / Xcode.

---

## Installation

From the repository root:

```powershell
pnpm install
```

If pnpm reports ignored build scripts for `esbuild`, approve and reinstall once:

```powershell
pnpm approve-builds --all
pnpm install
```

Copy the env template and edit values:

```powershell
copy .env.example .env
```

Provision the database schema (requires a valid `DATABASE_URL`):

```powershell
pnpm --filter @workspace/db run push
```

---

## Environment variables

Create a root `.env` from `.env.example`. Local launchers load it automatically.

### Required (for full product features)

| Variable | Needed for | Notes |
|----------|------------|--------|
| `DATABASE_URL` | Auth, workspace, DB access | Postgres must be running |
| `SESSION_SECRET` | Auth (JWT) | Any long secret string locally |
| `OPENAI_API_KEY` | Live AI chat / generate | Or legacy `AI_INTEGRATIONS_OPENAI_API_KEY` |

Without Postgres, the API still **starts** and `/api/healthz` works; auth/workspace routes fail until DB is up.  
Without an OpenAI key, the API process will not start (AI client initializes at boot). Set a real or placeholder key in `.env`.

### Optional (local defaults apply)

| Variable | Default | Notes |
|----------|---------|--------|
| `PORT` | `8080` | API listen port |
| `MOBILE_PORT` | `8081` | Expo packager port |
| `NODE_ENV` | `development` | Set by API launcher |
| `LOG_LEVEL` | `info` | API logging |
| `OPENAI_BASE_URL` | `https://api.openai.com/v1` | Override for proxies/Azure |
| `EXPO_PUBLIC_API_BASE_URL` | `http://localhost:8080/api` | Frontend → API |
| `EXPO_PUBLIC_DOMAIN` | unset | Hosted-style host; prefer `EXPO_PUBLIC_API_BASE_URL` locally |
| `BASE_PATH` | `/` | Mobile static serve / mockup |
| `MOCKUP_PORT` | `8082` | Design sandbox only |

### Legacy / Replit-only (not required locally)

| Variable | Status |
|----------|--------|
| `AI_INTEGRATIONS_OPENAI_API_KEY` / `AI_INTEGRATIONS_OPENAI_BASE_URL` | Still accepted as aliases of `OPENAI_*` |
| `REPLIT_DEV_DOMAIN`, `REPLIT_EXPO_DEV_DOMAIN`, `REPLIT_INTERNAL_APP_DOMAIN` | Unused by local launchers |
| `REPL_ID`, `EXPO_PUBLIC_REPL_ID`, `EXPO_PACKAGER_PROXY_URL`, `REACT_NATIVE_PACKAGER_HOSTNAME` | Unused by local launchers |

Original Replit mobile script (optional): `pnpm --filter @workspace/mobile run dev:replit`.

---

## Run the backend

```powershell
pnpm run dev:api
```

Equivalent:

```powershell
pnpm --filter @workspace/api-server run dev
```

- Builds with esbuild, then starts `dist/index.mjs`
- Defaults: `PORT=8080`, `NODE_ENV=development`
- Health check: [http://localhost:8080/api/healthz](http://localhost:8080/api/healthz)

Production-style start (after `pnpm --filter @workspace/api-server run build`):

```powershell
$env:PORT=8080
pnpm --filter @workspace/api-server run start
```

---

## Run the frontend

In a **second** terminal:

```powershell
pnpm run dev:mobile
```

For Expo **web** specifically:

```powershell
pnpm run dev:mobile:web
```

Equivalent:

```powershell
pnpm --filter @workspace/mobile run dev
pnpm --filter @workspace/mobile run dev -- --web
```

- Defaults to packager port **8081**
- Points at `http://localhost:8080/api` unless you override `EXPO_PUBLIC_API_BASE_URL`
- Press `w` in the Expo CLI for web, or use `--web` as above

---

## Suggested local workflow

1. Start Postgres and ensure `.env` `DATABASE_URL` is correct  
2. `pnpm --filter @workspace/db run push` (once / when schema changes)  
3. Terminal A: `pnpm run dev:api`  
4. Terminal B: `pnpm run dev:mobile:web`  
5. Open the Expo web URL (usually `http://localhost:8081`)

---

## Portability notes

Local Cursor/Windows does **not** need any `REPLIT_*` variables.

| Was Replit-specific | Local equivalent |
|---------------------|------------------|
| `AI_INTEGRATIONS_OPENAI_*` | `OPENAI_API_KEY` + optional `OPENAI_BASE_URL` |
| `REPLIT_*` / `EXPO_PUBLIC_DOMAIN` for API host | `EXPO_PUBLIC_API_BASE_URL` |
| `expo-router` origin `https://replit.com/` | `http://localhost:8081` in `app.json` |
| Unused `@replit/connectors-sdk` | Removed from root `package.json` |
| Mobile `dev` Replit proxy script | `scripts/dev.mjs` (Replit kept as `dev:replit`) |
| Mockup required `PORT`/`BASE_PATH` with no defaults | Local launcher defaults (`8082`, `/`) |

Still present but unused locally: `.replit*`, `artifact.toml`, `@replit/vite-plugin-*` (mockup only; cartographer loads only if `REPL_ID` is set).

**Not the product app:** `artifacts/mockup-sandbox`. Skip unless you need that canvas.

---

## Why `npm run dev` at the repo root fails

1. Root `package.json` has **no** `dev` script (use `dev:api` / `dev:mobile`).  
2. The workspace **requires pnpm** (`preinstall` rejects npm/yarn).  

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `Use pnpm instead` | Run `pnpm install`, not `npm install` |
| `PORT environment variable is required` | Set `PORT` or use `pnpm run dev:api` (defaults 8080) |
| `DATABASE_URL must be set` | Add it to root `.env` |
| `SESSION_SECRET not set` | Add it to root `.env` |
| `AI_INTEGRATIONS_OPENAI_* must be set` | Add both vars, or avoid chat/generate routes until set |
| Frontend cannot reach API | Confirm API on 8080 and `EXPO_PUBLIC_API_BASE_URL=http://localhost:8080/api` |
| Native device cannot use `localhost` | Use your PC LAN IP in `EXPO_PUBLIC_API_BASE_URL` (e.g. `http://192.168.x.x:8080/api`) |
| esbuild / native module errors on Windows | Re-run `pnpm install` after the workspace override fix (platform binaries must not be stripped) |
| `'C:\Program' is not recognized` when starting API | Fixed in `artifacts/api-server/scripts/dev.mjs` (do not shell-spawn `node.exe` on Windows) |
| Auth/login returns 500 / `ECONNREFUSED` | Postgres is not running or `DATABASE_URL` is wrong. Install/start PostgreSQL, create DB `iqraa`, then `pnpm --filter @workspace/db run push` |
| `expo-secure-store` version warning | Compatibility warning only; app still bundles. Align versions later if secure storage misbehaves |
