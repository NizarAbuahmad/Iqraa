# Cutting AI spend when many teachers ask for the same thing

_Written 2026-08-22 against the code on `main` at 289e973. Every "today"
claim below was checked in the source, not carried over from an older doc._

The problem this plans for: Iqraa serves a **fixed national curriculum**. A few
hundred teachers all teach كثيرات الحدود in the same week and all ask for a
worksheet on it. Today each of those requests is its own OpenAI call. That is
the single largest avoidable cost in the product.

## Decisions taken (2026-08-22)

| Decision | Choice |
| --- | --- |
| Identical output vs variants | **Pool of 3–5 variants per key**, served round-robin |
| Cache scope | **Global for requests with no `additionalContext`**; per-user for requests that carry it |
| Discrete vs free-form form inputs | **Constrain the UI** to discrete durations / question counts |

The variant pool is a product call, not a cost one: a single shared worksheet
means two classes in the same school get the identical sheet and students swap
answers. A pool of 3–5 costs ~N× a single cache entry and still beats the
uncached path by two orders of magnitude.

The scope rule exists because `additionalContext` is **free text teachers paste
from their own material**. Serving a globally-cached artifact derived from
teacher A's pasted content to teacher B is a content leak. Requests carrying it
never enter the global cache.

## What the code does today (verified)

- Every `/generate/*` request is one uncached model call. There is no cache of
  any kind in `artifacts/api-server/src` or `lib/db` — the only `cache` matches
  in the tree are comments in `aiBudget.ts` about OpenAI's own cached-input
  pricing tier.
- Six routes share one helper, `generateContent()` in
  `artifacts/api-server/src/routes/generate.ts`: lesson-plan, worksheet, quiz,
  homework, activity, classroom-activity.
- All six pass the same `GENERATION_TOKENS = 8000` ceiling. The comment above
  that constant claims the ceiling "is now set per task below"; it is not, it is
  one constant at every call site. Fixing the comment or the code is part of
  phase 1.
- `src/lib/aiBudget.ts` holds the spend total **in process memory**. It resets
  on restart and is not shared across instances. Its own header says so. It is a
  test-mode seatbelt, not a production cost control.
- `saved_materials` (`lib/db/src/schema/savedMaterials.ts`) already stores
  `content` and `form_state` as jsonb per user. It is the right shape for a
  library but is private per teacher, so it does no deduplication work.
- Live spend is currently ~$0: `DEMO_MODE = true` keeps these routes unreached.
  That makes now the cheapest possible time to design this.

## Why a naive cache is not enough

Key the cache on the full `AIRequest` and the key space explodes, because the
fine-grained parameters multiply:

| Kind | Varying params | Approx. keys across math S1 (18 lessons) |
| --- | --- | --- |
| worksheet / quiz / homework | difficulty (4) × numQuestions (~3) | ~648 |
| lesson-plan | duration (3) × teachingStyle (3) | ~162 |
| activity / classroom-activity | activityType (5–6) × duration × difficulty | ~1,000+ |

Thousands of keys over 18 lessons means most requests still miss, and a cache
with a 20% hit rate is not worth the complexity it adds.

### The fix: generate a superset, slice locally

Generate **one superset artifact per (lesson × kind × language)** and apply
difficulty, question count and duration as post-processing on the way out:

- Generate 15 questions, each tagged with its difficulty. Serve 5 / 10 / 15 and
  easy / medium / hard by filtering, not by generating.
- Generate the 60-minute lesson plan. Trim sections for the 45- and 30-minute
  variants.

That takes math S1 from ~1,800 keys to **~90**, which is small enough to
generate the entire semester up front. This is the change that makes everything
downstream work; the cache is the mechanism, the superset is the leverage.

It is also why the UI has to offer discrete choices. A free-form duration
slider re-inflates the key space no matter how good the cache is.

## The numbers

Grounded in the model actually shipped, not the default in `CLAUDE.md`:
**gpt-5.4-mini at $0.75 / $4.50 per million**, and the **~1,300 tokens per
generation** measured by the provider eval (STATUS.md, 2026-08-22). That works
out to roughly **$0.0065 per generation** — the "fractions of a cent" the eval
recorded.

- **Pre-generating all ~90 math S1 supersets: about $1.** A superset is larger
  than a normal artifact (15 questions rather than 8), so call it ~2,500 output
  tokens each. Three variants per key across four subject-semesters lands near
  **$12, one-time**.
- **Uncached at scale:** 1,000 teachers × 10 generations/week ≈ **$280/month**.
  Move generation to full `gpt-5.4` ($2.50/$15) and the same traffic is roughly
  **$930/month**.

The point is not shaving the mini bill. **Caching is what makes a better model
affordable**: pay once for quality on an artifact that will be reused a thousand
times, and keep the cheap model for genuine one-offs. That asymmetry — expensive
model for the amortised catalog, cheap model for cache misses — is the plan's
main lever, and it is invisible if you only think about per-request cost.

