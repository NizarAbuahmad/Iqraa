/**
 * Four defects from the Class Activity review that a teacher meets in the
 * first minute — each reproduced here before it was fixed.
 *
 *  1. The offline jigsaw told the class «groups of 4 … numbered 1–4» and then
 *     listed three tasks, because the generator drew three items and the
 *     blueprint mapped one item to one task.
 *  2. The blueprints carried literal `**bold**`, which every renderer on the
 *     activity path prints as asterisks (screen, PDF, Word, text).
 *  3. Rule bullets and numbered questions are separated by `\n`, and neither
 *     print stylesheet kept line breaks, so a game's rules ran together.
 *  4. The tools tab opened every tool with `topic` and `subjectIdx` only,
 *     leaving the grade to be guessed from a title that 107 grade 1–10
 *     lessons share.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { aiService } from '@/services/ai/generators.ts';
import { plainActivity, stripInlineMarkdown } from '@/services/ai/activityText.ts';
import { buildActivityHTML, buildActivitySlidesHTML } from '../exportHtml.ts';
import { pickPrefillParams, scopePickerParams, lessonPickerParams } from '../lessonPrep.ts';
import type { ActivityOutput, AIRequest } from '@/services/ai/AIService.ts';

const CASES = [
  { label: 'math / ar', topic: 'قانون الجيوب', subject: 'الرياضيات', language: 'arabic' as const },
  { label: 'chem / ar', topic: 'الروابط الأيونية', subject: 'الكيمياء', language: 'arabic' as const },
  { label: 'math / en', topic: 'Law of Sines', subject: 'Mathematics', language: 'english' as const },
  { label: 'chem / en', topic: 'Ionic bonds', subject: 'Chemistry', language: 'english' as const },
];
const TYPES = ['individual', 'group', 'discussion', 'hands-on', 'game'] as const;

const make = (c: typeof CASES[number], type: string) =>
  aiService.generateActivity({
    grade: 'الصف العاشر', duration: 30, topic: c.topic, subject: c.subject,
    language: c.language, activityType: type,
  } as AIRequest);

describe('the offline jigsaw lists as many tasks as it promises', () => {
  for (const c of CASES) {
    it(`${c.label}: four numbered tasks for four members`, async () => {
      const out = await make(c, 'group');
      const tasks = out.steps[0]!.description.split('\n').filter(l => /^[1-4]\. \S/.test(l));
      assert.equal(tasks.length, 4, out.steps[0]!.description);
    });
  }
});

describe('no activity shows literal markdown', () => {
  const strings = (v: unknown, acc: string[] = []): string[] => {
    if (typeof v === 'string') acc.push(v);
    else if (Array.isArray(v)) v.forEach(x => strings(x, acc));
    else if (v && typeof v === 'object') Object.values(v).forEach(x => strings(x, acc));
    return acc;
  };

  for (const c of CASES) {
    it(`${c.label}: no ** in any field of any type`, async () => {
      for (const type of TYPES) {
        const bad = strings(await make(c, type)).filter(s => s.includes('**'));
        assert.deepEqual(bad, [], `${type} still carries markdown`);
      }
    });
  }

  it('stripInlineMarkdown removes the markers and keeps the words and line breaks', () => {
    assert.equal(stripInlineMarkdown('يأخذ كل فرد **مهمة مختلفة** عن زملائه:\n1. أ'), 'يأخذ كل فرد مهمة مختلفة عن زملائه:\n1. أ');
    assert.equal(stripInlineMarkdown('a ** b'), 'a ** b'); // an unpaired marker is text, not markup
    assert.equal(stripInlineMarkdown('2 * 3 * 4'), '2 * 3 * 4'); // multiplication is not emphasis
  });

  it('plainActivity cleans live and reopened output alike, without touching its shape', () => {
    const live = {
      title: '**t**', activityType: 'group', totalDuration: 20, objective: 'x **y**', groupSize: '4',
      materials: ['**a**'], steps: [{ stepNumber: 1, title: '**s**', description: 'd **e**', durationMin: 5 }],
      teacherTips: ['**tip**'], differentiation: '**d**', assessment: '**a**',
    } as unknown as ActivityOutput;
    const out = plainActivity(live);
    assert.equal(out.title, 't');
    assert.equal(out.steps[0]!.description, 'd e');
    assert.equal(out.steps[0]!.durationMin, 5);
    assert.equal(out.totalDuration, 20);
    assert.deepEqual(out.materials, ['a']);
    assert.deepEqual(plainActivity(out), out); // idempotent
  });
});

describe('exported activities keep their line breaks', () => {
  const act = {
    title: 'نشاط', activityType: 'game', totalDuration: 20, objective: 'هدف', groupSize: '4',
    materials: ['ورق'],
    steps: [{ stepNumber: 1, title: 'خطوة', description: 'قاعدة 1\nقاعدة 2', durationMin: 5 }],
    teacherTips: ['نصيحة'], differentiation: 'تمايز', assessment: 'تقييم',
  } as unknown as ActivityOutput;
  const meta = { subject: 'الرياضيات', grade: 'العاشر' };
  const rule = /\.step-desc\s*\{[^}]*white-space:\s*pre-line/;

  it('the document keeps newlines in a step description', () => {
    assert.match(buildActivityHTML(act, 'نشاط', meta, true), rule);
  });

  it('the slides keep them too', () => {
    assert.match(buildActivitySlidesHTML(act, 'نشاط', meta, true), rule);
  });
});

describe('pickPrefillParams — what the tools tab sends with the teacher\'s current lesson', () => {
  const LESSON = 'kbl-math-s1-nccd-u1_l1';

  it('sends nothing without a lesson', () => {
    assert.deepEqual(pickPrefillParams(null, 'ar'), {});
    assert.deepEqual(pickPrefillParams({ topic: '' }, 'ar'), {});
  });

  it('carries the grade and subject of the picked lesson, not just its title', () => {
    const p = pickPrefillParams({ topic: 'x', lessonId: LESSON }, 'ar');
    assert.deepEqual(p, { topic: 'x', ...lessonPickerParams(LESSON, 'ar')! });
    assert.ok(p.gradeIdx !== undefined && p.subjectIdx !== undefined);
  });

  it('falls back to the pick\'s own grade and subject ids when it has no lesson (a unit pick)', () => {
    const expected = scopePickerParams('grade-10', 'chemistry')!;
    const p = pickPrefillParams({ topic: 'x', gradeId: 'grade-10', subjectId: 'chemistry' }, 'ar');
    assert.deepEqual(p, { topic: 'x', ...expected });
  });

  it('keeps the old subject-only behaviour for a pick saved before grades existed', () => {
    const p = pickPrefillParams({ topic: 'x', subjectId: 'chemistry' }, 'ar');
    assert.equal(p.topic, 'x');
    assert.ok(p.subjectIdx !== undefined);
    assert.equal(p.gradeIdx, undefined);
  });
});
