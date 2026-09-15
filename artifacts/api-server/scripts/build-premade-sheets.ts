/**
 * Build the pre-made practice-sheet manifest, once, offline.
 *
 * The resources tab serves frozen sheets: a teacher browsing one waits on
 * nothing, and two teachers opening the same sheet get the same paper. This
 * script is what produces them, and it is deliberately NOT wired into the
 * request path.
 *
 * Why it does not call POST /generate/worksheet
 *   That route is built to do the opposite of what is wanted here. It reads
 *   and writes the shared artifact pool and hands back whichever *variant* the
 *   caller has not seen yet — which is the right behaviour for a teacher
 *   pressing "regenerate" and exactly wrong for a manifest that must be
 *   reproducible. It also needs a database, a budget ledger and an
 *   authenticated user, none of which an offline build should require.
 *
 *   So this follows `provider-eval.ts`: the SAME shipped prompt
 *   (`worksheetPromptAr` from src/lib/prompts.ts) and the same configured
 *   model (`getGenerationModel`), called straight against the provider.
 *   Prompt drift is impossible because there is only one prompt builder.
 *
 * On lesson titles
 *   The prompt is phrased with the lesson TITLE because that is what it takes.
 *   That is safe here, and only here, because the title is never resolved back
 *   into a lesson: this script enumerates the catalog, so it already holds the
 *   `kbl-` id and writes that id into the manifest alongside the sheet.
 *   Nothing downstream re-derives a lesson from the title, which is the failure
 *   `searchKBSemantic` produces on 16 of 63 titles.
 *
 * On verification
 *   `verificationSource: 'symbolic'` is written only where SymPy returned
 *   `equivalent`. Everything else — an unsupported topic, an unreachable
 *   verifier, a key SymPy calls distinct — is `'none'`. There is deliberately
 *   no third value meaning "the model asserted it": that is what `'none'` is.
 *   A `distinct` verdict is *evidence against the key*, so it is called out in
 *   the report for a human to look at before the manifest is committed.
 *
 * Run (needs OPENAI_API_KEY; MATH_VERIFIER_URL for key checking):
 *   node --experimental-strip-types scripts/build-premade-sheets.ts
 *   node --experimental-strip-types scripts/build-premade-sheets.ts --only kbl-math-s1-nccd-u1_l4
 *   node --experimental-strip-types scripts/build-premade-sheets.ts --limit 1 --dry-run
 *
 * Without a reachable verifier every key lands as `'none'`, which is honest but
 * low-value; the report says so loudly rather than letting it pass unnoticed.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnvFile } from "node:process";
import OpenAI from "openai";

import { SYSTEM_AR, worksheetPromptAr } from "../src/lib/prompts.ts";
import { assertUsableGeneration, extractJSON } from "../src/lib/generationShape.ts";
import { getGenerationModel } from "../src/lib/aiBudget.ts";
import { PROMPT_VERSION } from "../src/lib/generationKey.ts";
import { relateAnswerKey } from "../src/lib/mathVerifierClient.ts";
import { classifyVerifiableTopic } from "@workspace/math-verify";
import {
  buildNccdSem1Catalog,
  type NccdKbLesson,
} from "@workspace/curriculum/catalogs/g10MathSem1";
import { buildNccdSem2Catalog } from "@workspace/curriculum/catalogs/g10MathSem2";

const HERE = dirname(fileURLToPath(import.meta.url));
const WORKSPACE_ROOT = join(HERE, "../../..");
const MANIFEST_PATH = join(
  WORKSPACE_ROOT,
  "lib/curriculum/src/data/premade_worksheets.json",
);

// Same env source as `scripts/dev.mjs`, so `pnpm premade:build` needs no flags
// and cannot read a different configuration than the server does.
const ENV_FILE = join(WORKSPACE_ROOT, ".env");
if (existsSync(ENV_FILE)) loadEnvFile(ENV_FILE);

const LEVELS = ["easy", "medium", "hard"] as const;
type Level = (typeof LEVELS)[number];

/**
 * Curriculum id → the subject NAME the generator is given.
 *
 * Not a default, and not inferred. `isMathContext` branches on this string, so
 * handing a chemistry lesson the word «الرياضيات» serves it maths questions
 * under a chemistry title. An unknown subject is refused rather than guessed.
 */