### The 8000-token ceiling is not where the money is

Worth stating plainly so nobody spends a phase on it. `GENERATION_TOKENS = 8000`
looks wasteful next to a measured ~1,300 tokens of actual output, but an unused
ceiling costs nothing — it is a cap, not a reservation. Lowering it saves no
money and risks silently truncating an artifact, which is the exact failure
STATUS.md records for 2026-08-20. Leave the number alone; just fix the comment
above it, which claims a per-task ceiling the code does not have.

The real output-side saving is smaller and different: every prompt asks the
model to echo back `grade`, `subject`, `duration`, `difficulty` and `groupType`,
all of which the server already holds in the request body. Dropping them from
the required output shape and merging them in server-side removes tokens billed
at 6× the input rate for information nobody generated. A few percent, free.

## Two failure modes a plain cache does not fix

**Simultaneous misses.** Thirty teachers in one training session request the
same lesson within a few seconds. All thirty miss, because none has written back
yet, and you pay thirty times for one artifact. A per-key in-flight promise map
(single-flight) collapses them into one call and makes the rest wait on it. Given
that "many teachers asking for the same thing" is the exact scenario this plan
addresses, this matters as much as the cache itself.

**A prompt edit silently serving stale artifacts.** The cache key must include a
prompt version and the model id, or improving a prompt changes nothing for any
teacher whose request already has an entry. Bump the version in the same commit
that edits a prompt.

## Cache key

Hash a **normalized** request, not the raw body. Normalization is where hit
rate is won or lost:

- Drop fields at their default value, so `{duration: 45}` and `{}` agree.
- Sort `questionTypes` and any other array before hashing.
- Collapse whitespace; normalize Arabic `topic` (strip tatweel and diacritics,
  unify alef forms) — otherwise two spellings of the same lesson are two keys.
- Prefer the curriculum lesson id over the topic string wherever the client has
  one. A free-typed topic is a cache miss by construction; phase 4 maps those
  back onto lesson ids.
- Exclude the sliced parameters (difficulty, numQuestions, duration) entirely —
  they are applied after retrieval, not baked into the key.

Key = `hash(kind, lessonId | normalizedTopic, language, promptVersion, model)`.

## Storage

Postgres, one new table, not Redis. The data is small, it must survive restarts,
and the project already runs Neon; adding a second datastore for this is not
worth the operational surface.

Note the standing hazard recorded in `CLAUDE.md`: **the production schema is not
deployed by anything automatic.** `pnpm --filter @workspace/db run push` is
manual, and a release that adds a table without it leaves endpoints answering
503. This plan adds tables in phases 0 and 1 — both need that push, and the
release checklist should say so.

## Phases

**Phase 0 — instrument before optimising.** One row per generation: normalized
key hash, kind, model, prompt version, prompt/completion tokens, estimated cost,
and `cache: hit | miss | inflight`. Without it, every hit-rate claim in this
document is a guess, and this repo's convention is to verify against the running
system rather than trust a doc. Cheap, and it is what proves phase 1 worked.

**Phase 1 — shared cache + single-flight.** Content-addressed lookup on the
normalized key, plus the in-flight map described above. Also drop the echoed
scaffold fields from the output shapes. Expect a moderate hit rate here —
phase 2 is what makes it high.

**Phase 2 — superset generation and local slicing.** The key-space collapse, plus
the UI change to discrete inputs. This is the phase that actually earns the
savings.

**Phase 3 — precompute the curriculum catalog.** An offline job walking
`lib/curriculum` lessons, run before launch, so a teacher's *first* request for a
standard lesson is already a hit. This converts a variable per-request cost into
a fixed one-off — see the numbers above.

**Phase 4 — long tail and hard limits.** Embedding-based topic normalization
(`text-embedding-3-small` at ~$0.02/M is effectively free) to map free-typed
topics onto curriculum lesson ids, turning tail misses into head hits. Plus
per-user daily quotas and a persistent spend counter to replace the in-memory
one, so a single teacher looping "regenerate" cannot drain the shared budget.

## Deliberately not in this plan

**Provider-side prompt caching** is real but second-order here. Cost is dominated
by output tokens at 6× the input rate, and the large invariant blocks (the JSON
shape specs, ~400 lines of them in the classroom-activity prompts) sit in the
*user* message, not a stable prefix. Restructuring for prefix reuse buys less
than its size suggests. Revisit once phases 1–3 have landed and the remaining
spend is measured rather than assumed.

**Chat is a different problem.** `/chat` turns are conversational and will not
exact-match. Its levers are history truncation (`CHAT_HISTORY_TURNS`, already
there), the size of the grounding context the client sends, and the separate
`AI_MODEL_CHAT` setting. It should not be forced into this cache.
