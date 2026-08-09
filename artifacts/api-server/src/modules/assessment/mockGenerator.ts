/**
 * Deterministic evaluation generator — the DEMO_MODE path.
 *
 * What it will and will not do is the whole design. It builds questions from
 * real curriculum data: the objective's own wording supplies the subject, the
 * lesson's vocabulary supplies the key concepts a grader checks meaning
 * against. It does **not** invent subject content, which rules out four of the
 * eight types: multiple choice needs plausible distractors, true/false needs a
 * statement that is definitely true or false, matching needs real pairs, and
 * fill-in-the-blank needs a fact with a known missing word. Producing those
 * from a lesson title means writing plausible-looking questions that may not be
 * on the syllabus and may not have correct keys.
 *
 * The app already takes this line elsewhere — the quick-check generator falls
 * back to open questions "with no fabricated options" for non-maths topics, and
 * there is a test holding it there. This does the same, and reports the types
 * it declined so the teacher sees a shortfall rather than silently getting a
 * different evaluation than they asked for.
 *
 * Cognitive level comes from the *question*, not the objective. No objective in
 * the corpus is Remember and only 9 of 118 are Analyze or above, so inheriting
 * would make a four-competency breakdown impossible. Asking a recall question
 * about an Apply-level objective is ordinary practice and is what makes the
 * spread achievable.
 */
import {
  getLessonById,
  type CurriculumObjective,
} from "@workspace/curriculum";
import type { Difficulty, QuestionType } from "@workspace/db";
import {
  allocateQuestions,
  COMPETENCY_KEYS,
  MARKS_BY_COMPETENCY,
  type CompetencyKey,
} from "./competency";
import { mockableTypes, QUESTION_TYPES } from "./questionTypes";

export interface GeneratedQuestion {
  type: QuestionType;
  body: Record<string, unknown>;
  expectedAnswer: Record<string, unknown>;
  rubric: Record<string, unknown> | null;
  objectiveId: string;
  competencyKey: CompetencyKey;
  difficulty: Difficulty;
  marks: number;
  skill: string | null;
  gradingMode: string;
  aiMetadata: Record<string, unknown>;
}

export interface GenerationRequest {
  objectives: CurriculumObjective[];
  assessmentTypes: QuestionType[];
  count: number;
  difficulty: Difficulty;
}

export interface GenerationResult {
  questions: GeneratedQuestion[];
  /** Requested types this generator will not fabricate. */
  unavailableTypes: QuestionType[];
  /** Set when fewer questions were produced than asked for. */
  shortfall: number;
  notes: string[];
}

/** Arabic stems by cognitive demand. The verb sets the level, as in the corpus. */
const STEMS: Record<CompetencyKey, (topic: string) => string> = {
  knowledge: t => `اذكر المفاهيم والمصطلحات الأساسية المتعلقة بـ: ${t}`,
  understanding: t => `اشرح بأسلوبك الخاص ما المقصود بـ: ${t}`,
  application: t => `طبّق ما تعلّمته: اعرض خطوات ${t}، مستعينًا بمثال من عندك.`,
  critical_thinking: t =>
    `حلّل الآتي: ${t}. بيّن متى يصلح هذا الأسلوب ومتى لا يصلح، مع تعليل إجابتك.`,
};

const MODEL_ANSWER: Record<CompetencyKey, (topic: string) => string> = {
  knowledge: t => `تشمل الإجابة الكاملة تسمية المفاهيم والمصطلحات الواردة في: ${t}`,
  understanding: t => `تشمل الإجابة الكاملة شرحًا بلغة الطالب لمعنى: ${t}`,
  application: t => `تشمل الإجابة الكاملة خطوات مرتّبة لتنفيذ: ${t}، مع مثال صحيح.`,
  critical_thinking: t =>
    `تشمل الإجابة الكاملة تحليل: ${t}، مع تعليل واضح لحدود استعماله.`,
};

const DIFFICULTY_RUBRIC_AR: Record<CompetencyKey, string> = {
  knowledge: "ذكر المفاهيم الصحيحة",
  understanding: "وضوح الشرح ودقّته",
  application: "صحة الخطوات وسلامة المثال",
  critical_thinking: "عمق التحليل وقوة التعليل",
};

function buildRubric(competency: CompetencyKey, marks: number): Record<string, unknown> {
  const full = marks;
  const half = Math.max(1, Math.round(marks / 2));
  return {
    criteria: [
      {
        id: "c1",
        label_ar: DIFFICULTY_RUBRIC_AR[competency],
        marks: full,
        levels: [
          { marks: full, descriptor_ar: "إجابة كاملة وصحيحة" },
          { marks: half, descriptor_ar: "إجابة صحيحة جزئيًا تنقصها بعض العناصر" },
          { marks: 0, descriptor_ar: "إجابة غير صحيحة أو غير متصلة بالسؤال" },
        ],
      },
    ],
  };
}