const SUBJECT_NAME_AR: Record<string, string> = { mathematics: "الرياضيات" };
const GRADE_NAME_AR: Record<string, string> = { "grade-10": "الصف العاشر" };

/** Questions per sheet. Matches the generator screen's middle option. */
const NUM_QUESTIONS = 10;

/** The mix a practice sheet wants: something to work, not only to recall. */
const QUESTION_TYPES = ["short_answer", "multiple_choice", "word_problem"];

const GENERATION_TOKENS = 8000;

interface KeyVerification {
  num: number;
  verificationSource: "symbolic" | "none";
}

interface PremadeWorksheet {
  id: string;
  lessonId: string;
  gradeId: string;
  subjectId: string;
  level: Level;
  titleAr: string;
  titleEn: string;
  content: {
    title: string;
    instructions: string;
    sections: Array<{ type: string; title: string; questions: Array<Record<string, unknown>> }>;
    answerKey: Array<{ num: number; answer: string }>;
  };
  keyVerification: KeyVerification[];
  generatedAt: string;
  promptVersion: string;
  model: string;
}

interface Manifest {
  version: number;
  sheets: PremadeWorksheet[];
}

// ─── CLI ─────────────────────────────────────────────────────────────────────

interface Args {
  gradeId: string;
  subjectId: string;
  level: Level;
  only: string[];
  limit: number | null;
  dryRun: boolean;
}

function parseArgs(argv: string[]): Args {
  const args: Args = {
    gradeId: "grade-10",
    subjectId: "mathematics",
    level: "medium",
    only: [],
    limit: null,
    dryRun: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i];
    const value = argv[i + 1];
    switch (flag) {
      case "--grade":
        args.gradeId = req(flag, value);
        i += 1;
        break;
      case "--subject":
        args.subjectId = req(flag, value);
        i += 1;
        break;
      case "--level": {
        const level = req(flag, value);
        if (!(LEVELS as readonly string[]).includes(level)) {
          fail(`--level must be one of ${LEVELS.join(", ")}, got ${level}`);
        }
        args.level = level as Level;
        i += 1;
        break;
      }
      case "--only":
        args.only.push(req(flag, value));
        i += 1;
        break;
      case "--limit":
        args.limit = Number(req(flag, value));
        if (!Number.isInteger(args.limit) || args.limit < 1) fail("--limit needs a positive integer");
        i += 1;
        break;
      case "--dry-run":
        args.dryRun = true;
        break;
      default:
        fail(`unknown flag ${flag}`);
    }
  }
  return args;
}

function req(flag: string, value: string | undefined): string {
  if (!value || value.startsWith("--")) fail(`${flag} needs a value`);
  return value!;
}

function fail(message: string): never {
  console.error(`build-premade-sheets: ${message}`);
  process.exit(1);
}

// ─── Lessons ─────────────────────────────────────────────────────────────────

/**
 * Every Grade 10 maths lesson, both semesters.
 *
 * `order === 0` entries are the GeoGebra lab lessons — an activity to run, not
 * a lesson to set questions on, so they get no sheet.
 */
function lessonsFor(gradeId: string, subjectId: string): NccdKbLesson[] {
  if (gradeId !== "grade-10" || subjectId !== "mathematics") {
    fail(
      `only grade-10 mathematics is published today (asked for ${gradeId}/${subjectId}). ` +
        `Chemistry needs its question bank first — see the plan's out-of-scope note.`,
    );
  }
  return [...buildNccdSem1Catalog().lessons, ...buildNccdSem2Catalog().lessons].filter(
    lesson => lesson.order !== 0,
  );
}

// ─── Generation ──────────────────────────────────────────────────────────────

