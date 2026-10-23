# A public «اسأل إقرأ» bot on iqrra.com

Approved in chat on 2026-10-23 (sections 1 and 2). Two repos: this one (the API)
and `NizarAbuahmad/Site_Iqra` (the static landing site, Vercel).

## Problem

A visitor to iqrra.com has questions the page answers only if they read all of
it: what Iqraa is, which grades and subjects it covers, whether it is free, how
the maths is checked, how to get the Android app. The only way to ask is the
contact form, which is a day's wait. The app's own assistant (`POST /chat`) is
for signed-in users and cannot be exposed as it stands.

## Goals and non-goals

**Goal:** a visitor asks a question on the home page and gets a short, correct
answer about Iqraa in the language they wrote in, at a cost we cap.

**Non-goals (decided):**

- No teaching help or demos for anonymous visitors. That spends generation money
  on traffic nobody vetted, and unverified maths in public costs trust.
- No lead capture inside the chat. The waitlist and contact form stay where they
  are; the bot points to them.
- No streaming, no stored conversations, no accounts.
- Home page only at first. Other pages get the same one-line include later.

## Decisions

1. **The backend is a new route on the Iqraa API**, `POST /api/site/ask`, in a new
   file `artifacts/api-server/src/routes/siteAsk.ts`. Not in `admin.ts`, which is
   already the home of `/site/signups` and `/site/ideas` and is mounted without a
   path prefix (see «Routers mounted without a path prefix» in `CLAUDE.md`). The new
   router is mounted at `/site/ask` in `routes/index.ts`, and `mountOrder.test.ts`
   gets a case for it.
2. **It is public with no key**, like `/site/ideas`: a browser cannot hold a secret.
   The defences are limits, not CORS (CORS only constrains browsers; curl ignores
   it). `app.ts` already allows `https://iqrra.com` and `https://www.iqrra.com`.
   - `createRateLimiter` per IP: 20 requests per hour.
   - `createRateLimiter` global (`key: () => "all"`): 600 per hour.
   - Input caps: message at most 300 characters, at most 4 earlier turns, each
     capped the same. Anything over is a 400, not a truncation.
   - Numbers are a starting point, tuned after the first week from the admin
     dashboard's limits table.
3. **Its own spend ceiling**, separate from the teachers' `AI_BUDGET_USD`.
   - Env `SITE_BOT_BUDGET_USD_DAILY`, default `1`.
   - Each answer is recorded with `recordUsage(..., { kind: "site-ask", ... })`, so it
     lands in `ai_generations` with `userId` null. No migration: `kind` is free
     text and `user_id` is nullable.
   - The cap is read as the sum of `cost_usd` for `kind = 'site-ask'` over the last
     24 hours, cached for 60 seconds. It is a query, not an in-process counter,
     because the API runs up to 20 Cloud Run instances and a counter per instance
     would allow 20 times the cap. Column names are confirmed against
     `lib/db/src/schema/aiGenerations.ts` in the plan.
   - The route also calls `assertBudgetAvailable()` and `assertLiveModeEnabled()`,
     so the global budget still stops it.
4. **Fails closed and says so.** If live mode is off, either budget is spent, the
   limiter trips or the model call errors, the response is a fixed message
   (Arabic and English) pointing to `info@iqrra.com` and the contact form. It is
   never a mock answer: `MockAIService`-style content looks exactly like a real
   answer (`CLAUDE.md`, «Mock AI content looks exactly like real AI content»). The
   response carries `{ answered: false, reason }` so the widget and the logs can
   tell a refusal from an answer.
5. **Grounded in the site's own `llms.txt`.**
   - The route fetches `https://www.iqrra.com/llms.txt` with a 5 second timeout, at
     most 20 KB, and caches it for one hour in memory.
   - If the fetch fails or the file is empty, it falls back to a short built-in fact
     block (what it is, free beta, Jordan curriculum, Android early access, contact
     address). It does not invent coverage numbers: the fallback omits them.
   - The site build regenerates `llms.txt` from the same curriculum snapshot as the
     `/manhaj` pages, so the bot cannot drift from the site, and no coverage number
     is hard-coded here.
