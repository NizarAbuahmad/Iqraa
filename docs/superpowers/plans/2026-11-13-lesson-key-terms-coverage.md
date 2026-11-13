# Science Lessons Cover Every Key Term — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development (recommended) or executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A physics or chemistry lesson's slides, quiz, worksheet and homework cover every key term the book lists for that lesson, and a slide's photo is explained in words.

**Architecture:** The app sends the lesson's book vocabulary as `keyTerms` (physics and chemistry only). The API validates it in one module (`keyTerms.ts`, modelled on `coverage.ts`), renders a coverage clause into the quiz, worksheet/homework and lesson-teaching prompts, hashes it into the strict cache key, and logs which terms a reply never mentions. The lesson-teaching prompt also gets a wider concept range when terms need it and a photo rule for every lesson.

**Tech Stack:** TypeScript, Express API (`artifacts/api-server`), Expo app services (`artifacts/mobile/services`), `node --test` with `--experimental-strip-types`.

**Spec:** `docs/superpowers/specs/2026-11-13-lesson-key-terms-coverage-design.md`

## Global Constraints

- Terms are sent only when the lesson's own book `subjectId` is `physics` or `chemistry`; never for a wide scope.
- Server limits: 1–12 terms, each 1–60 characters after folding whitespace to one space; anything else renders nothing.
- A request without terms must produce byte-for-byte the same prompts and the same cache keys as today, except the lesson-teaching photo rule (which applies to every lesson and moves `PROMPT_VERSION_BY_KIND['lesson-teaching']`).
- Concept range: lower bound 3; upper bound `max(5, min(8, terms.length))`.
- Missing terms are logged only — never retried, trimmed or refused.
- Offline generators are not changed.
- No `sed -i` / `perl -pi` on source (CLAUDE.md); use the Edit tool. Files contain Arabic.
- Mobile tests live only under `artifacts/mobile/services/__tests__/`; API tests under `artifacts/api-server/src/**/__tests__/`.
- In `deepStrictEqual` a key set to `undefined` is not the same as a missing key: add `keyTerms` with a conditional spread, never `keyTerms: undefined`, or the maths request pins in `lessonTeachingRequest.test.ts` break.
- No «ما الجديد» entry; the PR body says why.

## File map

| File | Change |
|---|---|
| `artifacts/api-server/src/lib/keyTerms.ts` | **Create.** `parseKeyTerms`, prompt clauses, `missingKeyTerms` |
| `artifacts/api-server/src/lib/__tests__/keyTerms.test.ts` | **Create.** |
| `artifacts/api-server/src/lib/prompts.ts` | Quiz and worksheet prompts print the question clause |
| `artifacts/api-server/src/lib/__tests__/quizPrompts.test.ts` | Pins for the clause |
| `artifacts/api-server/src/lib/lessonTeachingPrompt.ts` | Concept range, teaching clause, photo rule |
| `artifacts/api-server/src/lib/__tests__/lessonTeachingPrompt.test.ts` | Pins |
| `artifacts/api-server/src/lib/generationKey.ts` | `keyTermsHash`; lesson-teaching version |
| `artifacts/api-server/src/lib/__tests__/generationKey.test.ts` | Pins |
| `artifacts/api-server/src/routes/generate.ts` | «key terms coverage» log in four routes |
| `artifacts/mobile/services/ai/AIService.ts` | `AIRequest.keyTerms` |
| `artifacts/mobile/services/kbContext.ts` | `scienceKeyTerms`, `keyTermsField` |
| `artifacts/mobile/services/generatorRequests.ts` | Worksheet/homework and lesson-teaching requests carry terms |
| `artifacts/mobile/app/ai-tools/quiz.tsx` | Quiz request carries terms |
| `artifacts/mobile/services/lessonSlides.ts` | `usableTeaching` keeps up to 8 concepts |
| `artifacts/mobile/services/__tests__/keyTerms.test.ts` | **Create.** |
| `artifacts/mobile/services/__tests__/lessonSlides.test.ts` | 8-concept pin |
| `docs/status-log.md`, `STATUS.md` | Write-up and one line |

---

### Task 0: Record the "before" output (live model)

Do this first, on the branch before any code changes, so the comparison in Task 7 has a baseline.

**Files:**
- Create (scratchpad, not committed): `$SCRATCH/live/compare.ts`. Every shell step in Tasks 0 and 7 starts with `export SCRATCH=/tmp/claude-0/-home-user-Iqraa/33e07f7b-582b-5db3-b942-62ad2d3e357f/scratchpad` (the shell does not keep variables between calls).

- [ ] **Step 1: Write the comparison script**

```ts
// $SCRATCH/live/compare.ts — run from artifacts/api-server:
//   node --experimental-strip-types $SCRATCH/live/compare.ts <before|after>
// Calls the real model with the real prompt builders for the two lessons the
// reviewer flagged. api.openai.com is authenticated by the session proxy, so
// the key below is a dummy the proxy replaces.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { quizPromptAr, systemPrompt } from "/home/user/Iqraa/artifacts/api-server/src/lib/prompts.ts";
import { lessonTeachingPromptAr } from "/home/user/Iqraa/artifacts/api-server/src/lib/lessonTeachingPrompt.ts";
import { withGrounding } from "/home/user/Iqraa/artifacts/api-server/src/lib/grounding.ts";

const label = process.argv[2] ?? "before";
const DATA = "/home/user/Iqraa/lib/curriculum/src/data/";
const MODEL = process.env.AI_MODEL_GENERATE ?? "gpt-5.4-mini";

type Lesson = { id: string; title_ar: string; main_idea_ar: string; objectives: string[]; vocabulary: { ar: string }[] };
function lesson(file: string, id: string): Lesson {
  const d = JSON.parse(readFileSync(DATA + file, "utf8"));
  for (const u of d.units) for (const l of u.lessons) if (l.id === id) return l;
  throw new Error(id);
}
// The app's context block, approximated from the same book data (title, main
// idea, outcomes, vocabulary). Identical before and after, which is what matters.
function context(l: Lesson): string {
  return [`📚 الدرس: ${l.title_ar}`, "", l.main_idea_ar, "", "النتاجات (من المنهاج الرسمي):",
    ...l.objectives.map(o => `• ${o}`), "", "المصطلحات:", ...l.vocabulary.map(v => `• ${v.ar}`)].join("\n");
}

async function ask(system: string, user: string): Promise<unknown> {
  const r = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: "Bearer sk-dummy" },
    body: JSON.stringify({ model: MODEL, response_format: { type: "json_object" },
      messages: [{ role: "system", content: system }, { role: "user", content: user }] }),
  });
  const j = await r.json() as any;
  if (!r.ok) throw new Error(JSON.stringify(j));
  return JSON.parse(j.choices[0].message.content);
}

const runs = [
  { name: "u2_l2-quiz", file: "iqra_curriculum_g10_phys_sem1.json", id: "u2_l2", kind: "quiz" },
  { name: "u6_l2-teaching", file: "iqra_curriculum_g10_phys_sem2.json", id: "u6_l2", kind: "teaching" },
] as const;

mkdirSync(`${import.meta.dirname}/${label}`, { recursive: true });
for (const run of runs) {
  const l = lesson(run.file, run.id);
  const kbId = `kbl-phys-${run.file.includes("sem2") ? "s2" : "s1"}-nccd-${run.id}`;
  const raw = {
    subject: "Physics", grade: "الصف العاشر", topic: l.title_ar, language: "arabic",
    lessonId: kbId, additionalContext: context(l), contextSource: "curriculum",
    keyTerms: l.vocabulary.map(v => v.ar),   // ignored by the "before" prompts
    numQuestions: 10, totalMarks: 20, questionTypes: ["multiple_choice", "true_false", "fill_blank", "short_answer"],
  };
  const { body } = withGrounding(raw, true);
  const user = run.kind === "quiz" ? quizPromptAr(body) : lessonTeachingPromptAr(body);
  const out = await ask(systemPrompt(true), user);
  writeFileSync(`${import.meta.dirname}/${label}/${run.name}.json`, JSON.stringify(out, null, 2));
  writeFileSync(`${import.meta.dirname}/${label}/${run.name}.prompt.txt`, user);
  console.log(label, run.name, "ok");
}
```

