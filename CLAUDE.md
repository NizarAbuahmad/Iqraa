# Iqraa — agent context

Arabic-native AI teaching assistant for the Jordanian national curriculum
(Grade 10 math + chemistry first). pnpm monorepo.

## Read this first

**[`STATUS.md`](./STATUS.md) is the single source of truth for project state.**
Read it before acting. When something in it stops being true, edit it in the
same PR that changed it.

Older audits live in `docs/archive/` — historical snapshots, do not act on them.
`.agents/memory/` holds deeper notes: `iqra-architecture.md`,
`ai-integration.md`, `auth-workspace-api.md`.

## Layout

| Path | What |
| --- | --- |
| `artifacts/mobile` | Expo / React Native app (also the web build) |
| `artifacts/api-server` | Express API |
| `artifacts/math-verifier` | SymPy FastAPI service — verifies math answer keys |
| `artifacts/mockup-sandbox` | Design sandbox, **excluded from the workspace** |
| `lib/curriculum` | NCCD curriculum data, shared by app and API |
| `lib/db` | Drizzle schema |

## Commands

```bash
pnpm install
pnpm run typecheck                     # whole monorepo
pnpm run dev:api                       # Express on :8080
pnpm run dev:mobile:web                # Expo web on :8081 (MOBILE_PORT overrides)

cd artifacts/mobile     && pnpm test   # 896 tests (2026-08-25)
cd artifacts/api-server && pnpm build && pnpm test   # build first — see below
```

`artifacts/api-server`'s mount-order suite boots the built bundle, so run
`pnpm build` before `pnpm test` there or it skips. Both `test` scripts glob
`**/__tests__/**/*.test.ts`; they were once hand-listed and silently drifted, so
**add tests inside those globs, and do not narrow them.**

Local setup, env vars and troubleshooting: [`LOCAL_SETUP.md`](./LOCAL_SETUP.md).
Before a live demo: [`docs/demo-checklist.md`](./docs/demo-checklist.md).

## Conventions

- Feature branches + PRs. `main` is merge-only, and **only `main` is deployed** —
  if a change "isn't showing", check it is merged before debugging anything visual.
- Arabic is the product language; the UI is RTL-first. Compute maths in latin
  `x` and convert to `س` / Arabic digits **only at display time**.
- `DEMO_MODE = true` in `artifacts/mobile/services/ai/demoMode.ts` mocks all
  prose generation. Do not flip it without a decision — see STATUS.md.

## Things that have bitten before

- **Verify claims against the running system.** Several past bugs were things a
  doc asserted and the running system contradicted. This file included.
- **`verified` means the verifier confirmed it.** Never set it from a
  code-computed fallback — that shipped once and served items flagged verified
  that nothing had checked. Use `verificationSource` to say how a key was
  established. Fail closed, or label honestly; never both-at-once.
- **Routers mounted without a path prefix see every request.** A bare
  `router.use(mw)` inside one becomes API-wide middleware and shadows every
  router mounted after it. Scope guards to their paths. The tell is an unowned
  path returning 401 instead of 404 — `src/routes/__tests__/mountOrder.test.ts`
  asserts this.
- **Extensionless relative imports only work through esbuild.** Anything loaded
  directly by `node --test` needs an explicit `.ts` extension.
- **The OpenAI client throws at module scope without a key**, which makes
  importing pure helpers in the same file impossible. Import it lazily inside
  the function that calls a model.
- ~~The `gpt-5.6-luna` model id is hardcoded in three api-server files.~~
  **No longer true (checked 2026-08-19):** that string appears nowhere. The
  model comes from `getAiModel()` in `lib/aiBudget.ts` — `AI_MODEL`, defaulting
  to `gpt-4o-mini`. Live generation is gated by `AI_LIVE_MODE=true` and capped
  by `AI_BUDGET_USD`, with `EXPO_PUBLIC_DEMO_MODE=false` on the client. So
  turning real AI on is env vars, not a code change.
- **Mock AI content looks exactly like real AI content.** `RemoteAIService`
  falls back to `MockAIService` on any failure, so with `DEMO_MODE=false` a
  bad key still renders a full lesson plan. Since 2026-08-20 every generation
  is recorded in `services/ai/aiProvenance.ts` and the header badge says which
  it was — check the badge, not the content, when asking "is live AI on?".
- **A missing `EXPO_PUBLIC_*` key is a silent no-op, not an error.** Analytics
  ran for weeks collecting nothing because `EXPO_PUBLIC_POSTHOG_API_KEY` was
  never declared anywhere, and `analytics.ts` degrades to `client = null` by
  design. Same shape as the Unsplash and YouTube "no key" paths. If a
  feature's data is mysteriously absent, check the key is set *and* that the
  build which inlined it has actually deployed — these are baked in at build
  time, so an env change without a rebuild changes nothing.
- **The production schema is not deployed by anything.** `pnpm --filter
  @workspace/db run push` is manual, so a release that adds a table and skips
  that push leaves endpoints answering 503. On 2026-08-19, 14 of 24 expected
  tables were missing from production, including the entire evaluations
  subsystem — **and it was fixed the same afternoon** (Neon query history:
  found 1:36pm, migrated 1:41pm, re-checked 1:42pm). This entry went on
  asserting the outage for three more days, because only the problem got
  written down and not the fix.
  **Verified 24/24 present on 2026-08-22.** The gap in the *process* is real
  and still open; that particular outage is not. Re-check with
  `pnpm --filter @workspace/db run verify-schema` rather than trusting this
  line — and note it only asks whether each table *name* exists, so a table
  with a stale column set still reports `ok`.
