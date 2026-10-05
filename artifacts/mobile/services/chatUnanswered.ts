/**
 * `chat_unanswered`: a turn where the chat asked the teacher back, or gave up,
 * instead of answering.
 *
 * Dead ends used to reach us one screenshot at a time («علمني» → «وضّح لي
 * أكثر»). This makes them countable — how often, which question, with or
 * without a lesson open — and, for short messages, which words caused them.
 *
 * Privacy (decided 2026-10-05): the teacher's words are sent only when the
 * message is 4 words or fewer, with digits, emails, handles and links masked.
 * A dead end is almost always short; a long message, the kind that could name
 * a student, sends only its length — as `feature_suggested` does.
 *
 * Pure TypeScript, no React Native: the screen calls `trackEvent` with these
 * props, and `node --test` can check what would be sent.
 */
import type { AnalyticsProps } from './analytics';

export type UnansweredKind =
  /** «وضّح لي أكثر: هل تريد شرح مفهوم، أم تحضير مادة؟» */
  | 'generic'
  /** «تريد أن أشرح «…»، أم أحضّر له مادة؟» — the same, with a lesson open. */
  | 'lesson_named'
  /** «ماذا نتعلّم؟» — a bare «علمني» with nothing open. */
  | 'which_lesson_bare'
  /** «أي درس أو مادة تريد أن نعدّل فيها؟» — a refinement with nothing to refine. */
  | 'refine_target'
  /** «أيّ مادة تقصد؟» with subject chips. */
  | 'which_subject'
  /** «هل تقصد…؟» / «أي درس؟» with lesson chips — a guessed lesson to confirm. */
  | 'did_you_mean'
  /** «أي درس من الرياضيات للصف العاشر؟» — subject and grade known, lesson not. */
  | 'which_lesson_in_scope'
  /** A material asked for with no topic («خطة»). */
  | 'artifact_topic'
  /** «وضّح لي أكثر: ما المادة والدرس؟» — a second vague reply to a clarify. */
  | 'tell_more'
  /** Nothing in the curriculum matched; topic suggestions offered instead. */
  | 'out_of_scope';

const MAX_WORDS = 4;
const MAX_CHARS = 60;

/**
 * The teacher's message as it may be sent, or undefined when it may not.
 * The 4-word limit counts what the teacher typed; masking happens after.
 */
export function askSample(text: string): string | undefined {
  const t = text.trim().replace(/\s+/g, ' ');
  if (!t) return undefined;
  if (t.split(' ').length > MAX_WORDS || t.length > MAX_CHARS) return undefined;
  return t
    .replace(/https?:\/\/\S+|www\.\S+/gi, 'url')
    .replace(/\S+@\S+\.\S+/g, '@')
    .replace(/@\w+/g, '@')
    .replace(/[0-9٠-٩۰-۹]+/g, '#');
}

export function unansweredEventProps(input: {
  kind: UnansweredKind;
  query: string;
  lang: 'ar' | 'en';
  /** A lesson was on the chat's card when this happened. */
  lessonOpen: boolean;
}): AnalyticsProps {
  const t = input.query.trim().replace(/\s+/g, ' ');
  const props: AnalyticsProps = {
    kind: input.kind,
    lang: input.lang,
    lessonOpen: input.lessonOpen,
    words: t ? t.split(' ').length : 0,
    chars: t.length,
  };
  const ask = askSample(input.query);
  if (ask !== undefined) props.ask = ask;
  return props;
}
