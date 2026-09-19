/**
 * ⌘K command list and its search.
 *
 * Run:
 *   node --experimental-strip-types --test \
 *     artifacts/mobile/services/__tests__/commandPalette.test.ts
 *
 * Covers:
 *  1. Lesson commands lead, and the lesson-scoped ones only exist when a
 *     lesson is picked.
 *  2. Only tabs the caller passed are offered — the palette must not be a way
 *     around the role gating that hides iQra and Tools from a parent.
 *  3. Search matches every typed word in any order, across label and hint.
 *  4. Arabic written with or without diacritics finds the same command.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { buildCommands, filterCommands, type NavEntry } from '../commandPalette.ts';

const NAV: NavEntry[] = [
  { name: 'index', label: 'اليوم', icon: 'home' },
  { name: 'curriculum', label: 'المنهاج', icon: 'library' },
];

const WORKFLOW = [
  {
    tools: [
      { id: 'worksheet', titleKey: 'wsTitle', descKey: 'wsDesc', icon: 'document', color: '#000', route: '/ai-tools/worksheet' },
      { id: 'quiz', titleKey: 'qzTitle', descKey: 'qzDesc', icon: 'checkbox', color: '#000', route: '/ai-tools/quiz' },
      { id: 'geogebra', titleKey: 'ggTitle', descKey: 'ggDesc', icon: 'calculator', color: '#000' },
    ],
  },
];

const T: Record<string, string> = {
  wsTitle: 'ورقة عمل',
  wsDesc: 'أسئلة تدريب مطبوعة لدرس الرياضيات',
  qzTitle: 'اختبار قصير',
  qzDesc: 'اختبار من عشر دقائق',
  ggTitle: 'الرسم البياني',
  ggDesc: 'يفتح جيوجبرا',
};

const LESSON_PARAMS = { topic: 'تركيب الاقترانات', gradeIdx: '0', subjectIdx: '1' };

function build(lessonTopic?: string | null) {
  return buildCommands({
    lang: 'ar',
    nav: NAV,
    lessonTopic,
    lessonParams: lessonTopic ? LESSON_PARAMS : undefined,
    t: k => T[k] ?? k,
    workflow: WORKFLOW,
  });
}

describe('buildCommands', () => {
  it('offers lesson actions first when a lesson is picked', () => {
    const cmds = build('تركيب الاقترانات');
    assert.deepEqual(cmds.slice(0, 3).map(c => c.id), [
      'lesson:ask',
      'lesson:start-class',
      'lesson:change',
    ]);
  });

  it('drops the lesson-scoped actions when nothing is picked', () => {
    const ids = build(null).map(c => c.id);
    assert.ok(!ids.includes('lesson:ask'));
    assert.ok(!ids.includes('lesson:start-class'));
    // Changing the lesson is how you get one, so it always stays.
    assert.ok(ids.includes('lesson:change'));
  });

  it('offers only the tabs it was given', () => {
    const navIds = build(null).filter(c => c.kind === 'navigate').map(c => c.id);
    assert.deepEqual(navIds, ['nav:index', 'nav:curriculum']);
  });

  it('pins every tool to the lesson’s own grade and subject', () => {
    // The whole point: a tool opened from here must not fall back to
    // subjectIdx 0 and generate the first subject's material.
    const quiz = build('تركيب الاقترانات').find(c => c.id === 'tool:quiz');
    assert.deepEqual(quiz?.routeParams, LESSON_PARAMS);
  });

  it('lets a tool’s own params win over the lesson’s', () => {
    const cmds = buildCommands({
      lang: 'ar',
      nav: [],
      lessonTopic: 'درس',
      lessonParams: { subjectIdx: '1', topic: 'درس' },
      t: k => T[k] ?? k,
      workflow: [{ tools: [{ ...WORKFLOW[0]!.tools[0]!, routeParams: { subjectIdx: '4' } }] }],
    });
    assert.equal(cmds.find(c => c.kind === 'tool')?.routeParams?.subjectIdx, '4');
  });

  it('routes the landing tab at "/" and skips tools with no route', () => {
    const cmds = build(null);
    assert.equal(cmds.find(c => c.id === 'nav:index')?.route, '/');
    assert.equal(cmds.find(c => c.id === 'tool:geogebra'), undefined);
  });
});

describe('filterCommands', () => {
  const cmds = build('تركيب الاقترانات');

  it('returns everything for an empty query', () => {
    assert.equal(filterCommands(cmds, '   ').length, cmds.length);
  });

  it('matches words in any order, across label and hint', () => {
    const hits = filterCommands(cmds, 'رياضيات ورقة').map(c => c.id);
    assert.deepEqual(hits, ['tool:worksheet']);
  });

  it('ignores diacritics and alef shape', () => {
    const hits = filterCommands(cmds, 'إختبار').map(c => c.id);
    assert.ok(hits.includes('tool:quiz'));
  });

  it('ranks a label match above a hint-only match', () => {
    const hits = filterCommands(cmds, 'اختبار').map(c => c.id);
    assert.equal(hits[0], 'tool:quiz');
  });

  it('finds a tool by its english id', () => {
    assert.deepEqual(filterCommands(cmds, 'worksheet').map(c => c.id), ['tool:worksheet']);
  });

  it('returns nothing for a query that matches nothing', () => {
    assert.deepEqual(filterCommands(cmds, 'zzzz'), []);
  });
});
