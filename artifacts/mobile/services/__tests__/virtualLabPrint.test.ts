import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { ExternalResource, VirtualLabSheet } from '@workspace/curriculum';
import { virtualLabWorksheet } from '../virtualLab.ts';
import { buildWorksheetHTML } from '../exportHtml.ts';
import { formatWorksheetText } from '../exportText.ts';
import { labQrSvg } from '../labQr.ts';

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

const meta = { subject: 'الكيمياء', grade: 'الصف العاشر' };
const ws = virtualLabWorksheet(sheet, sim, 'الطيف الذري');

describe('the printed virtual lab', () => {
  const student = buildWorksheetHTML(ws, ws.title, meta, true, [], false);
  const teacher = buildWorksheetHTML(ws, ws.title, meta, true, [], true);
  it('prints the link as text, so a photocopy still carries it', () => {
    assert.ok(student.includes(sim.sourceUrl));
  });
  it('prints a QR code of the same link', () => {
    assert.match(student, /<div class="lab-qr"><svg/);
    assert.ok(student.includes(labQrSvg(sim.sourceUrl)));
  });
  it('credits PhET beside the link', () => {
    // The credit is Latin prose on an RTL page, so `esc` wraps its runs in bidi
    // isolates — correct for reading, invisible once rendered. Compare without.
    const credit = student.match(/<div class="lab-credit">(.*?)<\/div>/)![1]!;
    assert.equal(credit.replace(/[\u2066-\u2069]/g, ''), sim.attribution);
  });
  it('prints the link with no bidi isolates, so a copied link is intact', () => {
    assert.match(student, new RegExp(`<div class="lab-url">${sim.sourceUrl.replace(/[.]/g, '\\.')}</div>`));
  });
  it('numbers the steps', () => assert.match(student, /<ol class="lab-steps"><li>/));
  it('keeps the key off the student copy and on the teacher copy', () => {
    assert.ok(!student.includes('مفتاح الإجابات'));
    assert.ok(teacher.includes('مفتاح الإجابات'));
  });
  it('leaves every other worksheet exactly as it was', () => {
    const plain = { ...ws, lab: undefined };
    assert.ok(!buildWorksheetHTML(plain, 'ورقة', meta, true).includes('class="lab-box"'));
  });
});

describe('labQrSvg', () => {
  it('is an inline SVG with nothing executable', () => {
    const svg = labQrSvg('https://phet.colorado.edu/sims/html/x/latest/x_ar.html');
    assert.match(svg, /^<svg[\s>]/);
    assert.ok(!/<script|on\w+=/i.test(svg));
  });
});

describe('the virtual lab as text (share, copy, Word)', () => {
  it('carries the link and the steps', () => {
    const text = formatWorksheetText(ws, ws.title, meta, true, false);
    assert.ok(text.includes(sim.sourceUrl));
    assert.ok(text.includes(`1. ${sheet.procedure[0]}`));
  });
});
