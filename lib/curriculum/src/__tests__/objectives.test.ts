/**
 * `bloomsSource` must say `defaulted` for every objective a catalog builder
 * stamped, or `bloomsCoverage()` reports human classification that never
 * happened. `DERIVED_OUTCOME_PREFIXES` was a literal list that missed the
 * Grade 9 (`o-g9-…`) and English vocational (`o-eng-…`) shapes: 170 of 366
 * objectives read `authored` while carrying the builder's `'Understand'`.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getAllObjectives } from '../objectives.ts';
import { objectiveId, type CurriculumIdScope } from '../curriculumIds.ts';

/** One scope per id shape `objectiveId()` can emit. */
const SCOPES: CurriculumIdScope[] = [
  { gradeId: 'grade-10', subject: 'math', semester: 1 },
  { gradeId: 'grade-10', subject: 'math', semester: 2 },
  { gradeId: 'grade-10', subject: 'chem', semester: 1 },
  { gradeId: 'grade-10', subject: 'chem', semester: 2 },
  { gradeId: 'grade-10', subject: 'finlit', semester: 1 },
  { gradeId: 'grade-10', subject: 'phys', semester: 1 },
  { gradeId: 'grade-10', subject: 'phys', semester: 2 },
  { gradeId: 'grade-10', subject: 'earth-science', semester: 1 },
  { gradeId: 'grade-10', subject: 'earth-science', semester: 2 },
  { gradeId: 'grade-10', subject: 'biology', semester: 1 },
  { gradeId: 'grade-10', subject: 'biology', semester: 2 },
  // Grade 9 S2 is omitted: its catalog carries 0 objectives today (verify --gaps).
  { gradeId: 'grade-9', subject: 'math', semester: 1 },
  { gradeId: 'grade-10', subject: 'eng-commerce', semester: 1 },
  { gradeId: 'grade-10', subject: 'eng-industry', semester: 1 },
];

describe('bloomsSource', () => {
  it('every builder-minted objective reads as defaulted, never authored', () => {
    const all = getAllObjectives();
    for (const scope of SCOPES) {
      const prefix = objectiveId(scope, 'u1_l1', 0).replace(/u1_l1-0$/, '');
      const minted = all.filter(o => o.id.startsWith(prefix));
      // Math S2's legacy prefix `o-nccd-` is a prefix of the others, so it can
      // never be empty; every other scope has at least one lesson today.
      assert.ok(minted.length > 0, `no objectives found under ${prefix}`);
      const authored = minted.filter(o => o.bloomsSource === 'authored').map(o => o.id);
      assert.deepEqual(authored, [], `${prefix} objectives claiming authored: ${authored.slice(0, 5)}`);
    }
  });

  it('hand-authored catalog objectives still read as authored', () => {
    const authored = getAllObjectives().filter(o => o.bloomsSource === 'authored');
    assert.ok(authored.length > 0, 'catalog.ts hand-authored objectives vanished');
    assert.ok(authored.every(o => !/^o-(nccd-|finlit-|g\d+-|eng-)/.test(o.id)));
  });
});
