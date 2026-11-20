/**
 * How a KB search result becomes either a grounding, a question, or nothing.
 *
 * Retrieval used to be a cliff. `isConfidentKbHit` was the only gate, so a top
 * hit scoring 9 was discarded exactly like a top hit scoring 0 — the system had
 * a good candidate in hand, threw it away, and asked the teacher to start over.
 * That is what made the chat feel like it demanded a lesson it could have
 * guessed.
 *
 * There are now three outcomes instead of two, and the middle one is the point:
 *
 *   confident  — ground on it silently, as before
 *   ambiguous  — we have plausible candidates but not certainty → ask
 *   none       — nothing worth showing → the caller's existing fallback
 *
 * `ambiguous` deliberately covers two different shapes of doubt, because the
 * teacher-facing answer is the same question either way:
 *
 *   weak      — the best hit clears KB_SUGGEST_SCORE but not KB_CONFIDENT_SCORE
 *   contested — the best hit is strong but a rival is nearly as strong
 *
 * Why ask rather than take the top hit: grounding is a claim. Silently
 * substituting a near-miss produces a lesson plan that says it follows NCCD
 * outcomes for a lesson the teacher never asked about, and they carry it into a
 * classroom before noticing. Guess loudly, never silently — the same rule that
 * governs `verified` elsewhere in this repo.
 *
 * Pure: takes ranked results as an argument and imports only types, so it does
 * not pull the curriculum data that makes `knowledgeBase.ts` heavy to load.
 * `knowledgeBase.ts` imports the threshold and predicate back from here, so
 * there is exactly one definition of "confident".
 */
import type { KBLesson, KBScoredLesson } from './knowledgeBase.ts';

/** Minimum lexical score to treat a KB hit as confident for grounding. */
export const KB_CONFIDENT_SCORE = 10;

/**
 * Minimum score to be worth *asking* about. Below this a hit is noise — a
 * single shared word like «معادلات» — and offering it wastes the teacher's turn
 * on a lesson they did not mean. Deliberately a separate knob from the
 * confidence bar: this one tunes how eager the app is to ask, and the other
 * tunes how eager it is to act without asking.
 */
export const KB_SUGGEST_SCORE = 5;

/**
 * How close a rival has to be before a strong top hit counts as contested.
 * Mirrors the margin `isConfidentKbHit` demands, so the two cannot disagree
 * about the same pair of results.
 */
const CONFIDENT_MARGIN = 1.2;

/**
 * The teacher named the lesson: the top hit's whole title is in the query and
 * no other lesson's title is. Then a rival's score is a shared word, not a
 * competing reading («تحليل» in the data-analysis lesson, 65, against «حل
 * المعادلات التربيعية بالتحليل», 71 once its title counts) — so the margin and
 * the other-subject checks, which exist for the case where nobody named
 * anything, do not apply. Two lessons with the same title (the book repeats 107
 * across grades) are both covered and stay contested.
 */
export function titleDecides(ranked: KBScoredLesson[]): boolean {
  const top = ranked[0];
  if (!top?.titleCovered || top.score < KB_CONFIDENT_SCORE) return false;
  return !ranked.slice(1).some(r => r.titleCovered);
}

/**
 * The teacher's picked grade narrows a search, but not past a lesson they named
 * in another SUBJECT. «ورقة عمل عن حل المعادلة التربيعية بالتحليل» with grade 10
 * picked searched grade 10 alone, found «تحليل البيانات» (Digital Skills, a
 * shared word), and made a Digital Skills worksheet; the lesson named whole is
 * Maths, grade 9. So when the whole-KB search is decided by a title no other
 * lesson shares, and the grade's own best hit is in a different subject (or
 * there is none), the named lesson wins.
 *
 * It does NOT move a request to another grade of the same subject: «واجب عن
 * محيط الدائرة» with grade 10 picked stays grade 10 maths, not the grade 7
 * lesson of that name. The picked grade is the teacher's class; only a subject
 * the grade cannot answer in is overruled. The same title in the picked grade
 * makes the whole-KB search contested, so the grade keeps it.
 */
