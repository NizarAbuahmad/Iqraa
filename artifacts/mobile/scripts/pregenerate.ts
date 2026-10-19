/**
 * Pre-generate default worksheets, lesson plans and lesson explanations into
 * the shared pool.
 *
 * The first teacher to ask for a lesson waits 7–14 s for the model; everyone
 * after gets the stored copy in ~0.5 s. This makes the first teacher's copy in
 * advance, for the lessons and options teachers pick by default.
 *
 * It only helps a request that matches exactly (see `generatorRequests.ts`),
 * which is why the bodies come from the same builders the screens use.
 *
 *   pnpm run pregenerate                     dry run: lists the calls and the
 *                                            worst-case cost, sends nothing
 *   PREGEN_API_BASE=https://…  PREGEN_EMAIL=…  PREGEN_PASSWORD=…  \
 *     pnpm run pregenerate -- --go [--cap=1] [--only=lesson-teaching]
 *                                            sends them, stops at the cap
 *
 * An account that signs in with Google has no password: set PREGEN_TOKEN (the
 * web app's `iqra_access_token` from local storage; it lasts 15 minutes, so a
 * long run can end with a refused token — copy a fresh one and re-run)
 * instead of PREGEN_EMAIL and PREGEN_PASSWORD.
 *
 * Use a dedicated account: every call counts against that account's AI quota,
 * not a real teacher's. Re-running is safe and cheap — a call the pool already
 * holds returns fast and is not counted against the cap.
 *
 * LESSON EXPLANATIONS FOR STUDENTS (`lesson-teaching`) have two more steps,
 * because what is stored is not what is shown to a minor:
 *
 *   1. `--go --only=lesson-teaching` generates (or finds) each lesson's
 *      explanation and writes `pregen-review.json` (`--review=` to rename):
 *      for each lesson, the text a student would read. One difference: the
 *      student cards strip one leading list marker («•», «-», «1.», «(1)») from
 *      each concept point and worked-example step (`stripMarker`,
 *      `lessonExplanationCards.ts`), so the file shows that text before the
 *      strip. The strip never touches a dash or «(N)» in front of maths.
 *   2. A person reads the file and deletes the entries they reject. Look for
 *      wording that assumes a class or a projector ("your teacher", "the
 *      screen"), wrong maths or chemistry, and a different lesson's content.
 *      Edits are NOT applied: each entry carries a hash of its `variantId`,
 *      `lessonId` and text, and `--approve` refuses the whole file if any
 *      entry no longer matches it (so changing an id to approve a different
 *      variant counts as an edit too), or if an entry is malformed (a
 *      `variantId` that is not a uuid, no `content`). To reject an entry,
 *      delete it; do not reword it.
 *   3. `pnpm run pregenerate -- --approve=pregen-review.json` marks the entries
 *      left in the file as fit for students. Needs a `system_admin` login.
 *      Nothing is approved by a run that only generates. `--approve` stands
 *      alone: combined with `--go`, `--only`, `--force` or `--review` it
 *      refuses to run rather than ignore them.
 *
 * The review file is never overwritten without `--force`: a generate run that
 * finds it refuses, because rerunning can serve a variant you already rejected
 * and would bring its entry back. Finish `--approve` (or delete the file)
 * first, or write a second file with `--review=<other file>`. Approving does
 * not remove the file: it stays on disk, so a later bare `--go` (which writes
 * a review file) is refused until you delete or rename it, or pass `--force`.
 *
 * A bare `--go` plans the worksheet and lesson-plan calls first and the
 * lesson-teaching calls last. The default $1 cap allows about 100 model calls
 * (at the $0.01 estimate); on 2026-10-18 the dry run printed 66 of the earlier
 * calls and 50 teaching calls, so at worst only about 34 teaching calls fit and
 * the rest are cut off partway (a call the pool already holds answers in under
 * 3 s and does not count against the cap). The counts move with the curriculum
 * data: run the dry run for today's. Use `--only=lesson-teaching`.
 *
 * REPLACING A REJECTED EXPLANATION. Deleting an entry from the review file only
 * keeps it from being approved; the stored variant stays in the pool, so the
 * next `--go` serves the same one again and that lesson keeps showing «قريبًا».
 * To get a fresh one, retire the variant: a `system_admin` (who may call
 * `/generate/*`) files a report on that `variantId` with
 * `POST /generate/variants/:id/retire` (it queues a report; it does not retire
 * by itself), then resolves the report as `approved` on the admin
 * artifact-reports screen (`POST /moderation/artifact-reports/:id/resolve`),
 * which retires the row. The next `--go --only=lesson-teaching` then generates
 * a new variant for that lesson.
 *
 * ponytail: grade 10 maths (worksheets and plans) and grade 10 maths +
 * chemistry (explanations). Other grades/subjects are the `SCOPE` and
 * `TEACHING_SCOPES` lines; other option combinations only if teachers turn out
 * to change the defaults a lot (the pool's hit rate says).
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { getPickerGrades, getPickerSubjects } from '../services/curriculumData.ts';
import { getLessonsForUnit, getUnitsForSubjectGrade } from '../services/knowledgeBase.ts';
import { resolveGeneratorGrounding } from '../services/kbContext.ts';
import {
  buildLessonPlanRequest,
  buildLessonTeachingRequest,
  buildWorksheetRequest,
  groundLessonPlanTopic,
} from '../services/generatorRequests.ts';

type Scope = { gradeNameAr: string; subjectName: string };

const SCOPE: Scope = { gradeNameAr: 'الصف العاشر', subjectName: 'Mathematics' };
const TEACHING_SCOPES: Scope[] = [
  SCOPE,
  { gradeNameAr: 'الصف العاشر', subjectName: 'Chemistry' },
];
/** Conservative: gpt-4o-mini is nearer $0.003 for one of these. */
const EST_COST_PER_CALL_USD = 0.01;
/** Faster than any model call; the pool answered. */
const POOL_HIT_MS = 3000;

