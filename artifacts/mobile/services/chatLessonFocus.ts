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
import type { ChatSessionMemory } from './ai/teachingAssistant.ts';

/** The lesson follow-ups are about: the conversation's, else the selected one. */
export function conversationLessonId(memory: ChatSessionMemory): string | null {
  if (memory.conversation) return memory.conversation.lessonId;
  return memory.lessonPin === 'none' ? null : memory.activeLessonId;
}

/** The memory as the chat pipeline should read it this turn. */
export function conversationView(memory: ChatSessionMemory): ChatSessionMemory {
  const conv = memory.conversation;
  if (!conv) return memory;
  if (conv.lessonId === null) return { ...memory, lessonPin: 'none' };
  const lesson = getLessonById(conv.lessonId);
  if (!lesson) return memory;
  return {
    ...memory,
    activeLessonId: lesson.id,
    activeTopicAr: lesson.titleAr,
    activeTopicEn: lesson.titleEn,
    lessonPin: 'hard',
  };
}

/**
 * Write a pipeline's update of the VIEW back to the real memory: everything it
 * changed is kept, except that a lesson change lands on the conversation and
 * the selected lesson stays as it was.
 */
export function commitConversation(prev: ChatSessionMemory, next: ChatSessionMemory): ChatSessionMemory {
  const selectedId = prev.activeLessonId;
  const selectedPinned = prev.lessonPin !== 'none';

  let conversation: ChatSessionMemory['conversation'];
  if (next.lessonPin === 'none') {
    // Left the lesson for the conversation — unless the teacher had already
    // cleared the selected one, in which case there is nothing to leave.
    conversation = selectedPinned ? { lessonId: null } : null;
  } else if (next.activeLessonId && next.activeLessonId !== selectedId) {
    conversation = { lessonId: next.activeLessonId };
  } else if (next.activeLessonId && next.activeLessonId === selectedId) {
    conversation = null;
  } else {
    conversation = prev.conversation ?? null;
  }

  // Back on the selected lesson: the conversation may firm up its pin (a soft,
  // restored lesson the teacher has now asked about), never loosen it.
  const backOnSelected = !!selectedId && next.activeLessonId === selectedId && next.lessonPin !== 'none';
  const lessonPin = backOnSelected && selectedPinned && next.lessonPin === 'hard' ? 'hard' : prev.lessonPin;

  // Preparation belongs to the selected lesson: material made for another one
  // does not tick its checklist.
  const prep = conversation
    ? {
      prepLessonId: prev.prepLessonId,
      prepCompleted: prev.prepCompleted,
      lastCompletedPrepStep: prev.lastCompletedPrepStep,
    }
    : {};

  return {
    ...next,
    ...prep,
    activeLessonId: prev.activeLessonId,
    activeTopicAr: prev.activeTopicAr,
    activeTopicEn: prev.activeTopicEn,
    lessonPin,
    conversation,
  };
}
