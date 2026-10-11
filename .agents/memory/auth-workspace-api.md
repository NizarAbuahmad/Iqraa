---
name: Auth & Workspace API
description: JWT auth flow, workspace CRUD API, mobile SecureStore token storage, and key implementation decisions for the Iqra production auth system.
---

# Auth & Workspace API

## Auth architecture

- `SESSION_SECRET` env var (already set) is used as JWT signing secret — no separate `JWT_SECRET` needed.
- Access tokens: 15-minute expiry, signed with `{ sub, email, role, type: "access" }`.
- Refresh tokens: 48-byte random hex, stored as SHA-256 hash in `refresh_tokens` table, 30-day expiry. Rotated on each use (old deleted, new issued).
- Password reset: removed 2026-09-10, **restored 2026-09-12** — `/forgot-password` and `/reset-password` use a 6-digit emailed code (`lib/passwordReset.ts`), and a reset ends every session. Needs an email on the account.
- **Code-only accounts (2026-10-10):** a parent or student can sign up from a teacher's code with no email and no password (`POST /auth/redeem`). `users.email` is therefore **nullable**. Their credential is a 12-character personal login code (`users.login_code_hash`, sha256), shown once at sign-up and used at `POST /auth/code-login`; the teacher can re-issue it. They can add an email + password later (`POST /auth/add-email`, then `/verify-email`). See STATUS.md.
- Registering a parent/student by email still works (`/register`) but the app no longer offers it: the register screen sends parents and students to the code form.

**Why:** Separate access/refresh token strategy limits damage from token theft; refresh rotation prevents replay attacks.

## Database tables added

- `users` (id UUID, first_name, last_name, email unique **nullable**, login_code_hash unique nullable, **password_hash nullable** — a Google-only account never sets one, google_id unique, preferred_language, role, email_verified, suspended_at, suspended_reason, roster_consent_at, roster_consent_version, created_at, last_login)
- `refresh_tokens` (id UUID, user_id FK→users, token_hash unique, expires_at, created_at)
- `password_reset_tokens` — **vestigial.** Still in `lib/db/src/schema/users.ts`, read and written by nothing since the 2026-09-10 removal. Dropping it needs a manual schema push and buys nothing.
- `saved_materials` (id UUID, user_id FK→users, type, title, subject, grade, topic, language, content jsonb, form_state jsonb, is_favorite bool, created_at, updated_at)

## API routes (all under /api prefix)

- `POST /auth/register` — creates the user and emails a 6-digit verification code (**no tokens until `/verify-email`**). `role` is clamped to teacher/student/parent; student and parent are gated on the `STUDENT_ACCOUNTS` flag. Takes no claim code — a code is redeemed afterwards (`POST /claim`) or, for a new parent/student, instead of all of this at `POST /auth/redeem`
- `POST /auth/redeem` — creates a parent/student account **and** its roster link from a teacher's code alone; returns tokens plus the one-time `loginCode`. A parent needs the per-student code (not a class code)
- `POST /auth/code-login` — signs in with the personal login code
- `POST /auth/add-email` — a signed-in account with no email adds one (and a password); verified through `/verify-email`
- `POST /auth/login` — verifies bcrypt hash, updates last_login, returns tokens
- `POST /auth/google` — verifies Google ID token; links to an existing password account by email, or mints a new one
- `POST /auth/logout` — deletes refresh token from DB (requires auth)
- `POST /auth/refresh` — rotates refresh token, returns new pair
- `GET /auth/me` — returns full user object (requires auth). Also returns `hasPassword`, which is what the delete screen uses to pick its proof
- `PATCH /auth/users/profile` — updates firstName, lastName, preferredLanguage
- `DELETE /auth/users/me` — Apple 5.1.1(v) / Play requirement. Re-auth required: password, or retyped email for a Google-only account. Cascades the whole roster; R2 keys are read before the row goes
- `POST /auth/claim` — links an already-signed-in parent/student to one more roster row. Same flag gate as register
- `GET /auth/join/:code` — resolves a class join code to its roster names, for the signup name-picker
- `POST /admin/users/:id/password` — the only way to set a password from outside an account, and the stopgap for the removed reset. `system_admin` only, never onto an admin account (`canAdminSetPassword` in `lib/passwordPolicy.ts`); revokes all the target's refresh tokens; the log line is the audit trail
- `POST/GET /auth/roster-consent` — records and reads the teacher's parental-consent attestation. Roster writes are 403 until it is set
- `GET/POST/PATCH/DELETE /workspace/items`, `GET/PATCH/DELETE /workspace/items/:id`, `POST /workspace/items/:id/duplicate` — all auth-protected

## Mobile client

- Tokens stored in `expo-secure-store` (not AsyncStorage).
- `artifacts/mobile/services/apiClient.ts` — base URL helper, token store/clear, `apiFetch` with auto-refresh on 401, `apiJson` wrapper.
- `context/AuthContext.tsx` — calls the real API; exposes `register(data: RegisterData)` (one object: firstName, lastName, email, password, optional confirmPassword/role/claimCode/studentId), plus `login`, `loginWithGoogle(credential, signup?)`, `logout`, `updateProfile`, `deleteAccount({ password?, confirmEmail? })`.
- `workspace.ts` — calls API when authenticated, falls back to AsyncStorage on network failure.

## User type changes

- `User` now has `firstName`, `lastName` (separate), `createdAt`. `name` is a computed `${firstName} ${lastName}`.
- Register screen now collects firstName + lastName separately with confirm-password field.
- Profile screen shows `member since` date from `createdAt`.

**How to apply:** Any code referencing `user.name` still works (computed field). New code should prefer `user.firstName`/`user.lastName`.

## Build note

After adding new tables to `lib/db/src/schema/`, run `tsc -p tsconfig.json --declaration --emitDeclarationOnly` in `lib/db/` before running `typecheck` in `artifacts/api-server/`. The API server uses TypeScript project references and reads compiled declarations from `lib/db/dist/`.
