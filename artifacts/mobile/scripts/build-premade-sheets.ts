/**
 * Build the pre-made practice-sheet manifest, once, offline.
 *
 * The resources tab serves frozen sheets: a teacher browsing one waits on
 * nothing, two teachers opening the same sheet get the same paper, and the
 * browse path makes no model call and no network request at all. This script is
 * what produces them.
 *
 * Why the offline generator rather than the live model
 *   `MockAIService` is the template-and-bank generator the app already falls
 *   back to, and for a manifest that is a feature rather than a compromise: it
 *   is free, it is instant, and it is deterministic, so re-running this
 *   produces a reviewable diff instead of 33 freshly-worded sheets. Its maths
 *   items come from the concrete bank (`lib/math-practice`) with answers
 *   computed alongside the question, not asserted afterwards.
 *
 *   The cost is honest: templates repeat. Across 33 lessons the sheets share
 *   question shapes, and they read as machine-made. Regenerating with the live
 *   model later is a re-run of this script against a different service — the
 *   manifest upserts by id, so it replaces sheets in place.
 *
 * Why not POST /generate/worksheet
 *   That route reads and writes the shared artifact pool and hands back
 *   whichever variant the caller has not seen yet, which is right for a teacher
 *   pressing "regenerate" and exactly wrong for a manifest that must be
 *   reproducible. It also wants a database, a budget ledger and a signed-in
 *   user, none of which an offline build should need.
 *
 * On lesson titles
 *   The generator is asked for a topic by TITLE, because that is what it takes.
 *   That is safe here and only here: this script enumerates the catalog, so it
 *   already holds the `kbl-` id and writes that id into the manifest. Nothing
 *   downstream re-derives a lesson from the title, which is the failure
 *   `searchKBSemantic` produces on 16 of 63 titles.
 *
 * On verification
 *   Every key is recorded `'bank'`: the template wrote the question and its
 *   answer together, and no verifier saw either. That is not `'symbolic'` —
 *   nothing proved it — and not `'none'` — it was computed, not guessed. The
 *   report also counts how many questions SymPy *could* prove
 *   (`classifyVerifiableTopic`), which is what a later verified pass would
 *   upgrade; counting is not claiming, so nothing here earns a badge.
 *
 * Run (no API key, no network, no services):
 *   pnpm --filter @workspace/mobile run premade:build
 *   pnpm --filter @workspace/mobile run premade:build -- --only kbl-math-s1-nccd-u1_l4
 *   pnpm --filter @workspace/mobile run premade:build -- --limit 2 --dry-run
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { MockAIService } from '../services/ai/generators.ts';
import { classifyVerifiableTopic } from '../services/ai/verifyMathGuards.ts';
import type { WorksheetOutput } from '../services/ai/AIService.ts';
import {
  buildNccdSem1Catalog,
  type NccdKbLesson,
} from '@workspace/curriculum/catalogs/g10MathSem1';
import { buildNccdSem2Catalog } from '@workspace/curriculum/catalogs/g10MathSem2';
import type {
  KeyVerification,
  PremadeLevel,
  PremadeWorksheet,
} from '@workspace/curriculum/premade';

const HERE = dirname(fileURLToPath(import.meta.url));
const WORKSPACE_ROOT = join(HERE, '../../..');
const MANIFEST_PATH = join(
  WORKSPACE_ROOT,
  'lib/curriculum/src/data/premade_worksheets.json',
);

const LEVELS: readonly PremadeLevel[] = ['easy', 'medium', 'hard'];

/**
 * Curriculum id → the subject NAME the generator is given.
 *
 * Not a default and not inferred. `isMathContext` branches on this string, so
 * handing a chemistry lesson «الرياضيات» serves it maths questions under a
 * chemistry title. An unknown subject is refused rather than guessed.
 */
const SUBJECT_NAME_AR: Record<string, string> = { mathematics: 'الرياضيات' };
const GRADE_NAME_AR: Record<string, string> = { 'grade-10': 'الصف العاشر' };

/**
 * Lessons held back because `detectMathFamily` picks the wrong branch of maths
 * for them (`lib/math-practice/src/index.ts:152`).
 *
 * That function is an ordered list of regexes, and a broad early rule swallows
 * the specific later one. Trig ratios are taught on the unit circle, so `دائر`
 * matches before `مثلث`; vector addition is taught with the triangle rule, so
 * `مثلث` matches before `متجه`; a scatter-plot lesson says "graphically", so
 * the graph-system rule matches before `إحصاء`. The sheets that come out are
 * structurally perfect and about the wrong subject — circle-area questions on
 * a trigonometry sheet — which is worse than no sheet at all on a shelf
 * labelled "ready-made".
 *
 * Verified by reading the generated output, not inferred: each entry below had
 * its questions checked by hand. «حل نظام مكوَّن من معادلة خطية ومعادلة
 * تربيعية» detects as `system_graph` too and is deliberately NOT here — for
 * that lesson, line-and-parabola intersection problems are exactly right.
 *
 * Fixing the detector is its own change: it reorders a heuristic that selects
 * questions for every lesson in every grade. Remove an entry here once that
 * lands and re-run with `--only`.
 */