/**
 * Key concepts an AI grader checks meaning against. Drawn from the lesson's own
 * vocabulary — real curriculum data — plus the objective's substantive words.
 * Grading against invented concepts would be worse than grading against none.
 */
function keyConceptsFor(objective: CurriculumObjective): string[] {
  const lesson = getLessonById(objective.lessonId);
  const vocabulary = (lesson?.keywordsAr?.length ? lesson.keywordsAr : lesson?.keywords) ?? [];
  const fromObjective = (objective.descriptionAr || objective.description)
    .split(/[\s،,.:]+/)
    .filter(w => w.length > 3)
    .slice(0, 6);
  return [...new Set([...vocabulary.slice(0, 6), ...fromObjective])].slice(0, 8);
}

/**
 * Open-response type best suited to a competency. Recall and comprehension fit
 * a short answer; application and analysis need room to show working.
 */
function pickType(
  competency: CompetencyKey,
  available: QuestionType[],
): QuestionType | null {
  const preference: Record<CompetencyKey, QuestionType[]> = {
    knowledge: ["short_answer", "open_ended", "problem_solving", "practical_task"],
    understanding: ["short_answer", "open_ended", "problem_solving", "practical_task"],
    application: ["problem_solving", "open_ended", "short_answer", "practical_task"],
    critical_thinking: ["open_ended", "problem_solving", "short_answer", "practical_task"],
  };
  return preference[competency].find(t => available.includes(t)) ?? null;
}

export function generateMockEvaluation(req: GenerationRequest): GenerationResult {
  const notes: string[] = [];
  const available = mockableTypes(req.assessmentTypes);
  const unavailableTypes = req.assessmentTypes.filter(t => !available.includes(t));

  if (req.objectives.length === 0) {
    return {
      questions: [],
      unavailableTypes,
      shortfall: req.count,
      notes: ["No learning objectives were provided, so nothing could be generated."],
    };
  }

  if (available.length === 0) {
    return {
      questions: [],
      unavailableTypes,
      shortfall: req.count,
      notes: [
        "None of the requested question types can be produced without inventing " +
          "subject content. Add an open-response type, write these questions by " +
          "hand, or switch the generator to a real model.",
      ],
    };
  }

  if (unavailableTypes.length > 0) {
    notes.push(
      `Skipped ${unavailableTypes.join(", ")}: these need distractors or factual ` +
        `statements that cannot be derived from the curriculum text alone.`,
    );
  }

  const allocation = allocateQuestions(req.count, req.difficulty);
  const questions: GeneratedQuestion[] = [];

  // Round-robin the objectives so every one a teacher chose is actually
  // covered. Filling questions objective-by-objective would spend the whole
  // budget on the first one when the count is small.
  let objectiveCursor = 0;
  for (const competency of COMPETENCY_KEYS) {
    const wanted = allocation[competency];
    const type = pickType(competency, available);
    if (!type) continue;

    for (let i = 0; i < wanted; i += 1) {
      const objective = req.objectives[objectiveCursor % req.objectives.length]!;
      objectiveCursor += 1;

      const topic = objective.descriptionAr || objective.description;
      const marks = MARKS_BY_COMPETENCY[competency];
      const typeModule = QUESTION_TYPES[type];
      const needsRubric = typeModule.defaultGradingMode === "ai_rubric";

      const body: Record<string, unknown> = { prompt: STEMS[competency](topic) };
      if (type === "problem_solving") {
        body["scenario"] = `موقف صفّي مرتبط بـ: ${objective.lessonTitleAr || topic}`;
      }
      if (type === "practical_task") {
        body["materials"] = [];
        body["steps"] = [];
        body["submission"] = "text";
      }

      const expectedAnswer: Record<string, unknown> =
        type === "practical_task"
          ? { successCriteria: [DIFFICULTY_RUBRIC_AR[competency]] }
          : {
              modelAnswer: MODEL_ANSWER[competency](topic),
              keyConcepts: keyConceptsFor(objective),
            };

      questions.push({
        type,
        body,
        expectedAnswer,
        rubric: needsRubric ? buildRubric(competency, marks) : null,
        objectiveId: objective.id,
        competencyKey: competency,
        difficulty: req.difficulty,
        marks,
        skill: objective.skills?.[0] ?? null,
        gradingMode: typeModule.defaultGradingMode,
        aiMetadata: {
          generator: "mock",
          // Say plainly what this is. A teacher reviewing the evaluation should
          // not have to guess whether a model wrote the question.
          note: "template-derived from curriculum objective; not model-authored",
          objectiveBloomsSource: objective.bloomsSource,
          objectiveEffectiveBlooms: objective.effectiveBloomsLevel,
          generatedAt: new Date().toISOString(),
        },
      });
    }
  }

  const shortfall = req.count - questions.length;
  if (shortfall > 0) {
    notes.push(`Produced ${questions.length} of ${req.count} requested questions.`);
  }

  return { questions, unavailableTypes, shortfall: Math.max(0, shortfall), notes };
}
