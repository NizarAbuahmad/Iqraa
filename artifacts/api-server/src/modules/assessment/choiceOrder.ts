/**
 * Shuffle each generated multiple-choice question's options, once, before the
 * paper is stored.
 *
 * Why at generation and not per attempt (as `studentView.ts` does for a
 * matching question's right column): the stored order is also the printed
 * paper's order and the order the teacher reviews the key in. Shuffled once,
 * all three agree. What it fixes is the writer's habit — a model tends to put
 * the right answer in the same place, and nothing reordered it.
 *
 * The ids keep their sequence («a, b, c, d» stays «a, b, c, d» in position)
 * and the key is remapped to follow its text, so a screen that labels options
 * by id or by position shows the same letters either way.
 *
 * Left alone:
 * - a textbook item (`aiMetadata.generator === "book"`), which stays in the
 *   book's printed order so a teacher can compare it with the book;
 * - a question whose options point at other options («جميع ما سبق», «أ و ب»,
 *   «كلاهما», "all of the above"), which a shuffle would make wrong.
 *
 * A question it shuffled carries `aiMetadata.choiceOrder: "shuffled"`: the
 * validator's answer-position warning counts only the others, because five
 * fairly shuffled questions put three keys in one place by chance ~41% of the time.
 */
import type { GeneratedQuestion } from "./mockGenerator.ts";

type Option = { id: string; text: string };

/** Option text that only makes sense in its place among the others. */
const POSITIONAL = [
  /ما\s*سبق/, // جميع ما سبق، لا شيء مما سبق، كل ما سبق
  /ما\s*ذُ?كِ?ر/,
  /(?:جميع|كل)\s+(?:الإجابات|الخيارات|البدائل)/,
  /الإجابتان|الخياران|كلاهما|كلا\s*(?:الخيارين|الإجابتين)|ولا\s*واحد/,
  /(?:^|[\s(])[أبجده]\)?\s*(?:و|أو)\s*\(?[أبجده](?:\)|\s|$)/,
  /\b(?:of the above|of these)\b/i,
  /^\s*(?:both|neither)\b/i,
  /\b[a-e]\)?\s*(?:and|&)\s*\(?[a-e]\b/i,
];

function isPositional(options: readonly Option[]): boolean {
  return options.some(o => POSITIONAL.some(re => re.test(o.text)));
}

function shuffleOne(q: GeneratedQuestion, rng: () => number): GeneratedQuestion {
  if (q.type !== "multiple_choice" || q.aiMetadata["generator"] === "book") return q;
  const options = q.body["options"];
  const key = q.expectedAnswer["optionIds"];
  if (!Array.isArray(options) || options.length < 2 || !Array.isArray(key)) return q;
  const opts = options as Option[];
  if (opts.some(o => typeof o?.id !== "string" || typeof o?.text !== "string")) return q;
  if (isPositional(opts)) return q;

  const order = opts.map((_, i) => i);
  for (let i = order.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [order[i], order[j]] = [order[j]!, order[i]!];
  }

  // The option now at position p takes the id that position had before.
  const newId = new Map<string, string>();
  const shuffled = order.map((from, p) => {
    const moved = opts[from]!;
    newId.set(moved.id, opts[p]!.id);
    return { ...moved, id: opts[p]!.id };
  });
  return {
    ...q,
    aiMetadata: { ...q.aiMetadata, choiceOrder: "shuffled" },
    body: { ...q.body, options: shuffled },
    expectedAnswer: {
      ...q.expectedAnswer,
      optionIds: (key as unknown[]).map(id => newId.get(String(id)) ?? id),
    },
  };
}

export function shuffleChoices(
  questions: readonly GeneratedQuestion[],
  rng: () => number = Math.random,
): GeneratedQuestion[] {
  return questions.map(q => shuffleOne(q, rng));
}
