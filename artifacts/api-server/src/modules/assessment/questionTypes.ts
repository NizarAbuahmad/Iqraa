/**
 * The question-type registry.
 *
 * Every type-specific behaviour lives behind this one interface, so adding a
 * ninth assessment type is a new entry here rather than a migration and a
 * scattering of switch statements. Three things matter per type:
 *
 *  validate         — is this question well-formed enough to put in front of a
 *                     student? Run before anything is persisted, on AI output
 *                     and teacher edits alike.
 *  sanitizeForStudent — the projection a student may receive. This is the
 *                     control that keeps answer keys off a student's device;
 *                     it is asserted by test, because a code review will
 *                     eventually miss a field and a test will not.
 *  defaultGradingMode — how marks get decided, which drives whether a grade is
 *                     a fact or a judgement.
 */
import type { GradingMode, QuestionType } from "@workspace/db";

export interface QuestionDraft {
  type: QuestionType;
  body: Record<string, unknown>;
  expectedAnswer: Record<string, unknown>;
  rubric?: Record<string, unknown> | null;
}

export interface TypeModule {
  /** Problems that make the question unusable. Non-empty means reject. */
  validate(q: QuestionDraft): string[];
  /** Student-facing projection. Must never include answers or rubric. */
  sanitizeForStudent(q: QuestionDraft): Record<string, unknown>;
  defaultGradingMode: GradingMode;
  /** False when a mock generator cannot honestly produce this type. */
  mockable: boolean;
}

const str = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

const multipleChoice: TypeModule = {
  defaultGradingMode: "deterministic",
  // Plausible distractors cannot be invented from an objective's title without
  // fabricating subject content. The existing quick-check generator already
  // takes this line for non-math topics; the evaluation module holds it too.
  mockable: false,
  validate(q) {
    const errors: string[] = [];
    const options = Array.isArray(q.body["options"]) ? (q.body["options"] as unknown[]) : [];
    if (!str(q.body["stem"])) errors.push("Question stem is empty");
    if (options.length < 3) errors.push("Multiple choice needs at least 3 options");

    const texts = options.map(o => str((o as Record<string, unknown>)?.["text"]));
    if (texts.some(t => !t)) errors.push("An option has no text");
    if (new Set(texts).size !== texts.length) errors.push("Duplicate options");

    const correct = Array.isArray(q.expectedAnswer["optionIds"])
      ? (q.expectedAnswer["optionIds"] as unknown[])
      : [];
    const ids = new Set(options.map(o => str((o as Record<string, unknown>)?.["id"])));
    if (correct.length === 0) errors.push("No correct option marked");
    if (!q.body["multiSelect"] && correct.length > 1) {
      errors.push("Single-answer question marks more than one option correct");
    }
    if (correct.some(id => !ids.has(str(id)))) errors.push("Correct option is not in the list");
    return errors;
  },
  sanitizeForStudent(q) {
    const options = Array.isArray(q.body["options"]) ? (q.body["options"] as unknown[]) : [];
    return {
      stem: q.body["stem"],
      multiSelect: q.body["multiSelect"] === true,
      options: options.map(o => ({
        id: (o as Record<string, unknown>)["id"],
        text: (o as Record<string, unknown>)["text"],
      })),
    };
  },
};

const trueFalse: TypeModule = {
  defaultGradingMode: "deterministic",
  // A true/false item needs a statement that is definitely true or definitely
  // false. Restating an objective as a claim produces something that is either
  // trivially true or accidentally wrong; neither measures anything.
  mockable: false,
  validate(q) {
    const errors: string[] = [];
    if (!str(q.body["statement"])) errors.push("Statement is empty");
    if (typeof q.expectedAnswer["value"] !== "boolean") errors.push("Answer must be true or false");
    return errors;
  },
  sanitizeForStudent(q) {
    return { statement: q.body["statement"] };
  },
};