const HELD_BACK: Record<string, string> = {
  'kbl-math-s1-nccd-u3_l1': 'النسب المثلثية detects as circle — serves circle area/circumference',
  'kbl-math-s2-nccd-u5_l5': 'المتتاليات detects as circle — serves circle questions',
  'kbl-math-s2-nccd-u6_l1': 'تقدير ميل المنحنى detects as system_graph — serves line intersections',
  'kbl-math-s2-nccd-u7_l2': 'جمع المتجهات وطرحها detects as trig — serves sin/cos values',
  'kbl-math-s2-nccd-u8_l1': 'أشكال الانتشار detects as system_graph — serves system solving',
};

/** Questions per sheet — the generator screen's middle option. */
const NUM_QUESTIONS = 10;

/** A practice sheet wants something to work, not only to recall. */
const QUESTION_TYPES = ['short_answer', 'multiple_choice', 'word_problem'];

interface Manifest {
  version: number;
  sheets: PremadeWorksheet[];
}

interface Args {
  gradeId: string;
  subjectId: string;
  level: PremadeLevel;
  only: string[];
  limit: number | null;
  dryRun: boolean;
}

function fail(message: string): never {
  console.error(`build-premade-sheets: ${message}`);
  process.exit(1);
}

function need(flag: string, value: string | undefined): string {
  if (!value || value.startsWith('--')) fail(`${flag} needs a value`);
  return value;
}

function parseArgs(argv: string[]): Args {
  const args: Args = {
    gradeId: 'grade-10',
    subjectId: 'mathematics',
    level: 'medium',
    only: [],
    limit: null,
    dryRun: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i]!;
    const value = argv[i + 1];
    switch (flag) {
      case '--grade':
        args.gradeId = need(flag, value);
        i += 1;
        break;
      case '--subject':
        args.subjectId = need(flag, value);
        i += 1;
        break;
      case '--level': {
        const level = need(flag, value);
        if (!(LEVELS as readonly string[]).includes(level)) {
          fail(`--level must be one of ${LEVELS.join(', ')}, got ${level}`);
        }
        args.level = level as PremadeLevel;
        i += 1;
        break;
      }
      case '--only':
        args.only.push(need(flag, value));
        i += 1;
        break;
      case '--limit': {
        const limit = Number(need(flag, value));
        if (!Number.isInteger(limit) || limit < 1) fail('--limit needs a positive integer');
        args.limit = limit;
        i += 1;
        break;
      }
      case '--dry-run':
        args.dryRun = true;
        break;
      default:
        fail(`unknown flag ${flag}`);
    }
  }
  return args;
}

/**
 * Every Grade 10 maths lesson, both semesters.
 *
 * `order === 0` entries are the GeoGebra lab lessons — an activity to run, not
 * a lesson to set questions on — so they get no sheet. That is why this yields
 * 33 and not the grade's 36.
 */
function lessonsFor(gradeId: string, subjectId: string): NccdKbLesson[] {
  if (!SUBJECT_NAME_AR[subjectId] || !GRADE_NAME_AR[gradeId]) {
    fail(
      `only grade-10 mathematics is published today (asked for ${gradeId}/${subjectId}). ` +
        'Chemistry needs its question bank first.',
    );
  }
  return [...buildNccdSem1Catalog().lessons, ...buildNccdSem2Catalog().lessons].filter(
    lesson => lesson.order !== 0,
  );
}

/** Fail closed: a malformed sheet must never reach the manifest. */
function problemsWith(id: string, content: WorksheetOutput): string[] {
  const problems: string[] = [];
  const questionCount = content.sections.reduce(
    (n, section) => n + (section.questions?.length ?? 0),
    0,
  );
  if (questionCount === 0) problems.push('no questions');

  const nums = content.answerKey.map(k => k.num).sort((a, b) => a - b);
  const expected = Array.from({ length: questionCount }, (_, i) => i + 1);
  if (nums.length !== expected.length || nums.some((n, i) => n !== expected[i])) {
    problems.push(`answer key does not line up: ${nums.length} keys for ${questionCount} questions`);
  }
  if (content.answerKey.some(k => !k.answer.trim())) problems.push('an answer key is empty');
  return problems.map(problem => `${id}: ${problem}`);
}

/**
 * Record how each key was established, and count what SymPy could later prove.
 *
 * Counting is not claiming: `provable` is review information about a future
 * verified pass, and never becomes a `verificationSource`.
 */
function verificationFor(content: WorksheetOutput): {
  records: KeyVerification[];
  provable: number;
} {
  const questions = content.sections.flatMap(section => section.questions ?? []);
  let provable = 0;
  const records = content.answerKey.map(entry => {
    const question = questions[entry.num - 1];
    if (question?.text && classifyVerifiableTopic(question.text)) provable += 1;
    return { num: entry.num, verificationSource: 'bank' as const };
  });
  return { records, provable };
}