function requestFor(lesson: NccdKbLesson, args: Args) {
  return {
    grade: GRADE_NAME_AR[args.gradeId],
    subject: SUBJECT_NAME_AR[args.subjectId],
    topic: lesson.titleAr,
    language: "arabic" as const,
    difficulty: args.level,
    numQuestions: NUM_QUESTIONS,
    questionTypes: QUESTION_TYPES,
    // The textbook context the shipped route would attach via withGrounding.
    // Taken from the lesson we already hold, so it cannot point at another one.
    additionalContext: [lesson.summaryAr, ...(lesson.keyConceptsAr ?? [])]
      .filter(Boolean)
      .join("\n"),
  };
}

async function generateSheet(
  client: OpenAI,
  model: string,
  lesson: NccdKbLesson,
  args: Args,
): Promise<PremadeWorksheet["content"]> {
  const body = requestFor(lesson, args);
  const completion = await client.chat.completions.create({
    model,
    max_completion_tokens: GENERATION_TOKENS,
    messages: [
      { role: "system", content: SYSTEM_AR },
      { role: "user", content: worksheetPromptAr(body) },
    ],
  });
  const raw = completion.choices[0]?.message?.content ?? "";
  const parsed = extractJSON(raw);
  // Same gate the route applies, so a truncated or partial object is refused
  // here rather than rendering as an empty worksheet on a teacher's screen.
  assertUsableGeneration("worksheet", parsed);
  return parsed as PremadeWorksheet["content"];
}

// ─── Validation ──────────────────────────────────────────────────────────────

/** Fail closed: a malformed sheet must never reach the manifest. */
function validate(id: string, content: PremadeWorksheet["content"]): string[] {
  const problems: string[] = [];
  const questionCount = content.sections.reduce(
    (n, section) => n + (section.questions?.length ?? 0),
    0,
  );
  if (questionCount === 0) problems.push("no questions");

  const nums = content.answerKey.map(k => k.num).sort((a, b) => a - b);
  const expected = Array.from({ length: questionCount }, (_, i) => i + 1);
  if (nums.length !== expected.length || nums.some((n, i) => n !== expected[i])) {
    problems.push(
      `answer key does not line up: ${nums.length} keys for ${questionCount} questions`,
    );
  }
  return problems.map(p => `${id}: ${p}`);
}

// ─── Key verification ────────────────────────────────────────────────────────

interface VerifyTally {
  symbolic: number;
  unsupported: number;
  distinct: string[];
  unreachable: boolean;
}

/**
 * Ask SymPy about each key, through the same gate the app uses.
 *
 * `classifyVerifiableTopic` returning null means nothing can be honestly
 * claimed — that is a `'none'`, not a failure.
 */
async function verifyKeys(
  content: PremadeWorksheet["content"],
): Promise<{ records: KeyVerification[]; tally: VerifyTally }> {
  const questions = content.sections.flatMap(section => section.questions ?? []);
  const records: KeyVerification[] = [];
  const tally: VerifyTally = { symbolic: 0, unsupported: 0, distinct: [], unreachable: false };

  for (const entry of content.answerKey) {
    const question = questions[entry.num - 1] as { text?: string } | undefined;
    const classified = question?.text ? classifyVerifiableTopic(question.text) : null;
    if (!classified) {
      tally.unsupported += 1;
      records.push({ num: entry.num, verificationSource: "none" });
      continue;
    }
    // Once the verifier is known to be down, stop waiting on it per question.
    if (tally.unreachable) {
      records.push({ num: entry.num, verificationSource: "none" });
      continue;
    }
    const result = await relateAnswerKey(classified.topic, classified.payload, entry.answer);
    if (result.relation === "equivalent") {
      tally.symbolic += 1;
      records.push({ num: entry.num, verificationSource: "symbolic" });
      continue;
    }
    if (result.relation === "distinct") tally.distinct.push(`q${entry.num}`);
    if (result.relation === "error") tally.unreachable = true;
    records.push({ num: entry.num, verificationSource: "none" });
  }
  return { records, tally };
}

// ─── Manifest ────────────────────────────────────────────────────────────────

function readManifest(): Manifest {
  const raw = JSON.parse(readFileSync(MANIFEST_PATH, "utf8")) as Manifest;
  return { version: raw.version ?? 1, sheets: raw.sheets ?? [] };
}

