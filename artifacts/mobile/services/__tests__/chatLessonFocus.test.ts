/**
 * The selected lesson stays put; the conversation follows the teacher.
 *
 * Reported 2026-11-21: «chat keeps changing the topic». A question that matched
 * another lesson confidently used to hard-pin that lesson as the chat's lesson,
 * so the chat's card moved while the top bar and the sidebar still named the
 * lesson the teacher had picked, and the next questions were pulled to the new
 * one. The lesson the conversation is on is now its own field
 * (`ChatSessionMemory.conversation`); the selected lesson changes only when the
 * teacher picks one (the sheet, a deep link from a lesson, «إلغاء التثبيت»).
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { commitConversation, conversationLessonId, conversationView, leaveLesson, leavesLesson } from '../chatLessonFocus.ts';
import { pinLesson } from '../lessonCopilot.ts';
import { emptyChatSessionMemory, hasGeneratedResource, recordGeneratedResource, type ChatSessionMemory } from '../ai/teachingAssistant.ts';
import { getLessonById } from '../knowledgeBase.ts';

const picked = getLessonById('kbl-math-s2-nccd-u5_l3')!; // تركيب الاقترانات
const other = getLessonById(
  // any other real lesson: the first one whose id differs
  'kbl-math-s2-nccd-u5_l1',
) ?? (() => { throw new Error('fixture lesson missing'); })();

const selected = (pin: 'soft' | 'hard' = 'hard'): ChatSessionMemory =>
  pinLesson(emptyChatSessionMemory(), picked, pin);

describe('conversationView / commitConversation', () => {
  it('with no conversation of its own, the view is the selected lesson', () => {
    const m = selected();
    const v = conversationView(m);
    assert.equal(v.activeLessonId, picked.id);
    assert.equal(v.lessonPin, 'hard');
    assert.equal(conversationLessonId(m), picked.id);
  });

  it('an answer about another lesson moves the conversation, not the selected lesson', () => {
    const prev = selected();
    const next = commitConversation(prev, pinLesson(conversationView(prev), other, 'hard'));
    assert.equal(next.activeLessonId, picked.id, 'the card and the bar keep the picked lesson');
    assert.equal(next.activeTopicAr, picked.titleAr);
    assert.equal(next.lessonPin, 'hard');
    assert.equal(conversationLessonId(next), other.id, 'a follow-up is about the last answer');
    const v = conversationView(next);
    assert.equal(v.activeLessonId, other.id);
    assert.equal(v.activeTopicAr, other.titleAr);
    assert.equal(v.lessonPin, 'hard');
  });

  it('keeps following that lesson while later turns stay on it', () => {
    const prev = commitConversation(selected(), pinLesson(conversationView(selected()), other, 'hard'));
    const again = commitConversation(prev, { ...conversationView(prev), recentQueries: ['x'] });
    assert.equal(again.activeLessonId, picked.id);
    assert.equal(conversationLessonId(again), other.id);
    assert.deepEqual(again.recentQueries, ['x']);
  });

  it('returning to the picked lesson clears the conversation and may firm up a soft pin', () => {
    const prev = commitConversation(selected('soft'), pinLesson(conversationView(selected('soft')), other, 'hard'));
    const back = commitConversation(prev, pinLesson(conversationView(prev), picked, 'hard'));
    assert.equal(back.activeLessonId, picked.id);
    assert.equal(back.lessonPin, 'hard');
    assert.equal(back.conversation ?? null, null);
  });

  it('«خلينا نتكلم عن…» leaves the lesson for the conversation only', () => {
    const prev = selected();
    const next = commitConversation(prev, { ...conversationView(prev), lessonPin: 'none' });
    assert.equal(next.activeLessonId, picked.id);
    assert.equal(next.lessonPin, 'hard', 'the selected lesson is not unpinned by a sentence');
    assert.equal(conversationLessonId(next), null);
    assert.equal(conversationView(next).lessonPin, 'none');
  });

  it('a lesson the teacher has cleared stays cleared', () => {
    const prev = { ...selected(), lessonPin: 'none' as const };
    const next = commitConversation(prev, { ...conversationView(prev), recentQueries: ['x'] });
    assert.equal(next.lessonPin, 'none');
    assert.equal(next.conversation ?? null, null);
  });

  it('material made on another lesson does not tick the picked lesson’s preparation', () => {
    const prev = { ...selected(), prepLessonId: picked.id, prepCompleted: [], lastCompletedPrepStep: null };
    const view = pinLesson(conversationView(prev), other, 'hard');
    const next = commitConversation(prev, {
      ...view, prepLessonId: other.id, prepCompleted: ['worksheet'], lastCompletedPrepStep: 'worksheet',
    } as ChatSessionMemory);
    assert.equal(next.prepLessonId, picked.id);
    assert.deepEqual(next.prepCompleted, []);
    assert.equal(next.lastCompletedPrepStep, null);
  });

  it('picking a lesson (the sheet, a deep link) starts the conversation on it', () => {
    const moved = commitConversation(selected(), pinLesson(conversationView(selected()), other, 'hard'));
    const repicked = pinLesson(moved, other, 'hard');
    assert.equal(repicked.activeLessonId, other.id);
    assert.equal(repicked.conversation ?? null, null);
    assert.equal(conversationLessonId(repicked), other.id);
  });
});

describe('review findings, 2026-11-21', () => {
  it('a material made on the conversation’s lesson does not count as done for the picked one', () => {
    const prev = commitConversation(selected(), pinLesson(conversationView(selected()), other, 'hard'));
    const next = commitConversation(prev, recordGeneratedResource(conversationView(prev), 'worksheet'));
    assert.equal(hasGeneratedResource(next, 'worksheet'), false, 'the card and starter chips read the picked lesson');
    assert.equal(next.lastGeneratedResource, null, '«اجعله أصعب» from a starter chip is not about the other lesson');
    assert.equal(hasGeneratedResource(conversationView(next), 'worksheet'), true, 'the conversation remembers it');
    assert.equal(conversationView(next).lastGeneratedResource, 'worksheet');
  });

  it('returning to the picked lesson brings back its own record', () => {
    const prev = commitConversation(selected(), pinLesson(conversationView(selected()), other, 'hard'));
    const made = commitConversation(prev, recordGeneratedResource(conversationView(prev), 'quiz'));
    const back = commitConversation(made, pinLesson(conversationView(made), picked, 'hard'));
    assert.equal(back.conversation ?? null, null);
    assert.equal(hasGeneratedResource(back, 'quiz'), false);
  });

  it('a lesson the teacher cleared and the conversation returns to is followed', () => {
    const cleared = { ...selected(), lessonPin: 'none' as const };
    const next = commitConversation(cleared, pinLesson(conversationView(cleared), picked, 'hard'));
    assert.equal(next.lessonPin, 'none', 'still cleared on the card');
    assert.equal(conversationLessonId(next), picked.id);
    assert.equal(conversationView(next).lessonPin, 'hard');
  });

  it('leaveLesson: the conversation leaves the lesson for a topic nothing pinned', () => {
    const prev = selected();
    const next = commitConversation(prev, leaveLesson(conversationView(prev)));
    assert.equal(conversationLessonId(next), null);
    assert.equal(next.activeLessonId, picked.id);
  });
});

describe('leavesLesson', () => {
  const base = { pinnedThisTurn: false, groundsOnActive: false, movesToLesson: false, intent: 'teaching' };
  it('a question on its own topic that pinned nothing leaves the lesson', () => {
    assert.equal(leavesLesson({ ...base, query: 'اشرح لي المتجهات' }), true);
  });
  it('a follow-up, a refinement, or a turn on the lesson does not', () => {
    assert.equal(leavesLesson({ ...base, query: 'أعطني أمثلة عليه' }), false);
    assert.equal(leavesLesson({ ...base, query: 'اجعله أقصر', intent: 'refinement' }), false);
    assert.equal(leavesLesson({ ...base, query: 'اشرح تركيب الاقترانات', groundsOnActive: true }), false);
    assert.equal(leavesLesson({ ...base, query: 'اشرح قانون جيب التمام', movesToLesson: true }), false);
    assert.equal(leavesLesson({ ...base, query: 'اشرح لي المتجهات', pinnedThisTurn: true }), false);
  });
});