function readManifest(): Manifest {
  if (!existsSync(MANIFEST_PATH)) return { version: 1, sheets: [] };
  const raw = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8')) as Manifest;
  return { version: raw.version ?? 1, sheets: raw.sheets ?? [] };
}

/**
 * Upsert by id and sort, so a re-run produces a reviewable diff.
 *
 * Also drops any sheet whose lesson is now held back. Without that, adding an
 * entry to `HELD_BACK` would leave the bad sheet sitting in the manifest from
 * an earlier run — held back in the code and still shipped in the data.
 */
function writeManifest(manifest: Manifest, produced: PremadeWorksheet[]): void {
  const byId = new Map(manifest.sheets.map(sheet => [sheet.id, sheet]));
  for (const sheet of produced) byId.set(sheet.id, sheet);
  const sheets = [...byId.values()]
    .filter(sheet => !HELD_BACK[sheet.lessonId])
    .sort((a, b) => a.id.localeCompare(b.id));
  writeFileSync(MANIFEST_PATH, `${JSON.stringify({ ...manifest, sheets }, null, 2)}\n`, 'utf8');
}

async function main(): Promise<void> {
  // pnpm forwards the `--` separator through as a literal argument. Dropped
  // the same way `scripts/dev.mjs` drops it.
  const args = parseArgs(process.argv.slice(2).filter(arg => arg !== '--'));
  const service = new MockAIService();

  let lessons = lessonsFor(args.gradeId, args.subjectId);
  if (args.only.length) {
    const wanted = new Set(args.only);
    const missing = args.only.filter(id => !lessons.some(lesson => lesson.id === id));
    if (missing.length) fail(`no such lesson: ${missing.join(', ')}`);
    lessons = lessons.filter(lesson => wanted.has(lesson.id));
  }
  if (args.limit !== null) lessons = lessons.slice(0, args.limit);

  const held = lessons.filter(lesson => HELD_BACK[lesson.id]);
  lessons = lessons.filter(lesson => !HELD_BACK[lesson.id]);
  if (held.length) {
    console.log(`held back ${held.length} lesson(s) — wrong maths family detected:`);
    for (const lesson of held) console.log(`  ${lesson.id}  ${HELD_BACK[lesson.id]}`);
    console.log('');
  }

  console.log(
    `build-premade-sheets: ${lessons.length} lesson(s), level ${args.level}, ` +
      'offline template generator (no key, no network)\n',
  );

  const produced: PremadeWorksheet[] = [];
  const problems: string[] = [];
  let totalProvable = 0;

  for (const [index, lesson] of lessons.entries()) {
    const id = `pw-${lesson.id}-${args.level}`;
    const position = `[${index + 1}/${lessons.length}]`;
    try {
      const content = await service.generateWorksheet({
        grade: GRADE_NAME_AR[args.gradeId]!,
        subject: SUBJECT_NAME_AR[args.subjectId]!,
        topic: lesson.titleAr,
        // The id, not just the title. Four of these 33 titles exist verbatim
        // elsewhere in the curriculum — «جمع المتجهات وطرحها» is also a Grade
        // 10 physics lesson — so grounding by title alone built maths sheets
        // from another grade's or another subject's key terms.
        lessonId: lesson.id,
        unitId: lesson.unitId,
        language: 'arabic',
        difficulty: args.level,
        numQuestions: NUM_QUESTIONS,
        questionTypes: QUESTION_TYPES,
        contextSource: 'curriculum',
      } as never);

      const sheetProblems = problemsWith(id, content);
      if (sheetProblems.length) {
        problems.push(...sheetProblems);
        console.log(`${position} ${id}  REFUSED — ${sheetProblems.join('; ')}`);
        continue;
      }

      const { records, provable } = verificationFor(content);
      totalProvable += provable;
      produced.push({
        id,
        lessonId: lesson.id,
        gradeId: args.gradeId,
        subjectId: args.subjectId,
        level: args.level,
        titleAr: lesson.titleAr,
        titleEn: lesson.titleEn,
        content,
        keyVerification: records,
        generatedAt: new Date().toISOString(),
        promptVersion: 'offline-template',
        model: 'MockAIService',
      });
      console.log(
        `${position} ${id}  ${records.length} questions, ${provable} SymPy-provable later`,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      problems.push(`${id}: ${message}`);
      console.log(`${position} ${id}  FAILED — ${message}`);
    }
  }

  const totalKeys = produced.reduce((n, sheet) => n + sheet.keyVerification.length, 0);
  console.log(
    `\nproduced ${produced.length}/${lessons.length} sheets, ${totalKeys} keys — ` +
      `all recorded 'bank'; ${totalProvable} of them a later SymPy pass could prove`,
  );
  if (problems.length) {
    console.log(`\n${problems.length} problem(s):`);
    for (const problem of problems) console.log(`  ${problem}`);
  }

  if (args.dryRun) {
    console.log('\n--dry-run: manifest not written');
  } else if (produced.length) {
    writeManifest(readManifest(), produced);
    console.log(`\nwrote ${MANIFEST_PATH}`);
    console.log('review the diff before committing — this is the quality gate');
  }

  if (problems.length) process.exitCode = 1;
}

await main();