/** Upsert by id and sort, so a re-run produces a reviewable diff. */
function writeManifest(manifest: Manifest, produced: PremadeWorksheet[]): void {
  const byId = new Map(manifest.sheets.map(sheet => [sheet.id, sheet]));
  for (const sheet of produced) byId.set(sheet.id, sheet);
  const sheets = [...byId.values()].sort((a, b) => a.id.localeCompare(b.id));
  writeFileSync(MANIFEST_PATH, `${JSON.stringify({ ...manifest, sheets }, null, 2)}\n`, "utf8");
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (!process.env.OPENAI_API_KEY) fail("OPENAI_API_KEY is not set");
  if (!process.env.MATH_VERIFIER_URL) {
    console.warn(
      "build-premade-sheets: MATH_VERIFIER_URL is not set — every key will be recorded as " +
        "'none'. That is honest, but the sheets ship without a single verified answer.",
    );
  }

  const model = getGenerationModel();
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  let lessons = lessonsFor(args.gradeId, args.subjectId);
  if (args.only.length) {
    const wanted = new Set(args.only);
    lessons = lessons.filter(lesson => wanted.has(lesson.id));
    const missing = [...wanted].filter(id => !lessons.some(lesson => lesson.id === id));
    if (missing.length) fail(`no such lesson: ${missing.join(", ")}`);
  }
  if (args.limit !== null) lessons = lessons.slice(0, args.limit);

  console.log(
    `build-premade-sheets: ${lessons.length} lesson(s), level ${args.level}, model ${model}\n`,
  );

  const produced: PremadeWorksheet[] = [];
  const problems: string[] = [];
  let verifierEverDown = false;

  for (const [index, lesson] of lessons.entries()) {
    const id = `pw-${lesson.id}-${args.level}`;
    const position = `[${index + 1}/${lessons.length}]`;
    try {
      const content = await generateSheet(client, model, lesson, args);
      const sheetProblems = validate(id, content);
      if (sheetProblems.length) {
        problems.push(...sheetProblems);
        console.log(`${position} ${id}  REFUSED — ${sheetProblems.join("; ")}`);
        continue;
      }
      const { records, tally } = await verifyKeys(content);
      if (tally.unreachable) verifierEverDown = true;
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
        promptVersion: PROMPT_VERSION,
        model,
      });
      console.log(
        `${position} ${id}  ${records.length} questions, ` +
          `${tally.symbolic} verified, ${tally.unsupported} unsupported` +
          (tally.distinct.length ? `, DISTINCT: ${tally.distinct.join(",")}` : "") +
          (tally.unreachable ? ", verifier unreachable" : ""),
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      problems.push(`${id}: ${message}`);
      console.log(`${position} ${id}  FAILED — ${message}`);
    }
  }

  const totalKeys = produced.reduce((n, sheet) => n + sheet.keyVerification.length, 0);
  const verifiedKeys = produced.reduce(
    (n, sheet) =>
      n + sheet.keyVerification.filter(k => k.verificationSource === "symbolic").length,
    0,
  );
  console.log(
    `\nproduced ${produced.length}/${lessons.length} sheets; ` +
      `${verifiedKeys}/${totalKeys} keys verified symbolically`,
  );
  if (verifierEverDown) {
    console.log(
      "the verifier was unreachable during this run — keys after that point are 'none' " +
        "because nothing checked them, not because they are wrong",
    );
  }
  if (problems.length) {
    console.log(`\n${problems.length} problem(s):`);
    for (const problem of problems) console.log(`  ${problem}`);
  }

  if (args.dryRun) {
    console.log("\n--dry-run: manifest not written");
  } else if (produced.length) {
    writeManifest(readManifest(), produced);
    console.log(`\nwrote ${MANIFEST_PATH}`);
    console.log("review the diff before committing — this is the quality gate");
  }

  // A malformed or failed sheet is a non-zero exit so a scripted run cannot
  // quietly publish a short manifest.
  //
  // `exitCode` rather than `process.exit()`: the provider client can still hold
  // an open socket when a request failed, and exiting hard through it aborts
  // libuv on Windows ("Assertion failed: !(handle->flags & UV_HANDLE_CLOSING)")
  // — which buries the report that just explained what went wrong.
  if (problems.length) process.exitCode = 1;
}

await main();