- [ ] **Step 2: Check `systemPrompt` is exported from `prompts.ts` and `withGrounding` from `grounding.ts`**

Run: `grep -n "export function systemPrompt" artifacts/api-server/src/lib/prompts.ts; grep -n "export function withGrounding" artifacts/api-server/src/lib/grounding.ts`
Expected: one line each. If the model id differs, read `getGenerationModel()` in `artifacts/api-server/src/lib/aiBudget.ts` for the default and STATUS.md «Live config» for production's; use production's.

- [ ] **Step 3: Run it**

Run: `cd artifacts/api-server && node --experimental-strip-types $SCRATCH/live/compare.ts before`
Expected: `before u2_l2-quiz ok`, `before u6_l2-teaching ok`, two JSON files in `$SCRATCH/live/before/`.
If the proxy refuses `api.openai.com`, stop and report; do not invent output.

- [ ] **Step 4: Read both outputs by hand and note, per term, whether it is covered** (the u2_l2 quiz: time of flight, range, maximum height as calculations?; u6_l2: which of the seven phenomena have a concept slide?). Save the notes as `$SCRATCH/live/before/notes.md`. No commit.

---

### Task 1: `keyTerms.ts` — parse, clauses, matcher

**Files:**
- Create: `artifacts/api-server/src/lib/keyTerms.ts`
- Test: `artifacts/api-server/src/lib/__tests__/keyTerms.test.ts`

**Interfaces:**
- Consumes: `parseWideScope(raw: unknown)` from `artifacts/api-server/src/lib/grounding.ts` (truthy for a valid wide scope).
- Produces:
  - `KEY_TERMS_MAX = 12`
  - `parseKeyTerms(body: Record<string, unknown>): string[] | null`
  - `keyTermsQuestionClauseAr(b: Record<string, unknown>): string` / `…En` — `''` without terms
  - `keyTermsTeachingClauseAr(b: Record<string, unknown>): string` / `…En` — `''` without terms
  - `missingKeyTerms(terms: string[], content: unknown): string[]`

- [ ] **Step 1: Write the failing test**

```ts
// artifacts/api-server/src/lib/__tests__/keyTerms.test.ts
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  KEY_TERMS_MAX, keyTermsQuestionClauseAr, keyTermsQuestionClauseEn,
  keyTermsTeachingClauseAr, keyTermsTeachingClauseEn, missingKeyTerms, parseKeyTerms,
} from "../keyTerms.ts";

const WAVES = ["انعكاس الموجة", "انكسار الموجة", "مبدأ تراكب الموجات", "تداخل", "حيود", "استقطاب", "تأثير دوبلر"];
const scope = { kind: "semester", scopeKey: "sem:grade-10:physics:2", unitIds: ["kbu-phys-s2-nccd-u6"] };

describe("parseKeyTerms", () => {
  it("reads a clean list", () => {
    assert.deepEqual(parseKeyTerms({ keyTerms: WAVES }), WAVES);
  });

  it("folds whitespace and drops duplicates", () => {
    assert.deepEqual(parseKeyTerms({ keyTerms: [" زمن\nالتحليق ", "زمن التحليق", "المدى الأفقي"] }), ["زمن التحليق", "المدى الأفقي"]);
  });

  it("rejects request-controlled junk", () => {
    assert.equal(parseKeyTerms({}), null);
    assert.equal(parseKeyTerms({ keyTerms: "حيود" }), null);
    assert.equal(parseKeyTerms({ keyTerms: [] }), null);
    assert.equal(parseKeyTerms({ keyTerms: ["حيود", 3] }), null);
    assert.equal(parseKeyTerms({ keyTerms: ["حيود", "  "] }), null);
    assert.equal(parseKeyTerms({ keyTerms: ["x".repeat(61)] }), null);
    assert.equal(parseKeyTerms({ keyTerms: Array.from({ length: KEY_TERMS_MAX + 1 }, (_, i) => `t${i}`) }), null);
  });

  it("is null on a wide scope — a semester paper is spread over lessons, not terms", () => {
    assert.equal(parseKeyTerms({ scope, keyTerms: WAVES }), null);
  });
});

describe("clauses", () => {
  for (const [lang, q, t] of [["ar", keyTermsQuestionClauseAr, keyTermsTeachingClauseAr], ["en", keyTermsQuestionClauseEn, keyTermsTeachingClauseEn]] as const) {
    it(`${lang}: nothing without terms`, () => {
      assert.equal(q({}), "");
      assert.equal(t({}), "");
      assert.equal(q({ keyTerms: ["x".repeat(61)] }), "");
    });

    it(`${lang}: the question clause lists every term and asks for calculations on quantities`, () => {
      const c = q({ keyTerms: WAVES });
      for (const term of WAVES) assert.ok(c.includes(`- ${term}`), term);
      assert.match(c, lang === "ar" ? /سؤالًا واحدًا على الأقل/ : /at least one question/);
      assert.match(c, lang === "ar" ? /مسألة حسابية بأرقام/ : /calculation with numbers/);
    });

    it(`${lang}: the teaching clause lists every term and forbids dropping one`, () => {
      const c = t({ keyTerms: WAVES });
      for (const term of WAVES) assert.ok(c.includes(`- ${term}`), term);
      assert.match(c, lang === "ar" ? /لا تُسقط مصطلحًا/ : /Do not drop a term/);
      assert.match(c, lang === "ar" ? /"workedExample"/ : /"workedExample"/);
    });
  }
});

describe("missingKeyTerms", () => {
  const content = {
    concepts: [
      { title: "يحدث الحيود عند مرور الموجة بفتحة", points: ["حُيود الموجات يزداد كلما ضاقت الفتحة"] },
      { title: "يحدث انكسار الموجة عند انتقالها بين وسطين", points: ["تتغير سرعتها"] },
      { title: "الانكسار يغيّر الاتجاه", points: ["مثال"] },
    ],
    workedExample: { problem: "احسب التردد الذي يسمعه المراقب في تأثير دوبلر", steps: ["..."] },
  };

  it("finds a term with the article added or with harakat", () => {
    assert.deepEqual(missingKeyTerms(["حيود", "تأثير دوبلر"], content), []);
  });

  it("finds a two-word term only as the whole phrase", () => {
    assert.deepEqual(missingKeyTerms(["انكسار الموجة"], content), []);
    assert.deepEqual(missingKeyTerms(["انعكاس الموجة"], content), ["انعكاس الموجة"]);
    // «الانكسار» alone, as in the third concept, is not «انكسار الموجة».
    assert.deepEqual(missingKeyTerms(["انكسار الموجة"], { title: "الانكسار يغيّر الاتجاه" }), ["انكسار الموجة"]);
  });

  it("works for English and ignores case", () => {
    assert.deepEqual(missingKeyTerms(["Time of Flight", "Range"], { q: "Find the time of flight." }), ["Range"]);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd artifacts/api-server && node --experimental-strip-types --test src/lib/__tests__/keyTerms.test.ts`