export function namedLessonBeatsGrade(
  inGrade: KBScoredLesson[],
  all: KBScoredLesson[],
  subjectOf: (lesson: KBLesson) => string | undefined,
): boolean {
  if (!titleDecides(all)) return false;
  if (inGrade.length === 0) return true;
  if (titleDecides(inGrade)) return false;
  return subjectOf(inGrade[0]!.lesson) !== subjectOf(all[0]!.lesson);
}

/** True when the top ranked hit clears the confidence bar vs the runner-up. */
export function isConfidentKbHit(ranked: KBScoredLesson[]): boolean {
  const top = ranked[0];
  if (!top || top.score < KB_CONFIDENT_SCORE) return false;
  if (titleDecides(ranked)) return true;
  const second = ranked[1];
  if (!second) return true;
  return top.score >= second.score * CONFIDENT_MARGIN;
}

export type KbCandidateResolution =
  /** Ground on this lesson without asking. */
  | { kind: 'confident'; lesson: KBLesson }
  /** Plausible but unproven — ask before grounding. `reason` is for telemetry. */
  | { kind: 'ambiguous'; candidates: KBLesson[]; reason: 'weak' | 'contested' }
  /** Nothing worth putting in front of the teacher. */
  | { kind: 'none' };

/**
 * Classify a ranked result list into ground / ask / nothing.
 *
 * `maxCandidates` caps how many chips a teacher is asked to choose between —
 * more than three on a phone is a menu, not a question.
 */
export function resolveKbCandidates(
  ranked: KBScoredLesson[],
  maxCandidates = 3,
): KbCandidateResolution {
  const top = ranked[0];
  if (!top) return { kind: 'none' };

  if (isConfidentKbHit(ranked)) return { kind: 'confident', lesson: top.lesson };

  if (top.score < KB_SUGGEST_SCORE) return { kind: 'none' };

  // A strong top hit that failed `isConfidentKbHit` failed on the margin, so a
  // rival is within CONFIDENT_MARGIN of it — genuinely two candidates, not one
  // weak one. Worth distinguishing: a contested pair means retrieval is working
  // and the query is short, which is a different tuning problem from a weak hit.
  const reason = top.score >= KB_CONFIDENT_SCORE ? 'contested' : 'weak';

  const candidates: KBLesson[] = [];
  const seen = new Set<string>();
  for (const scored of ranked) {
    if (candidates.length >= maxCandidates) break;
    if (scored.score < KB_SUGGEST_SCORE) break; // ranked desc — the rest are noise
    if (seen.has(scored.lesson.id)) continue;
    seen.add(scored.lesson.id);
    candidates.push(scored.lesson);
  }

  return candidates.length > 0
    ? { kind: 'ambiguous', candidates, reason }
    : { kind: 'none' };
}

/**
 * Should chat stop and ask which lesson the teacher meant?
 *
 * Lifted out of `iqra.tsx`'s `sendMessage` so it can be tested. The screen has
 * no test coverage of any kind — which is how this branch shipped unexercised
 * — and it cannot get any without a React renderer the repo does not have. The
 * decision, though, is just data in and a verdict out.
 *
 * Getting the conditions wrong is expensive in both directions: too eager and
 * the app interrogates a teacher who was perfectly clear, too shy and it builds
 * a worksheet on a guess and stamps NCCD grounding on it.
 *
 * Only artifact intent asks. For a teaching answer a near-miss costs one
 * sentence the teacher corrects on the next turn, so the question would cost
 * more than the mistake.
 */
export function shouldAskWhichLesson(opts: {
  intent: string;
  /** A pinned lesson, an explicit subject scope, or a stated teaching context. */
  hasHardContext: boolean;
  /** Teacher-uploaded documents are the topic; do not second-guess them. */
  hasDocuments: boolean;
  /** A bare "خطة" riding on the soft-pinned default lesson — already resolved. */
  isSoftBareArtifact: boolean;
  ranked: KBScoredLesson[];
}): { ask: false } | { ask: true; candidates: KBLesson[]; reason: 'weak' | 'contested' } {
  if (opts.intent !== 'artifact') return { ask: false };
  if (opts.hasHardContext) return { ask: false };
  if (opts.hasDocuments) return { ask: false };
  if (opts.isSoftBareArtifact) return { ask: false };

  const guess = resolveKbCandidates(opts.ranked);
  return guess.kind === 'ambiguous'
    ? { ask: true, candidates: guess.candidates, reason: guess.reason }
    : { ask: false };
}

