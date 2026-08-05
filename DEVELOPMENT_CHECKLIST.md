# Iqraa — Development Checklist (Local / Cursor)

**Status:** Audit + documentation only (no app behavior changes in this phase)  
**Audience:** Make Iqraa fully functional locally after the Replit → Cursor migration  
**Related:** `LOCAL_SETUP.md`, `.env.example`, `PROJECT_AUDIT.md`

---

## 1. Database layer audit

### PostgreSQL version

| Source | Version |
|--------|---------|
| `.replit` modules | **`postgresql-16`** |
| Recommendation for local Windows | **PostgreSQL 16.x** (15+ is likely fine; match 16 when possible) |

No version pin exists inside Drizzle/app code; the stack was developed against Postgres 16 on Replit.

### ORM

| Item | Value |
|------|--------|
| ORM | **Drizzle ORM** (`drizzle-orm` catalog / `0.45.2`) |
| Kit | **drizzle-kit** `^0.31.10` |
| Driver | **`pg`** (node-postgres) via `drizzle-orm/node-postgres` |
| Package | `@workspace/db` → `lib/db` |
| Config | `lib/db/drizzle.config.ts` (`dialect: "postgresql"`) |
| Schema entry | `lib/db/src/schema/index.ts` |

### Migrations

| Finding | Detail |
|---------|--------|
| SQL migration folders | **None** (`**/migrations/**` empty) |
| How schema is applied | **`drizzle-kit push`** only (`pnpm --filter @workspace/db run push`) |
| Force push | `pnpm --filter @workspace/db run push-force` |
| Production note | `push` syncs schema from TypeScript definitions; there is **no versioned migration history**. Fine for local MVP; later add `drizzle-kit generate` + migrate for production. |

### Schema completeness (source of truth = Drizzle tables)

| Table | File | Purpose | Used by API today |
|-------|------|---------|-------------------|
| `users` | `lib/db/src/schema/users.ts` | Accounts (name, email, password hash, role, language) | Auth register/login/me/profile |
| `refresh_tokens` | same | Refresh token hashes + expiry | Auth login/refresh/logout |
| `password_reset_tokens` | same | Reset token hashes | Auth forgot/reset password |
| `saved_materials` | `lib/db/src/schema/savedMaterials.ts` | Cloud workspace items (JSON content) | `/api/workspace/*` |
| `conversations` | `lib/db/src/schema/conversations.ts` | Chat conversation titles | **Schema only** — no Express routes write/read it currently |
| `messages` | `lib/db/src/schema/messages.ts` | Chat messages FK → conversations | **Schema only** — OpenAPI lists conversation APIs that are **not implemented** |

**Verdict:** Schema is complete for **auth + workspace**. Conversation/message tables are present but unused by the live chat path (`POST /api/chat` is stateless OpenAI proxy).

### How to initialize a fresh local database

1. Install/start PostgreSQL 16 (see §2).  
2. Create empty database `iqraa` and a user with access.  
3. Set `DATABASE_URL` in root `.env`.  
4. From repo root, ensure `DATABASE_URL` is available to the shell (see note below), then:

```powershell
pnpm --filter @workspace/db run push
```

5. Confirm tables exist (e.g. `\dt` in `psql`, or pgAdmin).

**Important:** `drizzle-kit push` reads `process.env.DATABASE_URL` from the **shell environment**. The API/mobile launchers load `.env` automatically; **`db push` does not** unless you export variables first (commands in §2).

---

## 2. Local PostgreSQL setup (Windows) — do not install yet

This is a **manual checklist** for you (or a future session). Nothing was installed by the audit.

### A. Install PostgreSQL 16