const args = process.argv.slice(2);
const flag = (name: string): string | undefined => flagIn(args, name);
const go = args.includes('--go');
const capUsd = Number(flag('cap') ?? 1);
const reviewPath = flag('review') ?? 'pregen-review.json';
const approvePath = flag('approve');
const force = args.includes('--force');

const KINDS = ['worksheet', 'lesson-plan', 'lesson-teaching'] as const;
export type Kind = (typeof KINDS)[number];

/** The value of `--name=value`, or undefined when the flag is absent or has no `=`. */
function flagIn(argv: string[], name: string): string | undefined {
  return argv.find(a => a.startsWith(`--${name}=`))?.split('=').slice(1).join('=');
}

/**
 * `--only=<kind>`. A typo used to plan 0 calls and end quietly, so anything but
 * a known kind (including a bare `--only`) throws.
 */
export function parseOnly(argv: string[]): Kind | undefined {
  const arg = argv.find(a => a === '--only' || a.startsWith('--only='));
  if (arg === undefined) return undefined;
  const value = flagIn(argv, 'only');
  if (value && (KINDS as readonly string[]).includes(value)) return value as Kind;
  throw new Error(`--only must be one of: ${KINDS.join(', ')} (got ${JSON.stringify(value ?? '')}).`);
}

/**
 * `--approve` only posts the file's approvals. Flags that steer a generate run
 * would be silently ignored next to it, so combining them is an error, as is
 * `--approve` with no file (which used to fall through to a dry run).
 */
export function assertApproveAlone(argv: string[]): void {
  const approve = argv.find(a => a === '--approve' || a.startsWith('--approve='));
  if (approve === undefined) return;
  if (!flagIn(argv, 'approve')) throw new Error('--approve needs a file: --approve=<review file>.');
  const clash = ['go', 'only', 'force', 'review'].filter(name =>
    argv.some(a => a === `--${name}` || a.startsWith(`--${name}=`)));
  if (clash.length > 0) {
    throw new Error(`--approve cannot be combined with ${clash.map(n => `--${n}`).join(', ')}: it only approves the entries in the file, and those flags would be ignored.`);
  }
}

export type Call = {
  kind: Kind;
  lesson: string;
  body: Record<string, unknown>;
};

/**
 * Every lesson in a scope whose title grounds back to itself.
 *
 * The teacher picks by title, and the request carries the title. A title that
 * grounds to a different lesson would store a copy under the wrong lesson's
 * content (and, for explanations, the wrong lesson id), so it is skipped
 * rather than pre-generated wrong.
 */
