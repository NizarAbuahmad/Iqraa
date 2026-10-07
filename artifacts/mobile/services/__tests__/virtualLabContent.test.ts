import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { EXTERNAL_RESOURCES, VIRTUAL_LABS, isLicenseCheckStale, validateVirtualLabs } from '@workspace/curriculum';
import { getLessonById } from '../knowledgeBase.ts';
import { virtualLabFor, virtualLabWorksheet } from '../virtualLab.ts';

/**
 * The shipped sheets, against the shipped catalog. Six of the seven lab
 * lessons: `kbl-chem-s2-nccd-u5_lab` has no published HTML5 simulation to
 * point at, and is deliberately left without one rather than given a near miss.
 */
const SHIPPED: Record<string, string> = {
  'kbl-chem-s1-nccd-u1_lab': 'phet-models-of-the-hydrogen-atom',
  'kbl-chem-s1-nccd-u2_lab': 'phet-build-an-atom',
  'kbl-chem-s1-nccd-u3_lab': 'phet-molecule-shapes',
  'kbl-chem-s2-nccd-u4_lab': 'phet-balancing-chemical-equations',
  'kbl-phys-s1-nccd-u1_lab': 'phet-vector-addition',
  'kbl-phys-s1-nccd-u2_lab': 'phet-forces-and-motion-basics',
};

describe('the shipped virtual labs', () => {
  it('has a sheet for every confirmed simulation, and only lab lessons', () => {
    assert.ok(VIRTUAL_LABS.length > 0);
    for (const l of VIRTUAL_LABS) {
      const lesson = getLessonById(l.lessonId);
      assert.ok(lesson, `${l.lessonId} is not a lesson`);
      assert.match(lesson!.titleAr, /^تجربة استهلالية/);
    }
  });

  it('ships exactly the confirmed labs, each on its own simulation', () => {
    assert.deepEqual(
      Object.fromEntries(VIRTUAL_LABS.map(l => [l.lessonId, l.resourceId])),
      SHIPPED,
    );
  });

  it('has no sheet, and no catalog entry, for the lab with no HTML5 simulation', () => {
    assert.equal(VIRTUAL_LABS.find(l => l.lessonId === 'kbl-chem-s2-nccd-u5_lab'), undefined);
    assert.ok(!EXTERNAL_RESOURCES.some(r => r.lessonIds.includes('kbl-chem-s2-nccd-u5_lab')));
  });

  it('is valid against the catalog', () => {
    assert.deepEqual(validateVirtualLabs(VIRTUAL_LABS, EXTERNAL_RESOURCES), []);
  });

  it('links to the Arabic PhET simulations, checked recently', () => {
    for (const l of VIRTUAL_LABS) {
      const r = EXTERNAL_RESOURCES.find(x => x.id === l.resourceId)!;
      const repo = r.id.replace(/^phet-/, '');
      assert.equal(r.provider, 'phet');
      assert.equal(r.kind, 'simulation');
      assert.equal(r.license, 'CC-BY-NC-4.0');
      assert.equal(r.sourceUrl, `https://phet.colorado.edu/sims/html/${repo}/latest/${repo}_ar.html`);
      assert.deepEqual(r.lessonIds, [l.lessonId]);
      assert.deepEqual(r.gradeIds, ['grade-10']);
      assert.equal(r.subjectId, l.lessonId.startsWith('kbl-chem-') ? 'chemistry' : 'physics');
      assert.ok(!isLicenseCheckStale(r), `${r.id} licence check is stale`);
    }
  });

  it('ships nothing as reviewed', () => {
    // No subject teacher has signed these off yet. A review is recorded by hand,
    // in a separate change, by the person who did it.
    for (const l of VIRTUAL_LABS) {
      assert.equal(l.reviewedAt, undefined, `${l.lessonId} claims a review`);
      assert.equal(l.reviewedBy, undefined, `${l.lessonId} claims a reviewer`);
    }
  });

  it('keeps each sheet to the shape the worksheet expects', () => {
    for (const l of VIRTUAL_LABS) {
      assert.ok(l.predict.length >= 1 && l.predict.length <= 2, `${l.lessonId}: predict`);
      assert.ok(l.procedure.length >= 3 && l.procedure.length <= 6, `${l.lessonId}: procedure`);
      assert.ok(l.observe.length >= 2 && l.observe.length <= 3, `${l.lessonId}: observe`);
      assert.ok(l.explain.length >= 2 && l.explain.length <= 3, `${l.lessonId}: explain`);
    }
  });
});

describe('virtualLabFor on a shipped lab', () => {
  const lessonId = 'kbl-chem-s1-nccd-u1_lab';
  it('serves a worksheet in a dev build, linked to the catalog URL', () => {
    const found = virtualLabFor(lessonId, { dev: true });
    assert.ok(found);
    const catalog = EXTERNAL_RESOURCES.find(r => r.id === found!.sheet.resourceId)!;
    const ws = virtualLabWorksheet(found!.sheet, found!.resource, getLessonById(lessonId)!.titleAr);
    assert.equal(ws.lab?.url, catalog.sourceUrl);
    assert.equal(ws.lab?.simName, catalog.titleAr);
  });
  it('serves nothing to teachers while it is unreviewed', () => {
    assert.equal(virtualLabFor(lessonId, { dev: false }), null);
  });
});