/**
 * Should an artifact ask with no lesson behind it go to the live model?
 *
 * The «which subject?» / «which lesson?» / «اكتب اسم الدرس» stops in chat exist
 * for the offline assistant, which can only answer from a lesson. A teaching
 * question already skips them in front of a model (`liveTeaching` in
 * `iqra.tsx`); an artifact ask never did. So «نشاط صفي 15 دقيقة للصف السادس:
 * لو كنت وزير التربية ليوم واحد» (2026-11-20) — «نشاط» makes it an artifact,
 * and no lesson is about that — got wrong-subject and wrong-grade chips that
 * led back to the same question, and the model was never called.
 *
 * Only when the search is not confident, nothing pins the context (a lesson,
 * a named subject, a teaching context), there are no uploaded documents, it
 * is not a bare shortcut riding the soft-pinned lesson, and the ask carries a
 * topic of its own (`topic` is `topicFromQuery`, the material words removed).
 * A confident lesson match still goes to the generators, which ground it.
 */
export function freeTopicArtifactGoesLive(opts: {
  demoMode: boolean;
  intent: string;
  hasHardContext: boolean;
  hasDocuments: boolean;
  isSoftBareArtifact: boolean;
  confidentHit: boolean;
  topic: string;
}): boolean {
  if (opts.demoMode || opts.intent !== 'artifact') return false;
  if (opts.hasHardContext || opts.hasDocuments || opts.isSoftBareArtifact || opts.confidentHit) return false;
  return opts.topic.trim().length >= 6;
}

/**
 * `ranked` kept to the grade and subject the teacher named.
 *
 * The «which lesson?» chips were built from the whole-KB ranking while the
 * results beside them had already been cut to the named grade, so a grade 6
 * ask offered grade 10 and grade 4 lessons — and a chip re-sent the ask pinned
 * to a lesson the grade filter then dropped again. `scopeOf` is injected
 * (`getBookForLesson` in the app) so this module stays free of curriculum data.
 */
export function rankedInScope(
  ranked: KBScoredLesson[],
  scopeOf: (lesson: KBLesson) => { gradeId?: string; subjectId?: string } | undefined,
  scope: { gradeId?: string | null; subjectId?: string | null },
): KBScoredLesson[] {
  if (!scope.gradeId && !scope.subjectId) return ranked;
  return ranked.filter(({ lesson }) => {
    const s = scopeOf(lesson);
    if (!s) return false;
    if (scope.gradeId && s.gradeId !== scope.gradeId) return false;
    if (scope.subjectId && s.subjectId !== scope.subjectId) return false;
    return true;
  });
}

/**
 * The grade and subject a chat ask is about, for deciding which lessons it may
 * be offered. Either part may be unknown; an unknown part does not narrow.
 */
export type AskScope = { gradeId?: string | null; subjectId?: string | null };

type BookOf = (lesson: KBLesson) => { gradeId: string; subjectId: string } | undefined;

/** Whether `lesson` is in `scope`. A lesson with no book is never in a scope that names anything. */
export function inAskScope(lesson: KBLesson, scope: AskScope, bookOf: BookOf): boolean {
  if (!scope.gradeId && !scope.subjectId) return true;
  const book = bookOf(lesson);
  if (!book) return false;
  if (scope.gradeId && book.gradeId !== scope.gradeId) return false;
  if (scope.subjectId && book.subjectId !== scope.subjectId) return false;
  return true;
}

/**
 * The lessons a chat ask may put on a chip: in its grade and subject, and taught
 * by this teacher (`teaches` is true for everything before set-up).
 *
 * «نشاط صفي 15 دقيقة للصف السادس: لو كنت وزير التربية ليوم واحد» filtered its
 * results to grade 6 and found nothing, while «which lesson?» read the
 * unfiltered search and offered grade 10 English «يوم في الفندق» on the word
 * «يوم». A chip outside the scope the answer is built in is a chip the next
 * step throws away. Unlike `lessonsTheTeacherTeaches`, nothing taught means
 * nothing to offer, not everything.
 */