const matching: TypeModule = {
  defaultGradingMode: "deterministic",
  mockable: false,
  validate(q) {
    const errors: string[] = [];
    const left = Array.isArray(q.body["left"]) ? (q.body["left"] as unknown[]) : [];
    const right = Array.isArray(q.body["right"]) ? (q.body["right"] as unknown[]) : [];
    const pairs = Array.isArray(q.expectedAnswer["pairs"])
      ? (q.expectedAnswer["pairs"] as unknown[])
      : [];
    if (left.length < 2) errors.push("Matching needs at least 2 items on the left");
    if (right.length < 2) errors.push("Matching needs at least 2 items on the right");
    if (pairs.length !== left.length) errors.push("Every left item needs a matching pair");
    return errors;
  },
  sanitizeForStudent(q) {
    // Right-hand items are shuffled for delivery; order here is the stored one.
    return { left: q.body["left"], right: q.body["right"] };
  },
};

const fillBlank: TypeModule = {
  defaultGradingMode: "deterministic",
  mockable: false,
  validate(q) {
    const errors: string[] = [];
    const template = str(q.body["template"]);
    if (!template) errors.push("Template is empty");
    const placeholders = (template.match(/\{\{\d+\}\}/g) ?? []).length;
    if (placeholders === 0) errors.push("Template has no blanks");
    const blanks = Array.isArray(q.expectedAnswer["blanks"])
      ? (q.expectedAnswer["blanks"] as unknown[])
      : [];
    if (blanks.length !== placeholders) {
      errors.push(`Template has ${placeholders} blanks but ${blanks.length} answers`);
    }
    for (const b of blanks) {
      const accept = (b as Record<string, unknown>)?.["accept"];
      if (!Array.isArray(accept) || accept.length === 0) {
        errors.push("A blank has no accepted answers");
      }
    }
    return errors;
  },
  sanitizeForStudent(q) {
    return { template: q.body["template"], blanks: q.body["blanks"] };
  },
};

/** Open-response types share their shape; only the prompt fields differ. */
function openResponse(
  gradingMode: GradingMode,
  extraBodyKeys: string[],
  requireRubric: boolean,
): TypeModule {
  return {
    defaultGradingMode: gradingMode,
    mockable: true,
    validate(q) {
      const errors: string[] = [];
      if (!str(q.body["prompt"])) errors.push("Prompt is empty");
      if (!str(q.expectedAnswer["modelAnswer"])) errors.push("No model answer");
      const concepts = q.expectedAnswer["keyConcepts"];
      if (!Array.isArray(concepts) || concepts.length === 0) {
        // Without key concepts the AI grader has nothing to check meaning
        // against, and falls back to comparing wording — the exact failure the
        // brief forbids.
        errors.push("No key concepts to grade meaning against");
      }
      if (requireRubric && !q.rubric) errors.push("Open-ended question needs a rubric");
      return errors;
    },
    sanitizeForStudent(q) {
      const out: Record<string, unknown> = { prompt: q.body["prompt"] };
      for (const key of extraBodyKeys) out[key] = q.body[key];
      return out;
    },
  };
}

const practicalTask: TypeModule = {
  // Often performed away from a screen, so the teacher marks it. Treating it
  // as auto-gradable would measure whether the student typed something.
  defaultGradingMode: "manual",
  mockable: true,
  validate(q) {
    const errors: string[] = [];
    if (!str(q.body["prompt"])) errors.push("Prompt is empty");
    const criteria = q.expectedAnswer["successCriteria"];
    if (!Array.isArray(criteria) || criteria.length === 0) {
      errors.push("Practical task needs success criteria");
    }
    return errors;
  },
  sanitizeForStudent(q) {
    return {
      prompt: q.body["prompt"],
      materials: q.body["materials"],
      steps: q.body["steps"],
      submission: q.body["submission"] ?? "text",
    };
  },
};

export const QUESTION_TYPES: Record<QuestionType, TypeModule> = {
  multiple_choice: multipleChoice,
  true_false: trueFalse,
  matching,
  fill_blank: fillBlank,
  short_answer: openResponse("ai_rubric", [], false),
  open_ended: openResponse("ai_rubric", [], true),
  problem_solving: openResponse("ai_rubric", ["scenario"], true),
  practical_task: practicalTask,
};

export function moduleFor(type: QuestionType): TypeModule | undefined {
  return QUESTION_TYPES[type];
}

/** Types a mock generator can produce without inventing subject content. */
export function mockableTypes(types: readonly QuestionType[]): QuestionType[] {
  return types.filter(t => QUESTION_TYPES[t]?.mockable);
}
