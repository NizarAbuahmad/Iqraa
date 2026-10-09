import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { ExternalResource, VirtualLabSheet } from '@workspace/curriculum';
import { hasLabSheetMessage, virtualLabChatMessage, virtualLabFor, virtualLabSavePayload, virtualLabWorksheet } from '../virtualLab.ts';
import { buildLessonSuggestions, pinLesson } from '../lessonCopilot.ts';
import { emptyChatSessionMemory } from '../ai/teachingAssistant.ts';
import { getLessonById } from '../knowledgeBase.ts';

const sim: ExternalResource = {
  id: 'phet-test', lessonIds: ['kbl-chem-s1-nccd-u1_lab'], gradeIds: ['grade-10'], subjectId: 'chemistry',
  kind: 'simulation', titleEn: 'Test', titleAr: 'تجربة', provider: 'phet', license: 'CC-BY-NC-4.0',
  licenseUrl: 'https://phet.colorado.edu/en/licensing', sourceUrl: 'https://phet.colorado.edu/sims/html/x/latest/x_ar.html',
  attribution: 'PhET Interactive Simulations, University of Colorado Boulder — phet.colorado.edu',
  licenseCheckedAt: '2026-10-06', authority: 'third-party',
};
const sheet: VirtualLabSheet = {
  lessonId: 'kbl-chem-s1-nccd-u1_lab', resourceId: 'phet-test', aimAr: 'هدف',
  predict: ['توقّع'], procedure: ['خطوة'], observe: ['لاحظ'], explain: ['فسّر', 'فسّر ثانيًا'],
  teacherKey: { predict: ['ج'], observe: ['ج'], explain: ['ج', 'ج'] },
};

describe('virtualLabWorksheet', () => {
  const ws = virtualLabWorksheet(sheet, sim, 'تجربة استهلالية: الطيف الذري');
  it('is titled as a virtual lab on its lesson', () => {
    assert.equal(ws.title, 'مختبر افتراضي: تجربة استهلالية: الطيف الذري');
  });
  it('puts the aim in the instructions', () => assert.equal(ws.instructions, sheet.aimAr));
  it('asks predict, observe, explain, in that order', () => {
    assert.deepEqual(ws.sections.map(s => s.title), ['أتوقّع', 'ألاحظ', 'أفسّر']);
    assert.ok(ws.sections.every(s => s.type === 'short_answer'));
    assert.deepEqual(ws.sections[2]!.questions.map(q => q.text), sheet.explain);
  });
  it('numbers the key to match the questions across sections', () => {
    assert.deepEqual(ws.answerKey.map(k => k.num), [1, 2, 3, 4]);
    assert.deepEqual(ws.answerKey.map(k => k.answer), ['ج', 'ج', 'ج', 'ج']);
  });
  it('carries the link, credit and steps, never anything to embed', () => {
    assert.deepEqual(ws.lab, { url: sim.sourceUrl, simName: sim.titleAr, attribution: sim.attribution, steps: sheet.procedure });
  });
  it('gives each question one point', () => {
    assert.ok(ws.sections.flatMap(s => s.questions).every(q => q.points === 1));
  });
});

describe('virtualLabFor', () => {
  // An ordinary lesson, so this stays true after the lab sheets ship and are reviewed.
  it('finds nothing on a lesson with no lab', () => {
    assert.equal(virtualLabFor('kbl-math-s2-nccd-u5_l4', { dev: true }), null);
  });
});