function* lessonsIn(scope: Scope) {
  const grade = getPickerGrades().find(g => g.nameAr === scope.gradeNameAr);
  const subject = getPickerSubjects().find(s => s.name === scope.subjectName);
  if (!grade || !subject) throw new Error(`scope not found: ${JSON.stringify(scope)}`);

  const seen = new Set<string>();
  for (const unit of getUnitsForSubjectGrade(subject.id, grade.id)) {
    for (const lesson of getLessonsForUnit(unit.id)) {
      const topic = lesson.titleAr.trim();
      if (seen.has(topic) || resolveGeneratorGrounding(topic, 'ar').lesson?.id !== lesson.id) continue;
      seen.add(topic);
      yield { grade, subject, topic };
    }
  }
}

/** Every worksheet and lesson-plan call the default form would make. Exported for the test. */
export function plannedCalls(): Call[] {
  const calls: Call[] = [];
  for (const { grade, subject, topic } of lessonsIn(SCOPE)) {
    const common = { gradeName: grade.nameAr, subjectName: subject.name, topic, lang: 'ar' as const };
    const worksheetForm = {
      ...common, difficulty: 'easy' as const, numQuestions: 10,
      questionTypes: ['multiple_choice', 'short_answer'] as ('multiple_choice' | 'short_answer')[], includePriorReview: false,
    };
    calls.push({
      kind: 'worksheet', lesson: topic,
      body: buildWorksheetRequest(worksheetForm, resolveGeneratorGrounding(topic, 'ar')) as unknown as Record<string, unknown>,
    });
    const planForm = {
      ...common, durationMinutes: 45, teachingStyle: 'direct' as const,
      objectives: '', adaptations: '', priorTopicsNotes: '', includePriorReview: false,
    };
    calls.push({
      kind: 'lesson-plan', lesson: topic,
      body: buildLessonPlanRequest(planForm, groundLessonPlanTopic(planForm)) as unknown as Record<string, unknown>,
    });
  }
  return calls;
}

/** One `lesson-teaching` call per lesson — the body Slides Maker sends. Exported for the test. */
export function plannedTeachingCalls(): Call[] {
  const calls: Call[] = [];
  for (const scope of TEACHING_SCOPES) {
    for (const { grade, subject, topic } of lessonsIn(scope)) {
      calls.push({
        kind: 'lesson-teaching', lesson: topic,
        body: buildLessonTeachingRequest(
          { gradeName: grade.nameAr, subjectName: subject.name, topic, lang: 'ar' },
          resolveGeneratorGrounding(topic, 'ar'),
        ) as unknown as Record<string, unknown>,
      });
    }
  }
  return calls;
}

export type ReviewEntry = {
  variantId: string;
  lessonId: string;
  lesson: string;
  /** sha256 of `{ variantId, lessonId, content }` when the entry was written; `--approve` checks it. */
  contentHash: string;
  content: unknown;
};

/**
 * sha256 hex of what `--approve` acts on: the ids it posts and the text the
 * reviewer read. A canonical object (fixed key order), so editing either id in
 * the file is caught the same way as editing the text.
 */
export function hashContent(variantId: string, lessonId: string, content: unknown): string {
  return createHash('sha256').update(JSON.stringify({ variantId, lessonId, content })).digest('hex');
}

/** The server's rule for a variant id (`isUuid` in api-server `lib/lessonExplanation.ts`). */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Sort the parsed review file into what `--approve` may send and what makes it
 * refuse. `--approve` posts only `variantId`, so an entry whose text a reviewer
 * has changed would approve the ORIGINAL stored text — the edit would not be
 * applied and the reviewer would not know.
 */
export function verifyReviewEntries(entries: unknown): {
  approvable: ReviewEntry[];
  edited: ReviewEntry[];
  malformed: number;
} {
  if (!Array.isArray(entries)) return { approvable: [], edited: [], malformed: 1 };
  const approvable: ReviewEntry[] = [];
  const edited: ReviewEntry[] = [];
  let malformed = 0;
  for (const raw of entries as unknown[]) {
    const e = raw as Record<string, unknown> | null;
    if (
      !e || typeof e !== 'object' || Array.isArray(e) ||
      typeof e.variantId !== 'string' || !UUID.test(e.variantId) ||
      typeof e.lessonId !== 'string' || typeof e.contentHash !== 'string' || !('content' in e)
    ) { malformed++; continue; }
    (hashContent(e.variantId, e.lessonId, e.content) === e.contentHash ? approvable : edited).push(e as unknown as ReviewEntry);
  }
  return { approvable, edited, malformed };
}

