import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { VIRTUAL_LABS, releasedVirtualLab, validateVirtualLabs, type VirtualLabSheet } from '../virtualLabs.ts';
import { EXTERNAL_RESOURCES, type ExternalResource } from '../external.ts';

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

describe('the release gate', () => {
  it('hides an unreviewed sheet from teachers', () => {
    assert.equal(releasedVirtualLab(sheet.lessonId, { labs: [sheet] }), null);
  });
  it('shows it in a dev build, for review', () => {
    assert.equal(releasedVirtualLab(sheet.lessonId, { labs: [sheet], dev: true }), sheet);
  });
  it('releases it once a review is recorded', () => {
    const reviewed = { ...sheet, reviewedBy: 'أ. معلم', reviewedAt: '2026-10-10' };
    assert.equal(releasedVirtualLab(sheet.lessonId, { labs: [reviewed] }), reviewed);
  });
  it('a lesson with no sheet has none', () => {
    assert.equal(releasedVirtualLab('kbl-nope', { labs: [sheet], dev: true }), null);
  });
});

describe('validateVirtualLabs', () => {
  it('accepts a complete sheet', () => {
    assert.deepEqual(validateVirtualLabs([sheet], [sim]), []);
  });
  it('refuses a sheet whose simulation is not in the catalog', () => {
    assert.ok(validateVirtualLabs([sheet], []).some(e => /phet-test.*not in the catalog/.test(e)));
  });
  it('refuses a sheet pointing at a non-simulation resource', () => {
    assert.ok(validateVirtualLabs([sheet], [{ ...sim, kind: 'video' }]).some(e => /not a simulation/.test(e)));
  });
  it('refuses an empty section or a key that does not match it', () => {
    const errs = validateVirtualLabs([{ ...sheet, observe: [], teacherKey: { ...sheet.teacherKey, explain: ['ج'] } }], [sim]);
    assert.ok(errs.some(e => /observe is empty/.test(e)));
    assert.ok(errs.some(e => /explain: 2 questions but 1 key/.test(e)));
  });
  it('refuses a review date without a reviewer', () => {
    assert.ok(validateVirtualLabs([{ ...sheet, reviewedAt: '2026-10-10' }], [sim]).some(e => /reviewedAt without reviewedBy/.test(e)));
  });
  it('the shipped sheets are all valid against the shipped catalog', () => {
    assert.deepEqual(validateVirtualLabs(VIRTUAL_LABS, EXTERNAL_RESOURCES), []);
  });
});