Expected: FAIL — cannot find module `../keyTerms.ts`.

- [ ] **Step 3: Write the module**

```ts
// artifacts/api-server/src/lib/keyTerms.ts
/**
 * The lesson's key terms, as its book prints them, and what the prompts do
 * with them.
 *
 * A Grade 10 physics teacher's review (2026-11-12) found generated material
 * that skipped what the book teaches: the «الحركة في بعدين» quiz had no
 * time-of-flight, range or maximum-height problem, and the «خصائص الحركة
 * الموجية» deck left out refraction, interference, diffraction and
 * polarisation. Every one of those is in the lesson's own vocabulary, which
 * already rode in `additionalContext` as a list nobody was told to cover.
 *
 * The app sends the list as `keyTerms` for physics and chemistry lessons only
 * (`scienceKeyTerms` in artifacts/mobile/services/kbContext.ts), because there
 * the vocabulary lists the ideas a lesson teaches. It is request-controlled,
 * so it is bounded here and anything else renders nothing: a request without
 * terms gets every prompt byte-for-byte as before. The cache key hashes what
 * `parseKeyTerms` returns (generationKey.ts), so what is hashed is what the
 * model is shown.
 *
 * `missingKeyTerms` is a measurement for the log, not a gate: nothing is
 * retried, trimmed or refused on it. See
 * docs/superpowers/specs/2026-11-13-lesson-key-terms-coverage-design.md.
 *
 * Imports nothing that touches the OpenAI client.
 */
import { parseWideScope } from "./grounding.ts";

export const KEY_TERMS_MAX = 12;
const TERM_MAX = 60;

export function parseKeyTerms(body: Record<string, unknown>): string[] | null {
  if (parseWideScope(body.scope)) return null;
  const raw = body.keyTerms;
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > KEY_TERMS_MAX) return null;
  const out: string[] = [];
  for (const item of raw) {
    if (typeof item !== "string") return null;
    const term = item.replace(/\s+/g, " ").trim();
    if (term.length === 0 || term.length > TERM_MAX) return null;
    if (!out.includes(term)) out.push(term);
  }
  return out;
}

const list = (terms: string[]) => terms.map(t => `- ${t}`).join("\n");

export function keyTermsQuestionClauseAr(b: Record<string, unknown>): string {
  const terms = parseKeyTerms(b);
  if (!terms) return "";
  return `\nمصطلحات الدرس كما في الكتاب:\n${list(terms)}\nوزّع الأسئلة على هذه المصطلحات بحيث يتناول كل مصطلح سؤالًا واحدًا على الأقل ما دام عدد الأسئلة يسمح؛ وإن كانت الأسئلة أقل من المصطلحات فاختر مصطلحات متباعدة في القائمة ولا تحصرها في أولها. المصطلح الذي يمثّل كمية تُقاس أو تُحسب (مثل زمن التحليق أو الكتلة المولية) يُسأل عنه بمسألة حسابية بأرقام، في سؤال من الأنواع المطلوبة أعلاه.`;
}

export function keyTermsQuestionClauseEn(b: Record<string, unknown>): string {
  const terms = parseKeyTerms(b);
  if (!terms) return "";
  return `\nThe lesson's key terms, as the book prints them:\n${list(terms)}\nSpread the questions over these terms so that every term gets at least one question while the count allows; if there are fewer questions than terms, pick terms spread across the list rather than the first few. A term that is a quantity to measure or calculate (such as time of flight or molar mass) is asked about as a calculation with numbers, in one of the question types requested above.`;
}

export function keyTermsTeachingClauseAr(b: Record<string, unknown>): string {
  const terms = parseKeyTerms(b);
  if (!terms) return "";
  return `\nمصطلحات الدرس كما في الكتاب (إلزامي):\n${list(terms)}\nاشرح كل مصطلح منها في فكرة واحدة على الأقل من "concepts"، ويجوز أن تجمع فكرةٌ مصطلحين متلازمين إذا شرحتهما معًا (مثل التداخل ومبدأ تراكب الموجات). لا تُسقط مصطلحًا. حين يكون للمصطلح علاقة رياضية في هذا الدرس فليكن مثاله في "points" مسألة قصيرة بأرقام. وإن كان بين المصطلحات كمية تُحسب فاجعل "workedExample" و"practice" مسألتين حسابيتين عن إحداها.\n`;
}

export function keyTermsTeachingClauseEn(b: Record<string, unknown>): string {
  const terms = parseKeyTerms(b);
  if (!terms) return "";
  return `\nThe lesson's key terms, as the book prints them (mandatory):\n${list(terms)}\nExplain every term in at least one item of "concepts"; one concept may cover two terms that belong together if it explains both (such as interference and the principle of superposition). Do not drop a term. When a term has a mathematical relation in this lesson, make its example in "points" a short problem with numbers. If any term is a quantity that is calculated, make "workedExample" and "practice" calculations about one of them.\n`;
}

// ─── Measuring ───────────────────────────────────────────────────────────────