/** A generate run must not silently replace a review file a person may be midway through. */
export function assertReviewFileFree(exists: boolean, forced: boolean, path: string): void {
  if (!exists || forced) return;
  throw new Error(
    `${path} already exists. Rerunning can serve a variant you already deleted from it, ` +
    `so it is not overwritten. Finish \`--approve=${path}\` (or delete the file) first, ` +
    `use \`--review=<other file>\` to write a second file, or \`--force\` to overwrite.`,
  );
}

function withoutTeacherNotes(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(withoutTeacherNotes);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([key]) => key !== 'teacherNote')
        .map(([key, inner]) => [key, withoutTeacherNotes(inner)]),
    );
  }
  return value;
}

/**
 * What a reviewer reads for one lesson: the pool variant that was served and
 * the text a student would see (no `teacherNote`, no response metadata).
 * Null when the response carried no `variantId` — it was never pooled, so
 * there is nothing a student could be served and nothing to approve.
 */
export function reviewEntry(call: Call, json: unknown): ReviewEntry | null {
  if (!json || typeof json !== 'object') return null;
  const content: Record<string, unknown> = { ...(json as Record<string, unknown>) };
  const variantId = content.variantId;
  delete content.variantId;
  delete content.sources;
  delete content.servedReason;
  const lessonId = call.body.lessonId;
  if (typeof variantId !== 'string' || !variantId.trim()) return null;
  if (typeof lessonId !== 'string' || !lessonId) return null;
  const shown = withoutTeacherNotes(content);
  return { variantId, lessonId, lesson: call.lesson, contentHash: hashContent(variantId, lessonId, shown), content: shown };
}

type Credentials = { base: string; token: string } | { base: string; email: string; password: string };

/**
 * An email and password, or `PREGEN_TOKEN` for an account that signs in with
 * Google and so has no password (copy `iqra_access_token` from the web app's
 * local storage; it lasts 15 minutes). A token wins when both are set.
 */
export function readCredentials(env: Record<string, string | undefined>): Credentials {
  const base = env.PREGEN_API_BASE?.replace(/\/$/, '');
  if (!base) throw new Error('set PREGEN_API_BASE');
  const token = env.PREGEN_TOKEN?.trim();
  if (token) return { base, token };
  const { PREGEN_EMAIL: email, PREGEN_PASSWORD: password } = env;
  if (!email) throw new Error('set PREGEN_EMAIL and PREGEN_PASSWORD, or PREGEN_TOKEN');
  if (!password) throw new Error('set PREGEN_PASSWORD (or PREGEN_TOKEN instead of the email and password)');
  return { base, email, password };
}

const apiEnv = () => readCredentials(process.env);

async function login(env: Credentials): Promise<string> {
  if ('token' in env) return env.token;
  const r = await fetch(`${env.base}/api/auth/login`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: env.email, password: env.password }),
  });
  if (!r.ok) throw new Error(`login failed: ${r.status}`);
  return ((await r.json()) as { accessToken: string }).accessToken;
}

/** A 401 mid-run: a password login can be repeated, a pasted token cannot. */
async function refreshed(env: Credentials): Promise<string> {
  if ('token' in env) throw new Error('PREGEN_TOKEN was refused (it expires after 15 minutes): copy a fresh one and run again (a lesson already stored answers fast and does not count against the cap).');
  return login(env);
}

function titles(entries: ReviewEntry[]): string {
  const shown = entries.slice(0, 3).map(e => e.lesson).join(', ');
  return entries.length > 3 ? `${shown}, …` : shown;
}

/** Mark the entries still in a reviewed file as fit for students. */
async function approve(file: string): Promise<void> {
  // Check the file before any network call: all or nothing.
  const { approvable, edited, malformed } = verifyReviewEntries(JSON.parse(readFileSync(file, 'utf8')));
  if (malformed > 0) {
    throw new Error(`${malformed} malformed in ${file}: an entry has no content/contentHash, a variantId that is not a uuid, or no lessonId (or the file is not a list of entries). Nothing was approved.`);
  }
  if (edited.length > 0) {
    throw new Error(`${edited.length} entr${edited.length === 1 ? 'y' : 'ies'} in ${file} ${edited.length === 1 ? 'was' : 'were'} edited (${titles(edited)}): edits are not applied; delete the entry instead of editing it. (If you did not edit it, the file may have been written by an older version of this script, whose hash did not cover the ids: regenerate it.) Nothing was approved.`);
  }
  const env = apiEnv();
  const token = await login(env);
  const ids = [...new Set(approvable.map(e => e.variantId))];
  let approved = 0;
  for (let i = 0; i < ids.length; i += 100) {
    const r = await fetch(`${env.base}/api/moderation/lesson-explanations/approve`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({ variantIds: ids.slice(i, i + 100) }),
    });
    if (!r.ok) throw new Error(`approve failed: ${r.status} (needs a system_admin login; a 400 means the file held an invalid variantId)`);
    const reply = (await r.json().catch(() => ({}))) as { approved?: unknown };
    approved += typeof reply.approved === 'number' && Number.isFinite(reply.approved) ? reply.approved : 0;
  }
  console.log(`approved ${approved} of ${ids.length} (rows already approved or retired are not counted).`);
}

