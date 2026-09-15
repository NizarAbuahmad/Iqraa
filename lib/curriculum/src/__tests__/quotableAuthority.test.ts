/**
 * A source marked `nccd` must not carry a third-party copyright notice.
 *
 * `authority: 'nccd'` is not a label, it is a permission: `usePolicy` maps it to
 * `'quotable'`, and `searchPassages({ quotableOnly: true })` will return and
 * reproduce that book's text verbatim. `third-party` maps to `'reference-only'`
 * and is never reproduced.
 *
 * On 2026-09-15 four English sources were found marked `nccd` while their own
 * copyright pages read "© Pearson Education Limited and York Press Ltd." with a
 * full all-rights-reserved notice — the two Grade 10 teacher guides and both
 * Grade 9 student books. A commercial textbook was eligible for verbatim
 * retrieval, on grades already in production.
 *
 * Nothing failed when that was corrected, which is the point of this file: the
 * mistake was invisible to every existing test. It was found only because the
 * Grade 6 books of the same Pearson series were being registered and the
 * inconsistency showed up beside them — the Grade 10 pupil's and activity books
 * were `third-party` while their teacher guides were not.
 *
 * The check reads the extracted text rather than a hand-kept list, so a book
 * added next year is covered without anyone remembering this rule. It reads the
 * head of each file as a string rather than parsing it: the copyright page is
 * always in the front matter, and some of these files are megabytes.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { G10_SOURCES } from '../sources.ts';

const EXTRACTED = join(dirname(fileURLToPath(import.meta.url)), '..', 'data', 'extracted');

/**
 * Publisher marks that mean "not ours to quote". Deliberately narrow: these are
 * the marks that actually appear in this corpus, not a guess at every possible
 * notice. A new publisher will need adding, and that is a prompt to look rather
 * than a gap — the failure mode of a wider pattern is false positives on NCCD
 * books that merely mention a company.
 */
const THIRD_PARTY_MARKS = [
  'Pearson Education',
  'York Press',
  'All rights reserved; no part of this publication may be reproduced',
];

/** The copyright page is front matter; a prefix is enough and keeps this fast. */
const HEAD_CHARS = 30_000;

describe('quotable authority', () => {
  it('never marks a third-party publication as nccd', () => {
    const offenders: string[] = [];

    for (const s of G10_SOURCES) {
      if (s.authority !== 'nccd') continue;
      const file = join(EXTRACTED, `${s.id}.json`);
      // Not every manifest row is extracted — an un-ingested row has nothing to
      // read, and that is a legitimate state, not a failure.
      if (!existsSync(file)) continue;

      const head = readFileSync(file, 'utf8').slice(0, HEAD_CHARS);
      const hit = THIRD_PARTY_MARKS.find(m => head.includes(m));
      if (hit) offenders.push(`${s.id} (${s.subject}) — found "${hit}"`);
    }

    assert.deepEqual(
      offenders,
      [],
      'These sources claim authority "nccd", which makes their text quotable, but '
      + 'their own front matter carries a third-party copyright notice. Set '
      + `authority: 'third-party' — it maps to reference-only and is never `
      + `reproduced.\n  ${offenders.join('\n  ')}`,
    );
  });
});