const HARAKAT = /[ً-ْٰـ]/g;
// A leading «و/ف», then «ب/ك» + «ال», or «لل» (ل + ال). Only when two letters
// remain, so «ال» itself is not emptied. Both sides go through this, so a word
// that merely starts with «ال» still matches itself.
const ARTICLE = /^[وف]?(?:[بك]?ال|لل)(?=..)/u;

function tokens(s: string): string[] {
  return s
    .toLowerCase()
    .replace(HARAKAT, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean)
    .map(t => t.replace(ARTICLE, ""));
}

function collectStrings(value: unknown, out: string[], depth = 0): void {
  if (typeof value === "string") out.push(value);
  else if (depth < 6 && Array.isArray(value)) value.forEach(v => collectStrings(v, out, depth + 1));
  else if (depth < 6 && value && typeof value === "object") {
    Object.values(value as Record<string, unknown>).forEach(v => collectStrings(v, out, depth + 1));
  }
}

/** The terms whose whole phrase appears nowhere in the reply's text. */
export function missingKeyTerms(terms: string[], content: unknown): string[] {
  const parts: string[] = [];
  collectStrings(content, parts);
  const text = ` ${tokens(parts.join(" ")).join(" ")} `;
  return terms.filter(term => {
    const t = tokens(term);
    return t.length > 0 && !text.includes(` ${t.join(" ")} `);
  });
}
```

- [ ] **Step 4: Run the test**

Run: `cd artifacts/api-server && node --experimental-strip-types --test src/lib/__tests__/keyTerms.test.ts`
Expected: PASS, all tests. If `parseWideScope` is not exported from `grounding.ts` under that name, read `coverage.ts`'s import and use the same.

- [ ] **Step 5: Commit**

```bash
git add artifacts/api-server/src/lib/keyTerms.ts artifacts/api-server/src/lib/__tests__/keyTerms.test.ts
git commit -m "API: parse a lesson's key terms and measure which a reply covers"
```

---

### Task 2: Quiz, worksheet and homework prompts print the question clause

**Files:**
- Modify: `artifacts/api-server/src/lib/prompts.ts` (`quizPromptAr` ~l.580, `quizPromptEn` ~l.616, `worksheetPromptAr` ~l.435, `worksheetPromptEn` ~l.480)
- Test: `artifacts/api-server/src/lib/__tests__/quizPrompts.test.ts` (append)

**Interfaces:**
- Consumes: `keyTermsQuestionClauseAr/En` from Task 1.

- [ ] **Step 1: Write the failing test** (append to `quizPrompts.test.ts`; it already imports `quizPromptAr, quizPromptEn, worksheetPromptAr, worksheetPromptEn` from `../prompts.ts` — do not add a second import line)

```ts
describe("key terms reach the quiz and worksheet prompts", () => {
  const terms = ["المقذوفات", "أقصى ارتفاع", "زمن التحليق", "المدى الأفقي"];
  const base = { subject: "Physics", grade: "الصف العاشر", topic: "الحركة في بعدين", numQuestions: 10 };
  const builders = [
    ["quiz ar", quizPromptAr], ["quiz en", quizPromptEn],
    ["worksheet ar", worksheetPromptAr], ["worksheet en", worksheetPromptEn],
    ["homework ar", (b: any) => worksheetPromptAr({ ...b, homework: true })],
    ["homework en", (b: any) => worksheetPromptEn({ ...b, homework: true })],
  ] as const;

  for (const [name, build] of builders) {
    it(`${name}: lists every term when sent`, () => {
      const p = build({ ...base, keyTerms: terms });
      for (const t of terms) assert.ok(p.includes(`- ${t}`), t);
    });

    it(`${name}: is unchanged without terms`, () => {
      assert.equal(build({ ...base, keyTerms: [] }), build(base));
      assert.equal(build({ ...base, keyTerms: ["x".repeat(61)] }), build(base));
    });
  }
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd artifacts/api-server && node --experimental-strip-types --test src/lib/__tests__/quizPrompts.test.ts`
Expected: FAIL on "lists every term when sent" (6 cases).

- [ ] **Step 3: Implement**

In `prompts.ts`, next to line 19 (`import { coverageClauseAr, coverageClauseEn } from "./coverage.ts";`) add:

```ts
import { keyTermsQuestionClauseAr, keyTermsQuestionClauseEn } from "./keyTerms.ts";
```

Then, in each of the four builders, append the clause directly after the coverage clause call (the two can never both render: a wide scope sends no terms and `parseKeyTerms` refuses one):

- `worksheetPromptAr`: `${coverageClauseAr(b, !!example)}` → `${coverageClauseAr(b, !!example)}${keyTermsQuestionClauseAr(b)}`
- `worksheetPromptEn`: `${coverageClauseEn(b, !!example)}` → `${coverageClauseEn(b, !!example)}${keyTermsQuestionClauseEn(b)}`
- `quizPromptAr`: `${QUIZ_VARIETY_RULE_AR}${coverageClauseAr(b)}` → `${QUIZ_VARIETY_RULE_AR}${coverageClauseAr(b)}${keyTermsQuestionClauseAr(b)}`
- `quizPromptEn`: `${QUIZ_VARIETY_RULE_EN}${coverageClauseEn(b)}` → `${QUIZ_VARIETY_RULE_EN}${coverageClauseEn(b)}${keyTermsQuestionClauseEn(b)}`

- [ ] **Step 4: Run the test and the other prompt suites**

Run: `cd artifacts/api-server && node --experimental-strip-types --test src/lib/__tests__/quizPrompts.test.ts src/lib/__tests__/coverage.test.ts src/lib/__tests__/prompts.test.ts src/lib/__tests__/worksheetKindPrompts.test.ts src/lib/__tests__/difficultyPrompts.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add artifacts/api-server/src/lib/prompts.ts artifacts/api-server/src/lib/__tests__/quizPrompts.test.ts
git commit -m "API: quiz, worksheet and homework prompts spread questions over the lesson's key terms"
```

---

### Task 3: Lesson-teaching prompt — concept range, terms, photo rule, version

**Files:**
- Modify: `artifacts/api-server/src/lib/lessonTeachingPrompt.ts`
- Modify: `artifacts/api-server/src/lib/generationKey.ts` (`PROMPT_VERSION_BY_KIND` and its doc comment, ~l.20–53)
- Test: `artifacts/api-server/src/lib/__tests__/lessonTeachingPrompt.test.ts` (append), `artifacts/api-server/src/lib/__tests__/generationKey.test.ts` (l.330)

**Interfaces:**
- Consumes: `parseKeyTerms`, `keyTermsTeachingClauseAr/En` (Task 1).
- Produces: `TEACHING_CONCEPTS_MAX_WITH_TERMS = 8`, `teachingConceptsMax(b: Record<string, unknown>): number` exported from `lessonTeachingPrompt.ts`.

- [ ] **Step 1: Write the failing tests** (append to `lessonTeachingPrompt.test.ts`; extend its import line from `../lessonTeachingPrompt.ts` with `TEACHING_CONCEPTS_MAX, TEACHING_CONCEPTS_MIN, TEACHING_CONCEPTS_MAX_WITH_TERMS, teachingConceptsMax`)

```ts
describe("lesson-teaching: key terms", () => {
  const WAVES = ["انعكاس الموجة", "انكسار الموجة", "مبدأ تراكب الموجات", "تداخل", "حيود", "استقطاب", "تأثير دوبلر"];
  const PHYS = { topic: "خصائص الحركة الموجية", subject: "Physics", grade: "الصف العاشر" };

  it("widens the concept range only as far as the terms need, up to 8", () => {
    assert.equal(teachingConceptsMax({}), TEACHING_CONCEPTS_MAX);
    assert.equal(teachingConceptsMax({ keyTerms: ["أ", "ب", "ج", "د"] }), TEACHING_CONCEPTS_MAX);
    assert.equal(teachingConceptsMax({ keyTerms: WAVES }), 7);
    assert.equal(teachingConceptsMax({ keyTerms: [...WAVES, "ث", "خ", "ذ"] }), TEACHING_CONCEPTS_MAX_WITH_TERMS);
    assert.equal(TEACHING_CONCEPTS_MAX_WITH_TERMS, 8);
  });

  for (const [lang, build] of [["ar", lessonTeachingPromptAr], ["en", lessonTeachingPromptEn]] as const) {
    it(`${lang}: asks for 3–7 concepts and lists every term for a seven-term lesson`, () => {
      const p = build({ ...PHYS, keyTerms: WAVES });
      assert.ok(p.includes(lang === "ar" ? `من ${TEACHING_CONCEPTS_MIN} إلى 7 شرائح` : `${TEACHING_CONCEPTS_MIN} to 7 slides`));
      for (const t of WAVES) assert.ok(p.includes(`- ${t}`), t);
    });

    it(`${lang}: keeps 3–5 and prints no term list without terms`, () => {
      const p = build(PHYS);
      assert.ok(p.includes(lang === "ar" ? `من ${TEACHING_CONCEPTS_MIN} إلى ${TEACHING_CONCEPTS_MAX} شرائح` : `${TEACHING_CONCEPTS_MIN} to ${TEACHING_CONCEPTS_MAX} slides`));
      assert.ok(!p.includes(lang === "ar" ? "مصطلحات الدرس كما في الكتاب" : "key terms, as the book prints them"));
    });

    it(`${lang}: a photo must be explained in words, on every lesson`, () => {
      const p = build(BODY);
      assert.match(p, lang === "ar" ? /ومتى أضفت "photo" فاجعل أحد سطور "points" يقول ما يظهر في الصورة/ : /When you add a "photo", make one line of "points" say what the photo shows/);
    });
  }
});
```

And in `generationKey.test.ts` line 330 change the expected version:

```ts
    assert.equal(promptVersionFor("lesson-teaching"), "2026-11-13.1");
```

- [ ] **Step 2: Run them to verify they fail**

Run: `cd artifacts/api-server && node --experimental-strip-types --test src/lib/__tests__/lessonTeachingPrompt.test.ts src/lib/__tests__/generationKey.test.ts`
Expected: FAIL — `teachingConceptsMax` is not exported; version is `2026-11-03.2`.

- [ ] **Step 3: Implement in `lessonTeachingPrompt.ts`**

Add the import after the existing imports:

```ts
import { keyTermsTeachingClauseAr, keyTermsTeachingClauseEn, parseKeyTerms } from "./keyTerms.ts";
```

Under `export const TEACHING_CONCEPTS_MAX = 5;` add:

```ts
/** The ceiling when the book's key terms need more than five ideas (u6_l2 has seven). */
export const TEACHING_CONCEPTS_MAX_WITH_TERMS = 8;

/** The upper bound asked for: five, or one slide per key term up to eight. */
export function teachingConceptsMax(b: Record<string, unknown>): number {
  const terms = parseKeyTerms(b);
  return terms ? Math.max(TEACHING_CONCEPTS_MAX, Math.min(TEACHING_CONCEPTS_MAX_WITH_TERMS, terms.length)) : TEACHING_CONCEPTS_MAX;
}
```

In `lessonTeachingPromptAr`, rule 3: replace `${TEACHING_CONCEPTS_MAX} شرائح` with `${teachingConceptsMax(b)} شرائح`.
In `lessonTeachingPromptEn`, rule 3: replace `to ${TEACHING_CONCEPTS_MAX} slides` with `to ${teachingConceptsMax(b)} slides`.

Photo rule, Arabic (rule 13): replace the line

```
   - "photo": عبارة بحث إنجليزية من ٢-٥ كلمات لمشهد حقيقي (مكان، تجربة، ظاهرة)، لا لقاعدة رياضية؛ في فكرتين على الأكثر.
```

with

```
   - "photo": عبارة بحث إنجليزية من ٢-٥ كلمات لمشهد حقيقي (مكان، تجربة، ظاهرة)، لا لقاعدة رياضية؛ في فكرتين على الأكثر. ومتى أضفت "photo" فاجعل أحد سطور "points" يقول ما يظهر في الصورة وكيف يوضّح الفكرة، فالصورة لا تُعرض بلا كلام يفسّرها.
```

Photo rule, English (rule 13): replace

```
   - "photo": a 2-5 word English search phrase for a real scene (a place, an experiment, a phenomenon), never for a maths rule; on two concepts at most.
```

with

```
   - "photo": a 2-5 word English search phrase for a real scene (a place, an experiment, a phenomenon), never for a maths rule; on two concepts at most. When you add a "photo", make one line of "points" say what the photo shows and how it illustrates the idea; a photo is never projected without words that explain it.
```

Terms clause: in both builders, insert the clause on its own line right before the return-shape line. Arabic: change

```
` : ''}
أعد JSON بهذا الشكل فقط:
```

to

```
` : ''}${keyTermsTeachingClauseAr(b)}
أعد JSON بهذا الشكل فقط:
```

English: change

```
` : ''}
Return only JSON in this shape:
```

to

```
` : ''}${keyTermsTeachingClauseEn(b)}
Return only JSON in this shape:
```

- [ ] **Step 4: Bump the lesson-teaching version in `generationKey.ts`**

Append to the dated list in the doc comment above `PROMPT_VERSION_BY_KIND`:

```ts
 *   2026-11-13: a concept's photo must be explained in its points (the physics
 *   review found an air-track photo projected with no word on why), and a
 *   physics or chemistry lesson's key terms each get a concept. Pooled sections
 *   from before have photos nobody explains.