async function main() {
  // Checked here, not at import, so the test can import this file.
  assertApproveAlone(args);
  const only = parseOnly(args);
  if (approvePath) { await approve(approvePath); return; }

  const all = [...plannedCalls(), ...plannedTeachingCalls()];
  const calls = only ? all.filter(c => c.kind === only) : all;
  const maxCalls = Math.floor(capUsd / EST_COST_PER_CALL_USD);
  const byKind = KINDS
    .map(k => `${calls.filter(c => c.kind === k).length} ${k}`).join(', ');
  console.log(`${calls.length} calls planned (${byKind}).`);
  console.log(`Worst case at $${EST_COST_PER_CALL_USD}/call: $${(calls.length * EST_COST_PER_CALL_USD).toFixed(2)}; cap $${capUsd} allows ${maxCalls} model calls.`);
  if (!go) { console.log('Dry run — nothing sent. Add --go to send.'); return; }
  // Only a run that will write the review file needs the file to be free.
  if (calls.some(c => c.kind === 'lesson-teaching')) assertReviewFileFree(existsSync(reviewPath), force, reviewPath);

  const env = apiEnv();
  const base = env.base;
  let token = await login(env);

  const review: ReviewEntry[] = [];
  let modelCalls = 0, poolHits = 0, failed = 0;
  for (const c of calls) {
    if (modelCalls >= maxCalls) { console.log(`cap reached after ${modelCalls} model calls; stopping.`); break; }
    const send = () => fetch(`${base}/api/generate/${c.kind}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify(c.body),
    });
    const t0 = Date.now();
    let r = await send();
    if (r.status === 401) { token = await refreshed(env); r = await send(); }
    // Two different 429s. The API allows 15 requests a minute per account, and a
    // pool hit answers in ~0.5 s, so a re-run trips it: wait as told and go on.
    // A quota/budget refusal carries a `code` and is final.
    let waits = 0;
    while (r.status === 429 && waits < 5) {
      const body = await r.clone().json().catch(() => ({})) as { code?: string };
      if (body.code === 'user_quota_exceeded' || body.code === 'budget_exceeded') break;
      const wait = Number(r.headers.get('retry-after') ?? 30) + 1;
      console.log(`rate limited — waiting ${wait}s`);
      await new Promise(res => setTimeout(res, wait * 1000));
      r = await send(); waits++;
    }
    const ms = Date.now() - t0;
    if (r.status === 429) { console.log(`429 (quota/budget) on ${c.kind} — stopping.`); break; }
    if (!r.ok) { failed++; console.log(`FAIL ${r.status} ${c.kind} ${c.lesson}`); continue; }
    if (ms < POOL_HIT_MS) { poolHits++; console.log(`stored already  ${ms}ms  ${c.kind}  ${c.lesson}`); }
    else { modelCalls++; console.log(`generated       ${ms}ms  ${c.kind}  ${c.lesson}`); }

    if (c.kind === 'lesson-teaching') {
      const entry = reviewEntry(c, await r.json().catch(() => null));
      if (entry) {
        review.push(entry);
        // Written as it goes, so a run that dies midway still leaves a file.
        writeFileSync(reviewPath, JSON.stringify(review, null, 2));
      } else {
        console.log(`  not pooled, nothing to review: ${c.lesson}`);
      }
    }
  }
  console.log(`done: ${modelCalls} generated (≤ $${(modelCalls * EST_COST_PER_CALL_USD).toFixed(2)}), ${poolHits} already stored, ${failed} failed.`);
  if (review.length > 0) {
    console.log(`${review.length} explanations to review in ${reviewPath}. Read it, delete the entries you reject, then: pnpm run pregenerate -- --approve=${reviewPath}`);
  }
}

// Only when run directly, so the test can import `plannedCalls` without a run.
if (process.argv[1]?.endsWith('pregenerate.ts')) {
  main().catch(e => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
}
