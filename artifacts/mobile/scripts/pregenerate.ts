/**
 * Pre-generate default worksheets and lesson plans into the shared pool.
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
 *     pnpm run pregenerate -- --go [--cap=1]  sends them, stops at the cap
 *
 * Use a dedicated teacher account: every call counts against that account's
 * AI quota, not a real teacher's. Re-running is safe and cheap — a call the
 * pool already holds returns fast and is not counted against the cap.
 *
 * ponytail: grade 10 maths, the default form only. Other grades/subjects are
 * the `SCOPE` line; other option combinations only if teachers turn out to
 * change the defaults a lot (the pool's hit rate says).
 */
import { getPickerGrades, getPickerSubjects } from '../services/curriculumData.ts';
import { getLessonsForUnit, getUnitsForSubjectGrade } from '../services/knowledgeBase.ts';
import { resolveGeneratorGrounding } from '../services/kbContext.ts';
import {
  buildLessonPlanRequest,
  buildWorksheetRequest,
  groundLessonPlanTopic,
} from '../services/generatorRequests.ts';

const SCOPE = { gradeNameAr: 'الصف العاشر', subjectName: 'Mathematics' };
/** Conservative: gpt-4o-mini is nearer $0.003 for one of these. */
const EST_COST_PER_CALL_USD = 0.01;
/** Faster than any model call; the pool answered. */
const POOL_HIT_MS = 3000;

const args = process.argv.slice(2);
const go = args.includes('--go');
const capUsd = Number(args.find(a => a.startsWith('--cap='))?.split('=')[1] ?? 1);

export type Call = { kind: 'worksheet' | 'lesson-plan'; lesson: string; body: Record<string, unknown> };

/** Every call the default form would make for this scope. Exported for the test. */
export function plannedCalls(): Call[] {
  const grade = getPickerGrades().find(g => g.nameAr === SCOPE.gradeNameAr);
  const subject = getPickerSubjects().find(s => s.name === SCOPE.subjectName);
  if (!grade || !subject) throw new Error(`scope not found: ${JSON.stringify(SCOPE)}`);

  const calls: Call[] = [];
  const seen = new Set<string>();
  for (const unit of getUnitsForSubjectGrade(subject.id, grade.id)) {
    for (const lesson of getLessonsForUnit(unit.id)) {
      const topic = lesson.titleAr.trim();
      // The teacher picks by title, and the request carries the title. A title
      // that grounds to a different lesson would store a copy under the wrong
      // lesson's content, so skip it rather than pre-generate the wrong thing.
      if (seen.has(topic) || resolveGeneratorGrounding(topic, 'ar').lesson?.id !== lesson.id) continue;
      seen.add(topic);

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
  }
  return calls;
}

async function main() {
  const calls = plannedCalls();
  const maxCalls = Math.floor(capUsd / EST_COST_PER_CALL_USD);
  console.log(`${calls.length} calls planned (${SCOPE.gradeNameAr} / ${SCOPE.subjectName}).`);
  console.log(`Worst case at $${EST_COST_PER_CALL_USD}/call: $${(calls.length * EST_COST_PER_CALL_USD).toFixed(2)}; cap $${capUsd} allows ${maxCalls} model calls.`);
  if (!go) { console.log('Dry run — nothing sent. Add --go to send.'); return; }

  const base = process.env.PREGEN_API_BASE?.replace(/\/$/, '');
  const email = process.env.PREGEN_EMAIL;
  const password = process.env.PREGEN_PASSWORD;
  if (!base || !email || !password) throw new Error('set PREGEN_API_BASE, PREGEN_EMAIL and PREGEN_PASSWORD');

  const login = async (): Promise<string> => {
    const r = await fetch(`${base}/api/auth/login`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!r.ok) throw new Error(`login failed: ${r.status}`);
    return ((await r.json()) as { accessToken: string }).accessToken;
  };
  let token = await login();

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
    if (r.status === 401) { token = await login(); r = await send(); }
    const ms = Date.now() - t0;
    if (r.status === 429) { console.log(`429 (quota/budget) on ${c.kind} — stopping.`); break; }
    if (!r.ok) { failed++; console.log(`FAIL ${r.status} ${c.kind} ${c.lesson}`); continue; }
    if (ms < POOL_HIT_MS) { poolHits++; console.log(`stored already  ${ms}ms  ${c.kind}  ${c.lesson}`); }
    else { modelCalls++; console.log(`generated       ${ms}ms  ${c.kind}  ${c.lesson}`); }
  }
  console.log(`done: ${modelCalls} generated (≤ $${(modelCalls * EST_COST_PER_CALL_USD).toFixed(2)}), ${poolHits} already stored, ${failed} failed.`);
}

// Only when run directly, so the test can import `plannedCalls` without a run.
if (process.argv[1]?.endsWith('pregenerate.ts')) {
  main().catch(e => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
}