```

and change the value:

```ts
const PROMPT_VERSION_BY_KIND: Readonly<Record<string, string>> = {
  "lesson-teaching": "2026-11-13.1",
};
```

- [ ] **Step 5: Run the tests**

Run: `cd artifacts/api-server && node --experimental-strip-types --test src/lib/__tests__/lessonTeachingPrompt.test.ts src/lib/__tests__/generationKey.test.ts src/lib/__tests__/promptSlidesPrompt.test.ts src/lib/__tests__/figurePrompt.test.ts`
Expected: PASS. If an existing test pins the old photo sentence verbatim, update its expected text to the new sentence (do not delete the test).

- [ ] **Step 6: Commit**

```bash
git add artifacts/api-server/src/lib/lessonTeachingPrompt.ts artifacts/api-server/src/lib/generationKey.ts artifacts/api-server/src/lib/__tests__/lessonTeachingPrompt.test.ts artifacts/api-server/src/lib/__tests__/generationKey.test.ts
git commit -m "API: slides explain every key term (up to 8 concepts) and every photo"
```

---

### Task 4: Key terms in the strict cache key

**Files:**
- Modify: `artifacts/api-server/src/lib/generationKey.ts` (after the `coverageHash` block, ~l.265–271)
- Test: `artifacts/api-server/src/lib/__tests__/generationKey.test.ts` (append)

- [ ] **Step 1: Write the failing test**

```ts
describe("key terms", () => {
  const body = { lessonId: "kbl-phys-s2-nccd-u6_l2", subject: "Physics", grade: "10", language: "arabic", topic: "خصائص الحركة الموجية" };
  const k = (b: Record<string, unknown>) => generationKeys("quiz", "m", b);

  it("move the strict key and not the coarse key", () => {
    const withTerms = k({ ...body, keyTerms: ["حيود", "تداخل"] });
    assert.notEqual(withTerms.strictKey, k(body).strictKey);
    assert.equal(withTerms.coarseKey, k(body).coarseKey);
  });

  it("different lists are different artifacts", () => {
    assert.notEqual(k({ ...body, keyTerms: ["حيود"] }).strictKey, k({ ...body, keyTerms: ["تداخل"] }).strictKey);
  });

  it("junk terms, which render nothing, leave the key exactly as it was", () => {
    assert.deepEqual(k({ ...body, keyTerms: [] }), k(body));
    assert.deepEqual(k({ ...body, keyTerms: ["x".repeat(61)] }), k(body));
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd artifacts/api-server && node --experimental-strip-types --test src/lib/__tests__/generationKey.test.ts`
Expected: FAIL on "move the strict key".

- [ ] **Step 3: Implement**

Add the import next to `import { parseCoverage } from "./coverage.ts";`:

```ts
import { parseKeyTerms } from "./keyTerms.ts";
```

After the `if (coverage) { … }` block add:

```ts
  // A lesson's key terms are rendered into the prompt as a checklist, so a
  // request with them asks for a different artifact. Hashed as parsed, like
  // the coverage table, so junk (which renders nothing) contributes nothing
  // and a request without terms keeps its key.
  const keyTerms = parseKeyTerms(body);
  if (keyTerms) {
    strict.keyTermsHash = createHash("sha256").update(JSON.stringify(keyTerms)).digest("hex").slice(0, 16);
  }
```

- [ ] **Step 4: Run the test**

Run: same as Step 2. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add artifacts/api-server/src/lib/generationKey.ts artifacts/api-server/src/lib/__tests__/generationKey.test.ts
git commit -m "API: key terms are part of the strict cache key"
```

---

### Task 5: Log which terms a reply skipped

**Files:**
- Modify: `artifacts/api-server/src/routes/generate.ts` (imports ~l.36; the worksheet, quiz, homework routes ~l.766–816; lesson-teaching ~l.892)

**Interfaces:**
- Consumes: `parseKeyTerms`, `missingKeyTerms` (Task 1); `GenerateResult` (already in the file: `{ content, variantId?, servedReason? }`).

- [ ] **Step 1: Add the import and helper**

Next to `import { lessonTeachingPromptAr, lessonTeachingPromptEn, teachingVisualCounts } from "../lib/lessonTeachingPrompt.ts";` add:

```ts
import { missingKeyTerms, parseKeyTerms } from "../lib/keyTerms.ts";
```

Right after the `withMeta` function add:

```ts
/**
 * Which of the lesson's key terms the reply never mentions — a measurement,
 * not a gate (lib/keyTerms.ts). `variantId` / `servedReason` say whether this
 * is a fresh generation or a pooled one served again, so a skipped term is not
 * counted once per teacher.
 */
function logKeyTermCoverage(kind: string, body: Record<string, unknown>, result: GenerateResult): void {
  const terms = parseKeyTerms(body);
  if (!terms) return;
  logger.info({
    kind,
    lessonId: typeof body.lessonId === "string" ? body.lessonId : undefined,
    terms: terms.length,
    missing: missingKeyTerms(terms, result.content),
    variantId: result.variantId,
    servedReason: result.servedReason,
  }, "key terms coverage");
}
```

- [ ] **Step 2: Call it in the four routes**, immediately before each `res.json(withMeta(result, grounding));`:

- `/generate/worksheet`: `logKeyTermCoverage("worksheet", body, result);`
- `/generate/quiz`: `logKeyTermCoverage("quiz", body, result);`
- `/generate/homework`: `logKeyTermCoverage("homework", body, result);`
- `/generate/lesson-teaching`: `logKeyTermCoverage("lesson-teaching", body, result);` (after the existing «lesson-teaching visuals» log)

- [ ] **Step 3: Build and run the whole API suite**

Run: `cd artifacts/api-server && pnpm build && pnpm test`
Expected: build succeeds; all tests pass (the mount-order suite runs because the bundle was built).

- [ ] **Step 4: Commit**

```bash
git add artifacts/api-server/src/routes/generate.ts
git commit -m "API: log which key terms a generation skipped"
```

---

### Task 6: The app sends the terms; slides keep up to 8 concepts

**Files:**
- Modify: `artifacts/mobile/services/ai/AIService.ts` (`AIRequest`, after `lessonId?`)
- Modify: `artifacts/mobile/services/kbContext.ts` (new exports near `groundingRequestFields`)
- Modify: `artifacts/mobile/services/generatorRequests.ts` (`buildWorksheetRequest`, `buildLessonTeachingRequest`)
- Modify: `artifacts/mobile/app/ai-tools/quiz.tsx` (~l.477)
- Modify: `artifacts/mobile/services/lessonSlides.ts` (l.195)
- Create: `artifacts/mobile/services/__tests__/keyTerms.test.ts`
- Modify: `artifacts/mobile/services/__tests__/lessonSlides.test.ts` (in `describe('usableTeaching')`)

**Interfaces:**
- Produces: `scienceKeyTerms(lesson: KBLesson | null | undefined, lang: 'ar' | 'en'): string[] | undefined` and `keyTermsField(terms: string[] | undefined): { keyTerms?: string[] }` in `kbContext.ts`.

- [ ] **Step 1: Write the failing tests**

```ts
// artifacts/mobile/services/__tests__/keyTerms.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getLessonById } from '../knowledgeBase.ts';
import { keyTermsField, resolveGeneratorGrounding, scienceKeyTerms } from '../kbContext.ts';
import { buildLessonTeachingRequest, buildWorksheetRequest } from '../generatorRequests.ts';

const WAVES = 'kbl-phys-s2-nccd-u6_l2';
const PROJECTILES = 'kbl-phys-s1-nccd-u2_l2';
const SPECTRUM = 'kbl-chem-s1-nccd-u1_l1';
const MATH = 'kbl-math-s1-nccd-u1_l1';

test('physics sends its book vocabulary, in the content language', () => {
  assert.deepEqual(scienceKeyTerms(getLessonById(PROJECTILES), 'ar'),
    ['المقذوفات', 'أقصى ارتفاع', 'زمن التحليق', 'المدى الأفقي', 'حركة دائرية منتظمة', 'تسارع مركزي']);
  assert.deepEqual(scienceKeyTerms(getLessonById(WAVES), 'en')?.slice(0, 2), ['Wave Reflection', 'Wave Refraction']);
});

test('chemistry sends its terms too', () => {
  assert.ok((scienceKeyTerms(getLessonById(SPECTRUM), 'ar') ?? []).includes('الطيف الذري'));
});

test('maths, no lesson, or a lesson without terms sends nothing', () => {
  assert.equal(scienceKeyTerms(getLessonById(MATH), 'ar'), undefined);
  assert.equal(scienceKeyTerms(null, 'ar'), undefined);
  assert.deepEqual(keyTermsField(undefined), {});
  assert.deepEqual(keyTermsField(['حيود']), { keyTerms: ['حيود'] });
});

const physicsGrounding = () =>
  resolveGeneratorGrounding('خصائص الحركة الموجية', 'ar', { scope: { gradeId: 'grade-10', subjectId: 'physics' }, lessonId: WAVES });

test('the worksheet / homework request carries them', () => {
  const req = buildWorksheetRequest({
    gradeName: 'الصف العاشر', subjectName: 'Physics', topic: 'خصائص الحركة الموجية', lang: 'ar',
    difficulty: 'medium', numQuestions: 8, questionTypes: ['short_answer'], includePriorReview: false,
  }, physicsGrounding());
  assert.equal(req.lessonId, WAVES);
  assert.equal(req.keyTerms?.length, 7);
});

test('the slides explanation request carries them', () => {
  const req = buildLessonTeachingRequest({ gradeName: 'الصف العاشر', subjectName: 'Physics', topic: 'خصائص الحركة الموجية', lang: 'ar' }, physicsGrounding());
  assert.ok(req.keyTerms?.includes('تأثير دوبلر'));
});
```

Append inside `describe('usableTeaching', …)` in `lessonSlides.test.ts`:

```ts
  it('keeps up to 8 concepts, for a lesson whose book lists that many terms (physics review, 2026-11-12)', () => {
    const concepts = Array.from({ length: 9 }, (_, i) => ({ title: `فكرة ${i + 1}`, points: ['شرح'] }));
    const t = usableTeaching({ concepts });
    assert.equal(t.concepts.length, 8);
    assert.equal(t.concepts[7]!.title, 'فكرة 8');
  });
```

- [ ] **Step 2: Run them to verify they fail**

Run: `cd artifacts/mobile && node --import ./scripts/registerTestAlias.mjs --experimental-strip-types --test services/__tests__/keyTerms.test.ts services/__tests__/lessonSlides.test.ts`
Expected: FAIL — `scienceKeyTerms` not exported; 8-concept test gets 5.

- [ ] **Step 3: Implement**

`AIService.ts`, in `AIRequest` after `lessonId?: string;`:

```ts
  /**
   * The lesson's key terms as its book prints them, for a physics or
   * chemistry lesson only (`scienceKeyTerms` in services/kbContext.ts). The
   * live prompts ask for every term to be covered; the server bounds the list
   * and hashes it into the strict cache key. Absent for every other subject
   * and for a wide scope. The offline generators ignore it.
   */
  keyTerms?: string[];
```

`kbContext.ts`, right after `groundingRequestFields`:

```ts
/**
 * Subjects whose book vocabulary lists the ideas a lesson teaches. English
 * vocabulary is a word list and maths terms name rules the deck already
 * projects, so neither sends terms. Add a subject only after reading its
 * lessons' vocabulary.
 */
const KEY_TERM_SUBJECTS = new Set(['physics', 'chemistry']);
const KEY_TERMS_MAX = 12;
const KEY_TERM_LENGTH_MAX = 60;

/**
 * A science lesson's key terms in the content language — `AIRequest.keyTerms`.
 * Read off the lesson the screen already grounded, never re-derived from the
 * title. Bounded like the server's `parseKeyTerms`, so an honest request is
 * never refused there.
 */
export function scienceKeyTerms(lesson: KBLesson | null | undefined, lang: 'ar' | 'en'): string[] | undefined {
  if (!lesson) return undefined;
  const book = getBookForLesson(lesson);
  if (!book || !KEY_TERM_SUBJECTS.has(book.subjectId)) return undefined;
  const terms: string[] = [];
  for (const t of lesson.keyTerms) {
    const term = (lang === 'ar' ? t.ar : t.en).replace(/\s+/g, ' ').trim();
    if (term && term.length <= KEY_TERM_LENGTH_MAX && !terms.includes(term)) terms.push(term);
  }
  return terms.length > 0 ? terms.slice(0, KEY_TERMS_MAX) : undefined;
}

/** Spread into a request: no key at all when there are no terms, so other subjects' requests are unchanged. */
export function keyTermsField(terms: string[] | undefined): { keyTerms?: string[] } {
  return terms ? { keyTerms: terms } : {};
}
```

`generatorRequests.ts`: add `keyTermsField, scienceKeyTerms` to its existing import from `./kbContext.ts` (or add `import { keyTermsField, scienceKeyTerms } from './kbContext.ts';` if it has none). In `buildWorksheetRequest`, after `contextSource: 'curriculum' as const,` add:

```ts
    ...keyTermsField(scienceKeyTerms(grounding.lesson, form.lang === 'ar' ? 'ar' : 'en')),
```

In `buildLessonTeachingRequest`, after `contextSource: 'curriculum' as const,` add the same line.

`quiz.tsx`: add `keyTermsField, scienceKeyTerms` to the `@/services/kbContext` import (line 14), and after `bookFigureCount: lessonFields?.bookFigureCount,` add:

```tsx
        // The lesson's book terms, physics and chemistry only — see AIRequest.keyTerms.
        ...keyTermsField(lessonGrounding ? scienceKeyTerms(lessonGrounding.lesson, lang === 'ar' ? 'ar' : 'en') : undefined),
```

`lessonSlides.ts` line 195: replace

```ts
/** More than this and the explanation stops being a section of the lesson. */
const TEACHING_CONCEPTS_MAX = 5;
```

with

```ts
/**
 * More than this and the explanation stops being a section of the lesson. It
 * was 5; a physics lesson whose book lists seven ideas (خصائص الحركة الموجية)
 * now asks for up to 8 — `TEACHING_CONCEPTS_MAX_WITH_TERMS` in the API's
 * lessonTeachingPrompt.ts — so the app keeps what the prompt asked for.
 */
const TEACHING_CONCEPTS_MAX = 8;
```

- [ ] **Step 4: Check nothing else caps the deck's concepts**

Run: `grep -rn "concepts\.slice\|TEACHING_CONCEPTS" artifacts/mobile/services artifacts/mobile/app --include=*.ts --include=*.tsx | grep -v __tests__`
Expected: only `lessonSlides.ts`. If another cap appears (an export, the presenter), raise it to 8 in the same way and add it to this task's commit.

- [ ] **Step 5: Run the mobile tests**

Run: `cd artifacts/mobile && pnpm test`
Expected: PASS, including `lessonTeachingRequest.test.ts` (maths requests unchanged because `keyTermsField(undefined)` adds no key) and `generatorRequests.test.ts`. The suite prints nothing until it finishes (minutes).

- [ ] **Step 6: Typecheck**

Run: `cd /home/user/Iqraa && pnpm run typecheck`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add artifacts/mobile/services/ai/AIService.ts artifacts/mobile/services/kbContext.ts artifacts/mobile/services/generatorRequests.ts artifacts/mobile/app/ai-tools/quiz.tsx artifacts/mobile/services/lessonSlides.ts artifacts/mobile/services/__tests__/keyTerms.test.ts artifacts/mobile/services/__tests__/lessonSlides.test.ts
git commit -m "App: physics and chemistry requests carry the lesson's key terms; slides keep up to 8 concepts"
```

---

### Task 7: The "after" output, compared by hand

- [ ] **Step 1: Run the script from Task 0 with the changed prompts**

Run: `cd artifacts/api-server && node --experimental-strip-types $SCRATCH/live/compare.ts after`
Expected: two files in `$SCRATCH/live/after/`.

- [ ] **Step 2: Confirm the prompt changed and the terms are in it**

Run: `grep -c "مصطلحات الدرس كما في الكتاب" $SCRATCH/live/after/*.prompt.txt $SCRATCH/live/before/*.prompt.txt`
Expected: 1 for each `after` file, 0 for each `before` file.

- [ ] **Step 3: Measure, then read every question, step and answer key by hand**

Run (from `artifacts/api-server`):

```bash
node --experimental-strip-types -e '
import("/home/user/Iqraa/artifacts/api-server/src/lib/keyTerms.ts").then(async ({ missingKeyTerms }) => {
  const fs = await import("node:fs");
  const d = process.env.SCRATCH + "/live/";
  const terms = { "u2_l2-quiz": ["المقذوفات","أقصى ارتفاع","زمن التحليق","المدى الأفقي","حركة دائرية منتظمة","تسارع مركزي"],
                  "u6_l2-teaching": ["انعكاس الموجة","انكسار الموجة","مبدأ تراكب الموجات","تداخل","حيود","استقطاب","تأثير دوبلر"] };
  for (const label of ["before","after"]) for (const [name, t] of Object.entries(terms)) {
    const c = JSON.parse(fs.readFileSync(d + label + "/" + name + ".json", "utf8"));
    console.log(label, name, "missing:", missingKeyTerms(t, c));
  }
});'
```

Then read both `after` files in full. Check each answer key yourself (CLAUDE.md): for every projectile calculation recompute the value (g as the book uses it), for Doppler recompute the frequency. Write `$SCRATCH/live/after/notes.md`: terms covered before vs after, calculations present, any wrong key.

- [ ] **Step 4: If a key is wrong or a term is still skipped**, do not tweak the prompt silently: report it to the user with the text, and decide together whether it belongs in this PR.

---

### Task 8: Docs, full checks, push

**Files:**
- Modify: `docs/status-log.md` (new entry at the TOP), `STATUS.md` (one line in its recent-changes list)

- [ ] **Step 1: Write the log entry** at the top of `docs/status-log.md`, titled «Science lessons cover every key term of the book, 2026-11-13». Include: the reviewer's three findings; what changed (terms sent for physics/chemistry, the clauses, 3–8 concepts, the photo rule, the version bump `2026-11-13.1` and its pool cost, the cache key); what was verified (test suites; the live before/after from Task 7 with the measured missing terms and the keys checked by hand); what was **not** (no live run through the deployed API or the app; offline generators unchanged, so an offline paper can still skip a term; chat/batch homework paths send no terms); the log line name «key terms coverage».

- [ ] **Step 2: Add one line to STATUS.md's dated list** in its existing format:

```
- 2026-11-13 — Physics and chemistry slides, quizzes, worksheets and homework cover every key term the book lists for the lesson; slide photos are explained (spec `docs/superpowers/specs/2026-11-13-lesson-key-terms-coverage-design.md`; entry «Science lessons cover every key term of the book» in the log)
```

- [ ] **Step 3: Run everything CI runs**

```bash
cd /home/user/Iqraa && pnpm run typecheck
```
```bash
cd /home/user/Iqraa/artifacts/api-server && pnpm build && pnpm test
```
```bash
cd /home/user/Iqraa/artifacts/mobile && pnpm test
```
Expected: all pass. Paste failures into the PR rather than skipping a test.

- [ ] **Step 4: Check for corruption and stray files**

Run: `git diff origin/main --stat`
Expected: only the files in the file map, the spec and the plan; no `Bin` line for a text file.

- [ ] **Step 5: Commit, push, update the PR**

```bash
git add docs/status-log.md STATUS.md
git commit -m "Docs: key-terms coverage write-up"
git push -u origin claude/blissful-turing-e7329d
```

Update the PR body of NizarAbuahmad/Iqraa#1422: what changed, the before/after table from Task 7, the not-verified list, and «ما الجديد: none — content of existing tools improves; no new capability». Keep it a draft until the user asks otherwise.
