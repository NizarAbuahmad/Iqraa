/**
 * The one clarifying round before a deck is generated.
 *
 * A teacher who types «شرائح عن الكسور» has not said enough for a good deck —
 * not the year group, not whether this is a first explanation or a revision,
 * not how long the slot is. The expensive call cannot ask, so a cheap one does
 * it first: `getChatModel()` (the nano model) reads the description and either
 * returns two or three tap-to-answer questions or an empty list.
 *
 * Whether the description is already specific enough is the MODEL's call, not a
 * keyword heuristic here. A heuristic would need maintaining against every
 * phrasing a teacher might use in two languages, and would be wrong in exactly
 * the cases that matter — a long description that still never says the grade.
 *
 * Everything about this is best-effort. The client proceeds to generation on an
 * empty list, a timeout or any failure, because a deck the teacher asked for
 * beats a question they did not.
 */

/** Never ask more than this — it is one round, not an interview. */
export const MAX_CLARIFYING_QUESTIONS = 3;

/** Output ceiling. Three short questions with four options each is tiny. */
export const QUESTIONS_TOKENS = 800;

export type PromptSlidesQuestion = {
  id: string;
  question: string;
  options: { id: string; label: string }[];
};

export function questionsPromptAr(b: any): string {
  return `أنت تساعد معلّمًا على توضيح ما يريده من عرض شرائحي قبل توليده.

وصف المعلّم:
"${b.prompt ?? ''}"

مهمّتك: إن كان الوصف ناقصًا، اطرح ما لا يزيد عن ${MAX_CLARIFYING_QUESTIONS} أسئلة قصيرة تُجاب بالنقر على خيار.

أعد JSON فقط بهذا الشكل:
{"questions":[{"id":"purpose","question":"ما هدف الحصة؟","options":[{"id":"new","label":"شرح جديد"},{"id":"revision","label":"مراجعة"},{"id":"assessment","label":"تقييم"}]}]}

قواعد:
- إن كان الوصف يذكر الموضوع والصف والهدف والطول فأعد {"questions":[]} — لا تسأل لمجرّد السؤال.
- اسأل فقط عمّا يغيّر محتوى الشرائح فعلًا: الهدف من الحصة، المستوى، ما إذا كان الطلبة درسوا الموضوع سابقًا، التركيز المطلوب.
- لا تسأل عن الموضوع نفسه إن ذكره الوصف.
- كل سؤال من 2 إلى 4 خيارات، وكل خيار كلمتان أو ثلاث بالعربية.
- "id" بالإنجليزية بحروف صغيرة بلا مسافات.`;
}

export function questionsPromptEn(b: any): string {
  return `You are helping a teacher clarify what they want from a slide deck before it is generated.

The teacher's description:
"${b.prompt ?? ''}"

Your task: if the description is thin, ask at most ${MAX_CLARIFYING_QUESTIONS} short questions that can be answered by tapping an option.

Return JSON only, in this shape:
{"questions":[{"id":"purpose","question":"What is this lesson for?","options":[{"id":"new","label":"New explanation"},{"id":"revision","label":"Revision"},{"id":"assessment","label":"Assessment"}]}]}

Rules:
- If the description already states the topic, the year group, the purpose and the length, return {"questions":[]} — do not ask for the sake of asking.
- Only ask about things that actually change the slides: the purpose of the lesson, the level, whether students have met the topic before, what to emphasise.
- Never ask about the topic itself if the description names it.
- Each question has 2 to 4 options, each option two or three words.
- "id" is lowercase English with no spaces.`;
}

/**
 * Pull a usable question list out of whatever the model returned.
 *
 * Fails to `[]` rather than throwing: the caller's contract with the client is
 * "questions or nothing", and a malformed question set is nothing. Anything
 * short of a well-formed question with at least two labelled options is
 * dropped — a one-option question is not a question.
 */
export function parseQuestions(parsed: unknown): PromptSlidesQuestion[] {
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) return [];
  const raw = (parsed as Record<string, unknown>).questions;
  if (!Array.isArray(raw)) return [];

  const out: PromptSlidesQuestion[] = [];
  for (const item of raw.slice(0, MAX_CLARIFYING_QUESTIONS)) {
    if (item === null || typeof item !== 'object' || Array.isArray(item)) continue;
    const q = item as Record<string, unknown>;
    const id = typeof q.id === 'string' ? q.id.trim() : '';
    const question = typeof q.question === 'string' ? q.question.trim() : '';
    if (!id || !question || !Array.isArray(q.options)) continue;

    const options: { id: string; label: string }[] = [];
    for (const rawOpt of q.options.slice(0, 4)) {
      if (rawOpt === null || typeof rawOpt !== 'object' || Array.isArray(rawOpt)) continue;
      const opt = rawOpt as Record<string, unknown>;
      const optId = typeof opt.id === 'string' ? opt.id.trim() : '';
      const label = typeof opt.label === 'string' ? opt.label.trim() : '';
      if (optId && label) options.push({ id: optId, label });
    }
    if (options.length < 2) continue;
    out.push({ id, question, options });
  }
  return out;
}
