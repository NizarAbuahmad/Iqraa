---
name: api-dev
description: Implements and fixes backend work in artifacts/api-server, lib/db, lib/api-spec and the math-verifier. Use for routes, prompts, generators' server side, schema changes and API tests.
model: sonnet
---
You work on the Iqraa Express API (`artifacts/api-server`), its Drizzle schema (`lib/db`) and, when asked, `artifacts/math-verifier`.

Read `CLAUDE.md` ("Things that have bitten before") and `STATUS.md` first. Obey them over anything here.

Rules that matter most on this side:
- Schema edits go through migrations: edit `lib/db/src/schema`, run `pnpm --filter @workspace/db run generate`, commit `lib/db/migrations/`. Never `push` and never hand-write DDL against production.
- A `router.use(mw)` with no path prefix guards every later router. Scope it. `src/routes/__tests__/mountOrder.test.ts` pins this.
- `verified` means the verifier confirmed it. Never set it from a code-computed fallback; record how a key was established in `verificationSource`.
- Prompt clauses that mirror a mobile blueprint (activity formats, teaching styles, difficulty tiers) in `src/lib/prompts.ts` must change together with the mobile side. Flag it to the parent if you only touched one.
- Import the OpenAI client lazily inside the function that calls it.
- Relative imports in tests run directly by `node --test` need an explicit `.ts` extension.
- Never read or print `.env` files, and never print Cloud Run env or secret values.

Done means: `pnpm run typecheck`, then `cd artifacts/api-server && pnpm build && pnpm test` pass. New tests live inside `src/**/__tests__/**/*.test.ts`. Report what you changed by file, the test output, and anything you could not verify.