6. **The prompt** tells the model to answer only from the facts, in the visitor's
   language, in at most a few sentences; to say it does not know and point to the
   contact form when the facts do not cover the question; to refuse anything
   off-topic in one line; and never to write lesson content, solve problems or
   give opinions on other products. Model: `getChatModel()`, `max_tokens` about
   300, no tools. With no tools the worst case of a successful prompt injection is
   a wrong sentence, not an action. The prompt lives in `lib/siteAskPrompts.ts`,
   beside `chatPrompts.ts`, so it can be imported by a test without the OpenAI
   client (`CLAUDE.md`, «The OpenAI client throws at module scope without a key»;
   the client is imported lazily inside the handler).
7. **No message text is logged or stored.** The log line has the outcome, the
   model, the token counts and the cost. The recorded `ai_generations` row has no
   text column.

## The widget (Site_Iqra)

- Two new plain files, `ask.js` and `ask.css`, in the repo root like `blog.js` and
  `blog.css`, and one `<script defer src="/ask.js">` in `index.html`. No build step
  and no dependency.
- Styling follows `DESIGN.md` (read in full before writing CSS): IBM Plex Sans
  Arabic, teal-ink `#006D65` fill with white text, the `#F6F5F1` / `#0B1B33`
  palette, `#E6E3DB` borders, `#B4232A` / `#FDECEC` for the error state.
- The launcher is a round button at the bottom inline-start corner (bottom-left in
  RTL), placed so it does not cover the Android waitlist card. The panel is about
  360 px wide and full width on phones.
- It opens with a greeting and three starter chips: «ما هو إقرأ؟», «ما الصفوف
  والمواد؟», «هل هو مجاني؟».
- History is kept in memory only and is gone on reload. Only the last 4 turns are
  sent.
- Every non-answer (`answered: false`, a 429, a 5xx, a network error) shows one
  friendly message with a link to the contact form. The visitor never sees a raw
  error.
- Accessibility: replies are announced through an `aria-live="polite"` region, Esc
  closes the panel and returns focus to the launcher, the input has a visible
  label, and `prefers-reduced-motion` turns the open animation off. Contrast
  follows the pairs already audited in `DESIGN.md`.
- The API origin is `https://iqraa-api-613126375862.europe-west1.run.app`, the same
  one `api/_store.mjs` already uses, in one constant at the top of `ask.js`.
- A line under the input says messages are processed by an AI provider. `privacy.html`
  gets a short paragraph saying the same, in the style of its other sections.
- The site's PostHog snippet (`ph.js`) is not extended: no message text goes to
  analytics.

## Shipping

1. API PR (this repo), draft. Merging deploys the API; nothing calls the route yet.
2. After it is live, `SITE_BOT_BUDGET_USD_DAILY` is left at its default unless
   changed. No new secret is needed, and no secret reference is added to
   `deploy.yml` (`CLAUDE.md`, «A secret ref in `deploy.yml` before the secret exists
   fails every deploy»).
3. Site_Iqra PR, draft, after the API is verified in production by a `curl` that
   returns a real answer. It needs `add_repo` with push access for that repo.
4. `docs/status-log.md` gets the write-up at the top in the API PR; `STATUS.md`
   changes only if a line in it stops being true.

## Testing

API (inside `src/**/__tests__/**`, per `CLAUDE.md`):

- Validation: empty, over-long, wrong-typed and too-many-turn bodies are 400.
- Fail-closed paths each return `answered: false` with the right `reason`: live
  mode off, daily cap reached, global budget reached, model error.
- The model is never called when a cap has tripped (assert on a fake).
- Prompt test: the system prompt contains the facts block and the refusal rules;
  an off-topic question and a lesson-writing request are refused by instruction
  (prompt-content assertions, not model calls).
- `llms.txt` loader: success, timeout, oversize and empty all behave; the fallback
  contains no digit-bearing coverage claim.
- Rate limiting uses the injectable `store` so no database is needed.
- `mountOrder.test.ts`: an unowned path still 404s, and `/site/ask` is public.

Site: `node --test` for any pure helper in `ask.js` (turn trimming); the rest is
checked by hand in a browser at phone and desktop width, in RTL, because layout
and the live region cannot be asserted in a unit test.

**Not verified by tests, and said so:** answer quality on real visitor questions.
Before the site PR, ask the live route 15 to 20 real questions, including
off-topic and injection attempts, and record the answers in the log.

## Open points

- Rate limits and the $1 default are guesses until there is traffic.
- Whether to add the include to the other site pages is a later, one-line change.
