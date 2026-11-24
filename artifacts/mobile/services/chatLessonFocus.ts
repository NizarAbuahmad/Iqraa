/**
 * Two lessons, kept apart: the one the teacher SELECTED, and the one the
 * CONVERSATION is on.
 *
 * The selected lesson (`ChatSessionMemory.activeLessonId`) is what the chat's
 * card, the top lesson bar, Today and the tools name. It changes only when the
 * teacher picks a lesson: the change-lesson sheet (which also saves the
 * app-wide pick), arriving from a lesson page, or «إلغاء التثبيت».
 *
 * The conversation follows what the teacher asks. Until 2026-11-21 the chat's
 * pipeline hard-pinned whichever lesson a question matched as the selected
 * lesson, so the chat's card moved while the top bar and the sidebar still named
 * the lesson the teacher had picked, and the next questions were pulled to the
 * new one: «chat keeps changing the topic». Now `sendMessage` reads the memory
 * through `conversationView` — the conversation's lesson in the
 * `activeLessonId` slot, so follow-ups («ورقة عمل عليه», «اجعله أقصر») are about
 * the last answer — and writes it back through `commitConversation`, which
 * keeps the selected lesson and moves only the conversation.
 *
 * Pure, so `chatLessonFocus.test.ts` pins it; `iqra.tsx` does the wiring.
 */
import { getLessonById } from './knowledgeBase.ts';
import { topicFromQuery } from './ai/artifactTopic.ts';
import type { ChatSessionMemory } from './ai/teachingAssistant.ts';

/**
 * What was made and discussed, kept per lesson: the card and the starter chips
 * read the picked lesson's (`hasGeneratedResource`, `lastGeneratedResource`),
 * so a worksheet made while the conversation was on another lesson must not
 * tick it, and «اجعل الاختبار أصعب» on a starter chip must not refine a quiz
 * made for another lesson.
 */
const RECORD_KEYS = [
  'generatedResources', 'discussedArtifacts', 'lastGeneratedResource',
  'prepLessonId', 'prepCompleted', 'lastCompletedPrepStep',
] as const;
export type ConversationRecord = Pick<ChatSessionMemory, typeof RECORD_KEYS[number]>;

function recordOf(m: ChatSessionMemory): ConversationRecord {
  return {
    generatedResources: m.generatedResources,
    discussedArtifacts: m.discussedArtifacts,
    lastGeneratedResource: m.lastGeneratedResource,
    prepLessonId: m.prepLessonId,
    prepCompleted: m.prepCompleted,
    lastCompletedPrepStep: m.lastCompletedPrepStep,
  };
}

/** The lesson follow-ups are about: the conversation's, else the selected one. */
export function conversationLessonId(memory: ChatSessionMemory): string | null {
  if (memory.conversation) return memory.conversation.lessonId;
  return memory.lessonPin === 'none' ? null : memory.activeLessonId;
}

/** The memory as the chat pipeline should read it this turn. */
export function conversationView(memory: ChatSessionMemory): ChatSessionMemory {
  const conv = memory.conversation;
  if (!conv) return memory;
  const withRecord = conv.record ? { ...memory, ...conv.record } : memory;
  if (conv.lessonId === null) return { ...withRecord, lessonPin: 'none' };
  const lesson = getLessonById(conv.lessonId);
  if (!lesson) return withRecord;
  return {
    ...withRecord,
    activeLessonId: lesson.id,
    activeTopicAr: lesson.titleAr,
    activeTopicEn: lesson.titleEn,
    lessonPin: 'hard',
  };
}

/** The conversation leaves the lesson it was on (write through `commitConversation`). */
export function leaveLesson(view: ChatSessionMemory): ChatSessionMemory {
  return { ...view, lessonPin: 'none' };
}

/**
 * Whether this turn takes the conversation off the lesson it was on: a message
 * that names a topic of its own, that nothing grounded on that lesson and that
 * moved the conversation to no other lesson. «اشرح لي المتجهات» with
 * «تركيب الاقترانات» picked is such a turn (vectors are not a confident hit), and
 * without leaving, the next «أعطني أمثلة عليه» was about «تركيب الاقترانات».
 */
export function leavesLesson(t: {
  query: string;
  intent: string;
  /** The send carried a lesson (a chip, the sheet, a deep link). */
  pinnedThisTurn: boolean;
  /** `activeLessonReuse` said `ground`. */
  groundsOnActive: boolean;
  /** A confident hit moves the conversation to another lesson this turn. */
  movesToLesson: boolean;
}): boolean {
  if (t.pinnedThisTurn || t.groundsOnActive || t.movesToLesson) return false;
  if (t.intent === 'refinement') return false;
  return topicFromQuery(t.query) !== '';
}

/**
 * Write a pipeline's update of the VIEW back to the real memory: everything it
 * changed is kept, except that a lesson change lands on the conversation, the
 * selected lesson stays as it was, and while the conversation is elsewhere what
 * it makes is kept on the conversation, not on the selected lesson.
 */
export function commitConversation(prev: ChatSessionMemory, next: ChatSessionMemory): ChatSessionMemory {
  const selectedId = prev.activeLessonId;
  const selectedPinned = prev.lessonPin !== 'none';

  let lessonId: string | null | undefined; // undefined: back on the selected lesson
  if (next.lessonPin === 'none') {
    // Left the lesson for the conversation — unless the teacher had already
    // cleared the selected one, in which case there is nothing to leave.
    lessonId = selectedPinned ? null : undefined;
  } else if (next.activeLessonId && next.activeLessonId !== selectedId) {
    lessonId = next.activeLessonId;
  } else if (next.activeLessonId && next.activeLessonId === selectedId) {
    // A lesson the teacher cleared stays cleared on the card; the conversation
    // may still be on it.
    lessonId = selectedPinned ? undefined : next.activeLessonId;
  } else {
    lessonId = prev.conversation ? prev.conversation.lessonId : undefined;
  }

  // Back on the selected lesson: the conversation may firm up its pin (a soft,
  // restored lesson the teacher has now asked about), never loosen it.
  const backOnSelected = lessonId === undefined && !!selectedId && next.activeLessonId === selectedId;
  const lessonPin = backOnSelected && selectedPinned && next.lessonPin === 'hard' ? 'hard' : prev.lessonPin;

  if (lessonId === undefined) {
    // On the selected lesson: its record is the one the view just wrote,
    // unless the view was reading the conversation's (then keep the selected's).
    const record = prev.conversation ? recordOf(prev) : recordOf(next);
    return {
      ...next,
      ...record,
      activeLessonId: prev.activeLessonId,
      activeTopicAr: prev.activeTopicAr,
      activeTopicEn: prev.activeTopicEn,
      lessonPin,
      conversation: null,
    };
  }
  return {
    ...next,
    // The selected lesson's record stays as it was.
    ...recordOf(prev),
    activeLessonId: prev.activeLessonId,
    activeTopicAr: prev.activeTopicAr,
    activeTopicEn: prev.activeTopicEn,
    lessonPin,
    conversation: { lessonId, record: recordOf(next) },
  };
}
