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
 *
 * ## It missed 49 books, 2026-09-16
 *
 * All of maths and science at grades 4, 6, 9 and 10 print «© HarperCollins
 * Publishers Limited» on page 2, under a full all-rights-reserved notice. Every
 * one was `nccd`, and so quotable, and so being reproduced verbatim into
 * generated worksheets.
 *
 * The generic mark above was written as «All rights reserved; no part of this
 * publication may be reproduced» — with a **semicolon**, copied off the Pearson
 * page. Collins prints a **period**. One character, 49 books, and a green test
 * the whole time.
 *
 * So the marks are regexes now rather than substrings, and the generic one
 * tolerates either punctuation and either case. The lesson is not "write wider
 * patterns" — it is that a check transcribed from one example matches one
 * example. `HarperCollins` is listed on its own for the same reason the others
 * are: the publisher's name is the mark that does the work, and the sentence
 * around it is decoration that varies.
 *
 * ## What a licence means here
 *
 * A mark is not by itself a failure. `usePolicy` reads `license` before
 * `authority`, so a row can carry `authority: 'nccd'` — true, the NCCD publishes
 * the Arabic edition — and a `license` that makes it reference-only anyway.
 * That is how the Collins books are recorded, and the assertion is about the
 * *permission*, not the label: a row fails only if it is quotable **and**
 * carries someone else's copyright notice.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { G10_SOURCES } from '../sources.ts';
import { usePolicy } from '../bank.ts';

const DATA = join(dirname(fileURLToPath(import.meta.url)), '..', 'data');
/**
 * Both corpus directories. `extracted-g9` holds the two Grade 9 maths files and
 * nothing else; reading only `extracted` made them invisible here, which is two
 * of the 49 that this test could not have caught even with the right pattern.
 */
const EXTRACTED = [join(DATA, 'extracted'), join(DATA, 'extracted-g9')];

/**
 * Publisher marks that mean "not ours to quote". Deliberately narrow: these are
 * the marks that actually appear in this corpus, not a guess at every possible
 * notice. A new publisher will need adding, and that is a prompt to look rather
 * than a gap — the failure mode of a wider pattern is false positives on NCCD
 * books that merely mention a company.
 */
const THIRD_PARTY_MARKS = [
  /Pearson Education/i,
  /York Press/i,
  /HarperCollins/i,
  // Either punctuation, because the two publishers in this corpus disagree
  // about it and the semicolon-only version of this line is what let the Collins
  // series through. `\s*` for the line break the extractor puts here.
  /All rights reserved[.;]\s*No part of this publication may be reproduced/i,
];

/** The copyright page is front matter; a prefix is enough and keeps this fast. */
const HEAD_CHARS = 30_000;

describe('quotable authority', () => {
  it('never lets a third-party publication be quotable', () => {
    const offenders: string[] = [];

    for (const s of G10_SOURCES) {
      // The question is what a caller may *do* with it, not what the row is
      // labelled. A Collins book keeps `authority: 'nccd'` and is restricted by
      // its licence; asserting on the label would fail on exactly those rows,
      // which are the ones that have been dealt with.
      if (usePolicy(s) !== 'quotable') continue;

      // Not every manifest row is extracted — an un-ingested row has nothing to
      // read, and that is a legitimate state, not a failure.
      const file = EXTRACTED.map(d => join(d, `${s.id}.json`)).find(existsSync);
      if (!file) continue;

      const head = readFileSync(file, 'utf8').slice(0, HEAD_CHARS);
      const hit = THIRD_PARTY_MARKS.find(m => m.test(head));
      if (hit) offenders.push(`${s.id} (${s.subject}) — matched ${hit}`);
    }

    assert.deepEqual(
      offenders,
      [],
      'These sources are quotable, so their text is reproduced verbatim into '
      + 'generated worksheets — but their own front matter carries a third-party '
      + 'copyright notice. Either set `authority: \'third-party\'`, or, if the '
      + 'NCCD really does publish it and only the copyright is elsewhere, give it '
      + 'a `license` that says so. Both map to reference-only; the licence keeps '
      + `the provenance honest.\n  ${offenders.join('\n  ')}`,
    );
  });
});
