/**
 * What a teacher's chat message says about the shape of the exam they want —
 * «اختبار من 10 أسئلة صح وخطأ», "a quiz with fill-in-the-blank only".
 *
 * Chat used to send the same three types and eight questions for every quiz,
 * whatever was typed, so «اختبار صح وخطأ» came back as a mixed paper. Pure and
 * deliberately conservative: it only reports a type the message names, and a
 * message that names none leaves the defaults alone. Arabic digits count.
 */
export type AskedQuizType = 'multiple_choice' | 'true_false' | 'fill_blank' | 'short_answer';

const TYPE_CUES: [AskedQuizType, RegExp][] = [
  ['multiple_choice', /اختيار(?:ات)?\s*(?:من\s*)?متعدد|اختر\s+الإجابة|multiple[\s-]*choice|\bmcq\b/i],
  ['true_false', /صح\s*(?:و|أو|او|\/|-)?\s*خطأ|صواب\s*(?:و|أو|او|\/)?\s*خطأ|صح\s*وغلط|true[\s/-]*(?:or|and)?[\s/-]*false|\bt\s*\/\s*f\b/i],
  ['fill_blank', /(?:أكمل|اكمل|املأ|املا|إكمال|اكمال|ملء)\s*(?:ال)?فراغ|فراغات|fill[\s-]*(?:in|the)?[\s-]*(?:the\s*)?blank/i],
  ['short_answer', /إجابة\s*قصيرة|اجابة\s*قصيرة|أسئلة\s*مقالية|اسئلة\s*مقالية|مقالي|short[\s-]*answer|essay|open[\s-]*ended/i],
];

const AR_DIGITS = '٠١٢٣٤٥٦٧٨٩';
const toLatin = (s: string) => s.replace(/[٠-٩]/g, d => String(AR_DIGITS.indexOf(d)));

/** The types the message names, or `null` when it names none. */
export function quizTypesFromAsk(ask: string): AskedQuizType[] | null {
  const hit = TYPE_CUES.filter(([, re]) => re.test(ask)).map(([t]) => t);
  return hit.length ? hit : null;
}

/** «10 أسئلة» / "12 questions" — within what the quiz screen offers (3–20). */
export function questionCountFromAsk(ask: string): number | null {
  const m = toLatin(ask).match(/(\d{1,2})\s*(?:سؤال|أسئلة|اسئلة|questions?)/i);
  const n = m ? Number(m[1]) : NaN;
  return Number.isInteger(n) && n >= 3 && n <= 20 ? n : null;
}

/**
 * «نشاط صفي 15 دقيقة», «لمدة ٢٠ دقيقة», «ربع ساعة», "a 20-minute activity" —
 * minutes, or `null` when the message names none. Chat sent 45 whatever was
 * typed, and the «15 دقيقة» stayed in the topic instead (see `DURATION_RE` in
 * artifactTopic.ts, which takes it out). Between 5 and 180, or it is not a
 * length a class runs to.
 */
export function durationFromAsk(ask: string): number | null {
  const s = toLatin(ask);
  const m = s.match(/(\d{1,3})\s*-?\s*(?:دقيقة|دقيقه|دقائق|minutes?|mins?)(?=[\s:،,.؟?!]|$)|(\d{1,3})\s*د(?=[\s:،,.؟?!]|$)/i);
  const n = m ? Number(m[1] ?? m[2]) : NaN;
  if (Number.isInteger(n)) return n >= 5 && n <= 180 ? n : null;
  if (/(?:^|\s)ربع\s+ساعة/.test(s)) return 15;
  if (/(?:^|\s)ثلث\s+ساعة/.test(s)) return 20;
  if (/(?:^|\s)نصف\s+ساعة/.test(s)) return 30;
  return null;
}