describe('virtualLabSavePayload', () => {
  const ws = virtualLabWorksheet(sheet, sim, 'الطيف الذري');
  const p = virtualLabSavePayload(ws, sheet.lessonId, { topic: 'الطيف الذري', subjectLabel: 'الكيمياء', gradeName: 'الصف العاشر' });
  it('files it as a worksheet, marked as a virtual lab, on its lesson', () => {
    assert.equal(p.type, 'worksheet');
    assert.equal(p.formState.lessonId, sheet.lessonId);
    assert.equal(p.formState.materialKind, 'virtual-lab');
  });
  it('carries the lesson title in formState too, which is what an edit route reads', () => {
    // «تعديل» is hidden for these, but anything that does reopen one reads
    // `topic` from formState — without it the worksheet screen falls back to
    // the teacher's default scope and re-files the sheet under the wrong subject.
    assert.equal(p.formState.topic, 'الطيف الذري');
  });
  it('keeps the lab block in what it stores', () => {
    assert.deepEqual(JSON.parse(p.content).lab, ws.lab);
  });
  it('labels it with the lesson, subject and grade', () => {
    assert.deepEqual([p.title, p.topic, p.subject, p.grade, p.language], [ws.title, 'الطيف الذري', 'الكيمياء', 'الصف العاشر', 'ar']);
  });
});

describe('the virtual lab chip', () => {
  const lab = getLessonById('kbl-chem-s1-nccd-u1_lab')!;
  const onLab = pinLesson(emptyChatSessionMemory(), lab, 'hard');
  const released = { ...sheet, reviewedBy: 'أ. معلم', reviewedAt: '2026-10-10' };
  it('leads the chips on a lab lesson with a released sheet', () => {
    const chips = buildLessonSuggestions(onLab, 'ar', false, {}, { labs: [released] });
    assert.equal(chips[0]!.action, 'virtual-lab');
    assert.equal(chips[0]!.lessonId, lab.id);
  });
  it('is absent while the sheet is unreviewed', () => {
    assert.ok(!buildLessonSuggestions(onLab, 'ar', false, {}, { labs: [sheet] }).some(c => c.action === 'virtual-lab'));
  });
  it('is absent on an ordinary lesson', () => {
    const other = pinLesson(emptyChatSessionMemory(), getLessonById('kbl-math-s2-nccd-u5_l4')!, 'hard');
    assert.ok(!buildLessonSuggestions(other, 'ar', false, {}, { labs: [released] }).some(c => c.action === 'virtual-lab'));
  });
});

describe('virtualLabChatMessage', () => {
  const m = virtualLabChatMessage(sheet, sim, { topic: 'الطيف الذري', subjectLabel: 'الكيمياء', gradeName: 'الصف العاشر' });
  it('is a worksheet message that carries the lab', () => {
    assert.equal(m.data.kind, 'worksheet');
    assert.equal(m.data.worksheet.lab?.url, sim.sourceUrl);
  });
  it('puts the link and the credit in the conversation around it', () => {
    assert.ok(m.prose.includes(sim.sourceUrl) && m.prose.includes(sim.attribution));
  });
});

/**
 * The lab chip stays on screen after it is tapped, so every further tap used to
 * append the same sheet again. The chat checks for it first.
 */
describe('hasLabSheetMessage', () => {
  const ctx = { topic: 'تجربة استهلالية: المعادلة الكيميائية', subjectLabel: 'الكيمياء', gradeName: 'الصف العاشر' };
  const m = virtualLabChatMessage(sheet, sim, ctx);
  const labMsg = { curriculumLessonId: sheet.lessonId, artifactData: m.data };

  it('finds the sheet already posted for that lesson', () => {
    assert.equal(hasLabSheetMessage([{}, labMsg], sheet.lessonId), true);
  });
  it('ignores another lesson, and an ordinary worksheet for the same lesson', () => {
    assert.equal(hasLabSheetMessage([labMsg], 'kbl-chem-s2-nccd-u4_lab'), false);
    const plain = { curriculumLessonId: sheet.lessonId, artifactData: { kind: 'worksheet' as const, worksheet: { ...m.data.worksheet, lab: undefined } } };
    assert.equal(hasLabSheetMessage([plain], sheet.lessonId), false);
  });
  it('is false on an empty thread', () => {
    assert.equal(hasLabSheetMessage([], sheet.lessonId), false);
  });
});
