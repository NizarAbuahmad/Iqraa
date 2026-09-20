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

import { scopeLine } from './promptSlidesPrompt.ts';

/** Never ask more than this — it is one round, not an interview. */
export const MAX_CLARIFYING_QUESTIONS = 3;

/** Output ceiling. Three short questions with four options each is tiny. */
export const QUESTIONS_TOKENS = 800;

export type PromptSlidesQuestion = {
  id: string;
  question: string;
  options: { id: string; label: string }[];
};

/*
 * Both builders below decide the deck's KIND before choosing what to ask, and
 * that decision has to agree with `promptSlidesPrompt.ts`. The answers a
 * teacher taps here are folded into the description the deck prompt reads, so
 * a lesson-shaped question answered on a general deck («ما هدف الحصة؟ →
 * التعريف بالتقاليد») tells the deck model it IS a lesson, and the deck comes
 * back with «أهداف الحصة» on a celebration however carefully the deck prompt
 * was told otherwise. The first version of this file did exactly that.
 *
 * Grade and subject are never asked. The screen sends them from the teacher's
 * profile and the deck prompt already reads them; asking again is a wasted tap,
 * and a model that does not know which grades exist answers by inventing a
 * list of them — a teacher saw «السادس/السابع/الثامن/التاسع» offered for a
 * Mother's Day deck.
 */

export function questionsPromptAr(b: any): string {
  return `أنت تساعد معلّمًا على توضيح ما يريده من عرض شرائحي قبل توليده.

وصف المعلّم:
"${b.prompt ?? ''}"
${scopeLine(b, true)}

أولًا حدّد نوع العرض من الوصف. السؤال الفاصل: هل هناك جمهور يتعلّم مادة سيُقاس إتقانه لها؟
- نعم → عرض تعليمي: درس أو مراجعة أو شرح مفهوم.
- لا → عرض عام: خطة، فعالية، طابور صباحي، لقاء أولياء أمور، احتفال، مبادرة.
لا تفترض أنه درس. عرض عن «يوم الأم» أو «رحلة مدرسية» ليس حصة.

ثم، إن كان الوصف ناقصًا، اطرح ما لا يزيد عن ${MAX_CLARIFYING_QUESTIONS} أسئلة قصيرة تُجاب بالنقر على خيار.

ما يستحقّ السؤال:
- في عرض تعليمي: الغرض (شرح جديد / مراجعة / تقييم)، هل درس الطلبة الموضوع سابقًا، التركيز المطلوب.
- في عرض عام: لمن العرض (طلبة / أولياء أمور / معلّمون / جمهور مختلط)، الإطار (داخل الصف / طابور / فعالية)، النبرة (رسمية / دافئة / مرحة)، ما المطلوب من الحضور في النهاية.

لا تسأل أبدًا عن:
- الصف أو المادة. معروفان من ملف المعلّم أعلاه، ولا تخترع قائمة صفوف.
- الموضوع نفسه إن ذكره الوصف.
- «هدف الحصة» أو «هل درس الطلبة الموضوع» في عرض عام. لا حصة هناك.

أعد JSON فقط بهذا الشكل:
{"questions":[{"id":"audience","question":"لمن هذا العرض؟","options":[{"id":"students","label":"للطلبة"},{"id":"parents","label":"لأولياء الأمور"},{"id":"mixed","label":"جمهور مختلط"}]}]}

قواعد:
- إن كان الوصف يجيب عن هذه الأسئلة أصلًا فأعد {"questions":[]} — لا تسأل لمجرّد السؤال.
- كل سؤال من 2 إلى 4 خيارات، وكل خيار كلمتان أو ثلاث بالعربية.
- "id" بالإنجليزية بحروف صغيرة بلا مسافات.`;
}

export function questionsPromptEn(b: any): string {
  return `You are helping a teacher clarify what they want from a slide deck before it is generated.

The teacher's description:
"${b.prompt ?? ''}"
${scopeLine(b, false)}

First, decide which kind of deck this is. One question settles it: is there an audience learning material they will be assessed on?
- Yes → a teaching deck: a lesson, a revision session, an explanation of a concept.
- No → a general deck: a plan, an event, a morning assembly, a parents' evening, a celebration, an initiative.
Do not assume a lesson. A deck about Mother's Day or a school trip is not a class.

Then, if the description is thin, ask at most ${MAX_CLARIFYING_QUESTIONS} short questions that can be answered by tapping an option.

What is worth asking:
- For a teaching deck: the purpose (new explanation / revision / assessment), whether students have met the topic before, what to emphasise.
- For a general deck: who it is for (students / parents / staff / a mixed audience), the setting (in class / assembly / an event), the tone (formal / warm / playful), what the audience should do at the end.

Never ask about:
- The grade or the subject. They are known from the teacher's profile above; do not invent a list of grades.
- The topic itself, if the description names it.
- "The lesson's objective" or "have students studied this" on a general deck. There is no lesson.

Return JSON only, in this shape:
{"questions":[{"id":"audience","question":"Who is this deck for?","options":[{"id":"students","label":"Students"},{"id":"parents","label":"Parents"},{"id":"mixed","label":"A mixed audience"}]}]}

Rules:
- If the description already answers these, return {"questions":[]} — do not ask for the sake of asking.
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