1. Download the Windows installer from [https://www.postgresql.org/download/windows/](https://www.postgresql.org/download/windows/) (EDB installer is fine).  
2. During setup:
   - Components: PostgreSQL Server, Command Line Tools, pgAdmin (optional).  
   - Port: **5432** (default).  
   - Superuser password: choose one and store it securely.  
   - Locale: default is fine.  
3. Finish install; ensure **PostgreSQL** Windows service is **Running**  
   (`services.msc` → `postgresql-x64-16` or similar).

### B. Create database and role

**Option 1 — pgAdmin**

1. Connect to local server as `postgres`.  
2. Create database named **`iqraa`**.  
3. (Optional) Create a dedicated login role and grant privileges on `iqraa`.

**Option 2 — `psql` (PowerShell)**

```powershell
# Adjust path if your install version/folder differs
& "C:\Program Files\PostgreSQL\16\bin\psql.exe" -U postgres -c "CREATE DATABASE iqraa;"
```

If the role already exists / DB exists, ignore “already exists” errors or use:

```powershell
& "C:\Program Files\PostgreSQL\16\bin\psql.exe" -U postgres -c "SELECT 1 FROM pg_database WHERE datname='iqraa';"
```

### C. Environment variables

Edit root `.env` (from `.env.example`):

```env
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/iqraa
SESSION_SECRET=local-dev-session-secret-change-me
PORT=8080
NODE_ENV=development
OPENAI_API_KEY=sk-your-real-key
OPENAI_BASE_URL=https://api.openai.com/v1
MOBILE_PORT=8081
EXPO_PUBLIC_API_BASE_URL=http://localhost:8080/api
```

Replace `YOUR_PASSWORD` with the Postgres password from install.

### D. Apply schema (migration command)

From the **repository root**, load `DATABASE_URL` into the session then push:

```powershell
cd C:\Users\Lenovo\Downloads\Iqraa\Iqraa

# Load DATABASE_URL from .env into this PowerShell session
Get-Content .env | ForEach-Object {
  if ($_ -match '^\s*#' -or $_ -match '^\s*$') { return }
  $i = $_.IndexOf('=')
  if ($i -lt 1) { return }
  $k = $_.Substring(0, $i).Trim()
  $v = $_.Substring($i + 1).Trim().Trim('"').Trim("'")
  Set-Item -Path "Env:$k" -Value $v
}

pnpm --filter @workspace/db run push
```

Expected: drizzle-kit connects and creates/updates tables to match `lib/db/src/schema/*`.

Verify:

```powershell
& "C:\Program Files\PostgreSQL\16\bin\psql.exe" -U postgres -d iqraa -c "\dt"
```

You should see at least: `users`, `refresh_tokens`, `password_reset_tokens`, `saved_materials`, `conversations`, `messages`.

### E. Smoke the API against the DB

```powershell
pnpm run dev:api
# then, in another terminal:
Invoke-RestMethod http://localhost:8080/api/healthz
```

---

## 3. Authentication — what login needs locally

### Required for login/register to work

| Requirement | Why |
|-------------|-----|
| PostgreSQL running + `iqraa` DB | Auth queries `users` / `refresh_tokens` |
| Schema applied (`db push`) | Tables must exist |
| `DATABASE_URL` in `.env` (and loaded by API launcher) | Pool created at API boot |
| `SESSION_SECRET` in `.env` | JWT access tokens + middleware verification |
| API running (`pnpm run dev:api`) | `/api/auth/*` |
| Frontend `EXPO_PUBLIC_API_BASE_URL=http://localhost:8080/api` | Mobile/web client calls API |
| User account | **Register** first via app UI or `POST /api/auth/register` |

### Auth API surface

| Method | Path | Needs DB | Needs `SESSION_SECRET` |
|--------|------|----------|-------------------------|
| POST | `/api/auth/register` | Yes | Yes (issues tokens) |
| POST | `/api/auth/login` | Yes | Yes |
| POST | `/api/auth/refresh` | Yes | Yes |
| POST | `/api/auth/logout` | Yes | Yes + Bearer access token |
| GET | `/api/auth/me` | Yes | Yes + Bearer |
| PATCH | `/api/auth/users/profile` | Yes | Yes + Bearer |
| POST | `/api/auth/forgot-password` | Yes | No email provider — **dev logs reset token** when `NODE_ENV !== production` |
| POST | `/api/auth/reset-password` | Yes | Uses reset token from forgot flow |

### Register body (minimum)

`firstName`, `lastName`, `email`, `password` (≥ 8 chars). Optional `confirmPassword`.

### Missing secrets / config (local gaps)

| Item | Status |
|------|--------|
| `SESSION_SECRET` | Required — already in `.env.example` |
| Email/SMTP for password reset | **Not configured** — by design in non-production, token is **logged to API console** |
| Email verification enforcement | Column `email_verified` exists; login does **not** require verified email |
| Seed admin user | **None** — you must register a user |
| Separate `JWT_SECRET` | **Not used** — only `SESSION_SECRET` |

### Quick auth verification (after DB ready)

1. Start API + frontend.  
2. Open app → Register a teacher account.  
3. Log out / log in with same credentials.  
4. Confirm authenticated navigation (profile / workspace).  
5. Optional: `GET /api/auth/me` with `Authorization: Bearer <accessToken>`.

---

## 4. AI integration

### Required AI environment variables

| Variable | Required? | Notes |
|----------|-----------|--------|
| `OPENAI_API_KEY` | **Yes** (or legacy alias) | Needed for API process to boot (client init) **and** for live AI calls |
| `OPENAI_BASE_URL` | Optional | Defaults to `https://api.openai.com/v1` |
| `AI_INTEGRATIONS_OPENAI_API_KEY` | Legacy alias | Accepted if `OPENAI_API_KEY` unset |
| `AI_INTEGRATIONS_OPENAI_BASE_URL` | Legacy alias | Accepted if `OPENAI_BASE_URL` unset |

Resolver: `lib/integrations-openai-ai-server/src/env.ts`.

### Backend AI endpoints (all use OpenAI chat completions)

| Endpoint | Feature |
|----------|---------|
| `POST /api/chat` | IQRA conversational assistant |
| `POST /api/generate/lesson-plan` | Lesson plan generation |
| `POST /api/generate/worksheet` | Worksheet generation |
| `POST /api/generate/quiz` | Quiz generation |
| `POST /api/generate/homework` | Homework generation |
| `POST /api/generate/activity` | Activity generation |
| `POST /api/classroom-activity` | Interactive classroom activity JSON |

Mobile calls these via `RemoteAIService` (`artifacts/mobile/services/ai/RemoteAIService.ts`), which **falls back to `MockAIService`** if the network/API call fails.

### What works immediately after adding a real API key?

| Feature | Immediate? | Caveat |
|---------|------------|--------|
| API process starts with a key set | Yes | Placeholder key boots process; real key needed for successful OpenAI calls |
| Health `/api/healthz` | Yes | No AI/DB required for health response |
| Live generate + chat via API | **Only if the model is accepted by your provider** | Code hard-codes model **`gpt-5.6-luna`** in `chat.ts` and `generate.ts` — this may be a Replit/custom model id. **Standard OpenAI may reject it**; then RemoteAIService falls back to mocks. Changing the model id is a later task (behavior/config change). |
| Mobile AI tools (lesson, worksheet, quiz, …) | Partial | Tries remote first; **mock content still appears** if remote fails |
| IQRA tab chat | Partial | Same remote-then-fallback behavior |
| Image/audio OpenAI helpers in `lib/integrations-openai-ai-server` | Not wired to product routes currently | Available as library code |

### AI verification steps

1. Set a real `OPENAI_API_KEY` in `.env`.  
2. Restart `pnpm run dev:api`.  
3. Call e.g. `POST /api/chat` with a small messages array.  
4. If 500 / model error → note model `gpt-5.6-luna` as blocker (see Known issues).  
5. In the app, run an AI tool and check API logs vs mock fallback warnings in the browser/Metro console.

---

## 5. End-to-end smoke test

Use this after Postgres is installed and schema pushed.

| # | Step | Pass criteria |
|---|------|----------------|
| 1 | `pnpm install` (if needed) | Completes without fatal errors |
| 2 | `.env` has `DATABASE_URL`, `SESSION_SECRET`, `OPENAI_API_KEY`, `EXPO_PUBLIC_API_BASE_URL` | Values filled |
| 3 | `pnpm --filter @workspace/db run push` (with env loaded) | Tables created |
| 4 | `pnpm run dev:api` | Log: Server listening on 8080 |
| 5 | `GET http://localhost:8080/api/healthz` | `{"status":"ok"}` |
| 6 | `pnpm run dev:mobile:web` | Waiting on http://localhost:8081 |
| 7 | Open browser to Expo web | IQRA UI loads |
| 8 | Register + login | Session established; no 500 from auth |
| 9 | Open Workspace (authenticated) | List/create material hits `/api/workspace` successfully |
| 10 | Trigger AI tool or IQRA chat | Remote success **or** documented mock fallback; no unexplained crash |

---

## 6. Known issues

| Issue | Impact | Severity |
|-------|--------|----------|
| **No Postgres installed** on this machine (as of last verification) | Auth/workspace return connection errors | Blocker for full local product |
| **No SQL migration history** — only `drizzle-kit push` | Fine for local; weaker for prod/team schema evolution | Medium (later) |
| **`db push` does not auto-load `.env`** | Easy to forget exporting `DATABASE_URL` | Medium DX |
| **Model id `gpt-5.6-luna`** hard-coded | May fail against public OpenAI; app falls back to mocks | High for “real AI” |
| **`conversations` / `messages` unused** by live API | Schema/OpenAPI drift; chat not persisted | Low for current MVP |
| **No SMTP** | Password reset only via API console log in non-prod | Low for local |
| **`expo-secure-store` version mismatch warning** | Warning only on Expo start | Low |
| OpenAPI missing auth/workspace; includes unused conversation routes | Codegen client incomplete/stale | Medium (later) |

---

## 7. Recommended next tasks (ordered)

1. **Install PostgreSQL 16 on Windows** and create DB `iqraa` (§2).  
2. **Push schema** with `pnpm --filter @workspace/db run push`.  
3. **Register a local user** and verify login end-to-end.  
4. **Add a real OpenAI API key**; test `/api/chat` and one `/api/generate/*` route.  
5. **Decide on model strategy** (keep `gpt-5.6-luna` via a compatible proxy vs switch to a public model like `gpt-4o-mini`) — *behavior/config change; do only with approval*.  
6. Optionally wire `db push` to load root `.env` (small DX fix; approval).  
7. Later: introduce versioned Drizzle migrations; sync OpenAPI; email provider for reset.  
8. Later: remove unused Replit leftovers per `CLEANUP_PLAN.md` after verification.

---

## Quick reference commands

```powershell
# Schema
# (load .env into Env: first — see §2.D)
pnpm --filter @workspace/db run push

# API
pnpm run dev:api

# Frontend (web)
pnpm run dev:mobile:web

# Health
Invoke-RestMethod http://localhost:8080/api/healthz
```

---

*Document generated from repository audit. No application functionality was modified for this checklist.*
