/**
 * Folds the teacher's clarifying answers back into their own description.
 *
 * The answers could have travelled as their own request field, but keeping
 * them inside the one `prompt` string means the server contract, the
 * generation cache key and the pooling exclusion all stay exactly as they
 * were — the prompt is still the single thing that defines the deck, which is
 * the property `routes/generate.ts` relies on when it copies it into
 * `additionalContext` and marks the request unshareable.
 *
 * Pure and dependency-free so it can be tested by the bare `node --test`
 * runner, which cannot load anything importing react-native.
 */

/** A question the teacher was asked, paired with what they tapped. */
export type AnsweredQuestion = { question: string; answer: string };

/**
 * Appends an "extra detail" block, or returns the prompt untouched when the
 * teacher skipped every question. Never appends an empty heading — a trailing
 * «تفاصيل إضافية:» with nothing under it reads as a bug to the model as much
 * as to a person.
 */
export function foldAnswersIntoPrompt(
  prompt: string,
  answered: readonly AnsweredQuestion[],
  isAr: boolean,
): string {
  const lines = answered
    .filter(a => a.question.trim() && a.answer.trim())
    .map(a => `- ${a.question.trim()} ${a.answer.trim()}`);
  if (lines.length === 0) return prompt;

  const heading = isAr ? 'تفاصيل إضافية من المعلّم:' : "Extra detail from the teacher:";
  return `${prompt.trim()}\n\n${heading}\n${lines.join('\n')}`;
}

/**
 * How much pasted source travels with the description.
 *
 * The same budget `buildDocumentPromptBlock` gives an uploaded file, for the
 * same reason: past this the source crowds out the instructions that tell the
 * model what to do with it, and `PROMPT_SLIDES_TOKENS` has a whole deck to
 * generate afterwards.
 */
export const MAX_SOURCE_CHARS = 6000;

/**
 * Folds a passage the teacher pasted in beneath their description.
 *
 * This is the lever the tool was missing. A small model is far better at
 * summarising text put in front of it than at recalling facts on its own, and
 * the deck's thinness has always been a recall problem — so handing it a
 * source is the one content improvement that does not require a bigger model.
 *
 * Text rather than an uploaded file on purpose. `processDocument` reads real
 * text out of a `.txt`, scrapes uncompressed PDFs on web only, and reads
 * nothing at all from Word, PowerPoint, images, or any PDF on a phone — for
 * those it honestly reports that the file was not read. A picker that fails
 * to read most of what a teacher owns is a feature that looks broken; pasted
 * text works on every platform, for every format, every time.
 *
 * The three rules travel with the passage because they are what stop the
 * source making things *worse*: a model handed reference text will otherwise
 * answer the parts the text does not cover by inventing them, and attribute
 * the invention to the teacher's own source.
 */
export function foldSourceIntoPrompt(prompt: string, source: string, isAr: boolean): string {
  const text = clampSource(source, isAr);
  if (!text) return prompt;

  const block = isAr
    ? [
      '=== نص مصدري من المعلّم ===',
      'ابنِ الشرائح من هذا النص: كل حقيقة أو رقم أو تعريف في العرض يجب أن يكون مأخوذًا منه.',
      'إن لم يغطِّ النص شيئًا طلبه الوصف، قل ذلك صراحة بدل اختراعه، ولا تنسب إلى النص ما ليس فيه.',
      'أعد الصياغة لتناسب الشرائح — لا تنسخ فقرات كما هي.',
    ]
    : [
      '=== Source text from the teacher ===',
      'Build the slides from this text: every fact, figure and definition in the deck must come from it.',
      'Where the text does not cover something the description asked for, say so rather than invent it, and never attribute to the source what is not in it.',
      'Rewrite it for slides — do not copy paragraphs verbatim.',
    ];

  return `${prompt.trim()}\n\n${block.join('\n')}\n\n${text}`;
}

/**
 * The passage, cut to budget at a line break where there is one.
 *
 * The cut is announced. A source that stops mid-sentence with no marker reads
 * to the model as a source that simply ends there, and it will happily build a
 * summary slide about a conclusion it was never shown.
 */
function clampSource(source: string, isAr: boolean): string {
  const text = (source ?? '').trim();
  if (text.length <= MAX_SOURCE_CHARS) return text;
  const head = text.slice(0, MAX_SOURCE_CHARS);
  const lastBreak = head.lastIndexOf('\n');
  const cut = lastBreak > MAX_SOURCE_CHARS / 2 ? head.slice(0, lastBreak) : head;
  return `${cut.trimEnd()}\n${isAr ? '[…قُصّ النص هنا — المصدر أطول مما ظهر أعلاه]' : '[…text truncated — the source is longer than what is shown above]'}`;
}
