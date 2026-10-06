import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { ExternalResource, VirtualLabSheet } from '@workspace/curriculum';
import { virtualLabFor, virtualLabSavePayload, virtualLabWorksheet } from '../virtualLab.ts';

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
    assert.deepEqual(p.formState, { lessonId: sheet.lessonId, materialKind: 'virtual-lab' });
  });
  it('keeps the lab block in what it stores', () => {
    assert.deepEqual(JSON.parse(p.content).lab, ws.lab);
  });
  it('labels it with the lesson, subject and grade', () => {
    assert.deepEqual([p.title, p.topic, p.subject, p.grade, p.language], [ws.title, 'الطيف الذري', 'الكيمياء', 'الصف العاشر', 'ar']);
  });
});