export function lessonsInAskScope(
  lessons: KBLesson[],
  scope: AskScope,
  bookOf: BookOf,
  teaches: (subjectId: string, gradeId: string) => boolean,
): KBLesson[] {
  return lessons.filter(lesson => {
    if (!inAskScope(lesson, scope, bookOf)) return false;
    const book = bookOf(lesson);
    return !book || teaches(book.subjectId, book.gradeId);
  });
}

/** `lessonsInAskScope` for a ranked list, scores kept. */
export function rankedInAskScope(
  ranked: KBScoredLesson[],
  scope: AskScope,
  bookOf: BookOf,
  teaches: (subjectId: string, gradeId: string) => boolean,
): KBScoredLesson[] {
  const keep = new Set(lessonsInAskScope(ranked.map(r => r.lesson), scope, bookOf, teaches).map(l => l.id));
  return ranked.filter(r => keep.has(r.lesson.id));
}

/**
 * A strong top hit that is not confident still names the topic when every
 * lesson near it is in its unit: «ورقة عمل عن الدائرة» ties the circle lessons,
 * and any of them is the circle unit.
 *
 * Score alone used to be enough (`>= KB_CONFIDENT_SCORE`), and in one grade a
 * sentence with no lesson in it clears that on common words: «لو كنت وزير
 * التربية ليوم واحد» scored 13 on three grade 8 art lessons from different units
 * (every «التربية الفنية» lesson matches «التربية») and 12 on grade 6 social
 * studies, and the chat would have built the activity on one of them, silently.
 */
export function topHitHoldsTopic(
  ranked: KBScoredLesson[],
  unitOf: (lesson: KBLesson) => string | undefined,
): boolean {
  const top = ranked[0];
  if (!top || top.score < KB_CONFIDENT_SCORE) return false;
  const unit = unitOf(top.lesson);
  if (!unit) return false;
  return ranked
    .slice(1)
    .filter(r => r.score * CONFIDENT_MARGIN > top.score)
    .every(r => unitOf(r.lesson) === unit);
}

/**
 * The lesson a chat-made material is built on, or `null` for none (the typed
 * topic, labelled as not from the book).
 *
 *  1. a lesson tapped this turn — a chip or the sheet — always;
 *  2. none, when the teacher chose «على موضوعي كما كتبته»;
 *  3. the topic search's top hit, when it holds the topic (`strong`);
 *  4. else a search result for the whole message — in scope, and, when the
 *     teacher typed a topic, one the topic search also finds. «اختبار عن الخلية»
 *     with a grade 10 lesson picked kept grade 10 maths «الاقتران العكسي» from
 *     the whole-message search (it matched «اختبار») and made a maths quiz
 *     titled «الخلية»;
 *  5. else the card's lesson for a bare ask («خطة»).
 *
 * Uploads without a hard pin build on the files, not a lesson.
 */
export function chooseArtifactLesson(opts: {
  pinned: KBLesson | null;
  asTyped: boolean;
  topicRanked: KBScoredLesson[];
  strong: boolean;
  results: KBLesson[];
  inScope: (lesson: KBLesson) => boolean;
  /** The topic the teacher typed, '' when none (a bare ask, a refinement). */
  typedTopic: string;
  documentsFirst: boolean;
  softLesson: KBLesson | null;
}): KBLesson | null {
  if (opts.pinned) return opts.pinned;
  if (opts.asTyped) return null;
  if (opts.strong && opts.topicRanked[0]) return opts.topicRanked[0].lesson;
  if (opts.documentsFirst) return null;
  const supported = (lesson: KBLesson) =>
    !opts.typedTopic
    || opts.topicRanked.some(r => r.lesson.id === lesson.id && r.score >= KB_SUGGEST_SCORE);
  return opts.results.find(l => opts.inScope(l) && supported(l)) ?? opts.softLesson ?? null;
}
