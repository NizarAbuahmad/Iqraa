/**
 * Chat material actions — save / file under a class / project.
 *
 * Run:
 *   node --experimental-strip-types --test \
 *     artifacts/mobile/services/__tests__/chatMaterialActions.test.ts
 *
 * Covers:
 *  1. Every artifact kind maps to a workspace type the viewer can render —
 *     `app/workspace/view.tsx` falls through to the quiz renderer, so saving
 *     an activity as type 'activity' would open a crash.
 *  2. What is stored is the generator output, so the viewer parses it back.
 *  3. Present is offered only where a deck actually exists.
 *  4. The decks chat builds are well-formed (intro first, consecutive numbers).
 *  5. Nothing chat projects claims a verified answer key — chat never runs
 *     the verifier, so every key here is unproven and must say so.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  canPresentArtifact,
  deckForArtifact,
  materialContentFor,
  materialFormStateFor,
  materialTypeFor,
} from '../chatMaterialActions.ts';
import type { ChatArtifactData } from '../ai/chatArtifacts.ts';
import type {
  ActivityOutput,
  LessonPlanOutput,
  QuizOutput,
  WorksheetOutput,
} from '../ai/AIService.ts';

const PLAN: LessonPlanOutput = {
  title: 'تركيب الاقترانات',
  grade: 'الصف العاشر',
  subject: 'Mathematics',
  duration: 45,
  objectives: ['أن يجد الطالب تركيب اقترانين'],
  materials: ['كتاب الطالب'],
  introduction: 'ابدأ بمراجعة الاقتران',
  mainActivity: 'اشرح التركيب خطوة بخطوة',
  guidedPractice: 'حل مثالين مع الطلبة',
  independentPractice: 'ورقة عمل فردية',
  closure: 'لخّص الفرق بين f∘g و g∘f',
  assessment: 'سؤال ختامي سريع',
  differentiation: 'أمثلة عددية للطلبة المتعثرين',
  homework: 'أوجد f∘g عند x=2',
};

const WORKSHEET: WorksheetOutput = {
  title: 'ورقة عمل: تركيب الاقترانات',
  instructions: 'أجب عن جميع الأسئلة',
  sections: [
    {
      type: 'short_answer',
      title: 'القسم الأول',
      questions: [
        { text: 'أوجد f∘g(2)', points: 1 },
        { text: 'أوجد g∘f(2)', points: 1 },
      ],
    },
  ],
  answerKey: [
    { num: 1, answer: '5' },
    { num: 2, answer: '9' },
  ],
};

const QUIZ: QuizOutput = {
  title: 'اختبار قصير',
  duration: 10,
  totalPoints: 2,
  questions: [
    {
      id: 'q1',
      text: 'ما تعريف التركيب؟',
      type: 'short_answer',
      points: 1,
      correctAnswer: 'f(g(x))',
      explanation: 'التركيب هو تطبيق الاقتران الداخلي ثم الخارجي',
    },
    {
      id: 'q2',
      text: 'أي مما يلي يساوي f∘g(2)؟',
      type: 'multiple_choice',
      points: 1,
      options: ['5', '9'],
      correctAnswer: '5',
      explanation: 'g(2)=2 ثم f(2)=5',
    },
  ],
};

const ACTIVITY: ActivityOutput = {
  title: 'نشاط تركيب الاقترانات',
  activityType: 'group',
  totalDuration: 15,
  objective: 'تطبيق التركيب في مواقف حياتية',
  groupSize: 'ثلاثيات',
  materials: ['بطاقات'],
  steps: [],
  teacherTips: ['وزّع البطاقات قبل البدء'],
  differentiation: 'بطاقات أبسط للمجموعة الأولى',
  assessment: 'ملاحظة أثناء العمل',
};

const KINDS: ChatArtifactData[] = [
  { kind: 'lesson-plan', plan: PLAN },
  { kind: 'worksheet', worksheet: WORKSHEET },
  { kind: 'quiz', quiz: QUIZ },
  { kind: 'activity', activity: ACTIVITY },
];

describe('materialTypeFor', () => {
  it('maps each artifact to the workspace type its renderer expects', () => {
    assert.equal(materialTypeFor('lesson-plan'), 'lesson');
    assert.equal(materialTypeFor('worksheet'), 'worksheet');
    assert.equal(materialTypeFor('quiz'), 'quiz');
  });

  it('never saves an activity as a type the workspace viewer would parse as a quiz', () => {
    // `app/workspace/view.tsx` has no 'activity' branch and falls through to
    // QuizView, which maps over `questions`. An ActivityOutput has none.
    assert.notEqual(materialTypeFor('activity'), 'quiz');
    assert.equal(materialTypeFor('activity'), 'lesson');
  });
});

describe('materialContentFor', () => {
  it('stores the generator output itself, so the viewer parses it back', () => {
    for (const data of KINDS) {
      const parsed = JSON.parse(JSON.stringify(materialContentFor(data)));
      assert.ok(parsed.title, `${data.kind} lost its title on the way to storage`);
    }
    assert.deepEqual(materialContentFor({ kind: 'quiz', quiz: QUIZ }), QUIZ);
    assert.deepEqual(materialContentFor({ kind: 'lesson-plan', plan: PLAN }), PLAN);
  });
});

describe('materialFormStateFor', () => {
  it('carries the topic, so re-opening a saved chat material is not a blank form', () => {
    assert.deepEqual(materialFormStateFor('تركيب الاقترانات'), { topic: 'تركيب الاقترانات' });
  });
});

describe('canPresentArtifact', () => {
  it('offers Present exactly where a deck can be built', () => {
    for (const data of KINDS) {
      const offered = canPresentArtifact(data);
      const deck = deckForArtifact(data, { topic: 'تركيب الاقترانات', isAr: true });
      assert.equal(
        offered,
        deck !== null,
        `${data.kind}: the button and the builder disagree`,
      );
    }
  });

  it('does not offer it for an activity — there is no ActivityOutput deck builder', () => {
    assert.equal(canPresentArtifact({ kind: 'activity', activity: ACTIVITY }), false);
  });
});

describe('deckForArtifact', () => {
  it('builds a well-formed deck for every presentable kind', () => {
    for (const data of KINDS.filter(canPresentArtifact)) {
      const deck = deckForArtifact(data, {
        topic: 'تركيب الاقترانات',
        isAr: true,
        subject: 'Mathematics',
        grade: 'الصف العاشر',
      });
      assert.ok(deck, `${data.kind} produced no deck`);
      assert.ok(deck!.slides.length > 0, `${data.kind} produced an empty deck`);
      assert.equal(deck!.slides[0]!.type, 'intro', `${data.kind} does not open on an intro`);
      deck!.slides.forEach((s, i) => {
        assert.equal(s.slideNumber, i + 1, `${data.kind} slide numbering is not consecutive`);
      });
    }
  });

  it('never claims a verified answer key — chat does not run the verifier', () => {
    for (const data of KINDS.filter(canPresentArtifact)) {
      const deck = deckForArtifact(data, { topic: 'تركيب الاقترانات', isAr: true });
      for (const slide of deck!.slides) {
        assert.notEqual(
          slide.verified,
          true,
          `${data.kind}: a chat-built slide badged an answer nothing checked`,
        );
      }
    }
  });
});
