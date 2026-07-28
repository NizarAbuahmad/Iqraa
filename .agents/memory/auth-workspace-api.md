---
name: Auth & Workspace API
description: JWT auth flow, workspace CRUD API, mobile SecureStore token storage, and key implementation decisions for the Iqra production auth system.
---

# Auth & Workspace API

## Auth architecture

- `SESSION_SECRET` env var (already set) is used as JWT signing secret — no separate `JWT_SECRET` needed.
- Access tokens: 15-minute expiry, signed with `{ sub, email, role, type: "access" }`.
- Refresh tokens: 48-byte random hex, stored as SHA-256 hash in `refresh_tokens` table, 30-day expiry. Rotated on each use (old deleted, new issued).
- Password reset tokens: 32-byte random hex, hashed, stored in `password_reset_tokens`, 1-hour expiry, single-use.

**Why:** Separate access/refresh token strategy limits damage from token theft; refresh rotation prevents replay attacks.

## Database tables added

- `users` (id UUID, first_name, last_name, email unique, password_hash, preferred_language, role, email_verified, created_at, last_login)
- `refresh_tokens` (id UUID, user_id FK→users, token_hash unique, expires_at, created_at)
- `password_reset_tokens` (id UUID, user_id FK→users, token_hash unique, expires_at, used bool, created_at)
- `saved_materials` (id UUID, user_id FK→users, type, title, subject, grade, topic, language, content jsonb, form_state jsonb, is_favorite bool, created_at, updated_at)

## API routes (all under /api prefix)

- `POST /auth/register` — creates user, returns access+refresh tokens
- `POST /auth/login` — verifies bcrypt hash, updates last_login, returns tokens
- `POST /auth/logout` — deletes refresh token from DB (requires auth)
- `POST /auth/refresh` — rotates refresh token, returns new pair
- `GET /auth/me` — returns full user object (requires auth)
- `POST /auth/forgot-password` — stores hashed reset token (logs to console in dev; no email yet)
- `POST /auth/reset-password` — validates token, updates password_hash, revokes all refresh tokens
- `PATCH /auth/users/profile` — updates firstName, lastName, preferredLanguage
- `GET/POST/PATCH/DELETE /workspace/items` + `/workspace/items/:id/duplicate` — all auth-protected

## Mobile client

- Tokens stored in `expo-secure-store` (not AsyncStorage).
- `artifacts/mobile/services/apiClient.ts` — base URL helper, token store/clear, `apiFetch` with auto-refresh on 401, `apiJson` wrapper.
- `AuthContext.tsx` — rewrites mock auth to call real API; exposes `register(firstName, lastName, email, password, confirmPassword)`.
- `workspace.ts` — calls API when authenticated, falls back to AsyncStorage on network failure.

## User type changes

- `User` now has `firstName`, `lastName` (separate), `createdAt`. `name` is a computed `${firstName} ${lastName}`.
- Register screen now collects firstName + lastName separately with confirm-password field.
- Profile screen shows `member since` date from `createdAt`.

**How to apply:** Any code referencing `user.name` still works (computed field). New code should prefer `user.firstName`/`user.lastName`.

## Build note

After adding new tables to `lib/db/src/schema/`, run `tsc -p tsconfig.json --declaration --emitDeclarationOnly` in `lib/db/` before running `typecheck` in `artifacts/api-server/`. The API server uses TypeScript project references and reads compiled declarations from `lib/db/dist/`.
