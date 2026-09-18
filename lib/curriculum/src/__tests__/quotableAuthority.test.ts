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
 * A mark is not by itself a failure. It means "someone needs to have looked at
 * this book", and a row carrying a `license` is the record that someone did.
 *
 * The Collins books are quotable — Iqraa holds the right to use them, confirmed
 * 2026-09-16 — so an assertion phrased as "nothing quotable carries a
 * third-party mark" would fail on all 49 of them, permanently, for a thing that
 * has been decided. A test that is red about a settled question does not get
 * investigated, it gets deleted, and the Pearson case it was written for goes
 * back to being invisible.
 *
 * So the rule is: a book carrying someone else's copyright notice must be
 * *accounted for* — either it is not quotable, or it carries a licence in
 * `RULED_ON` below naming the decision. What still fails is the case that
 * matters: a book nobody has looked at, quotable by default, with another
 * publisher's name on page 2. That is exactly the state all 49 of these were in
 * yesterday.
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
 * The corpus. One directory, deliberately.
 *
 * This briefly also read `../data/extracted-g9/` on the belief that the two
 * Grade 9 maths files lived only there and were invisible here. **That was
 * wrong**: both are in `extracted/` in the ordinary page-array schema, and this
 * test has always seen them. `extracted-g9/` holds stale duplicates of the same
 * two books in reversed presentation-form Arabic under a different schema,
 * which STATUS.md has listed as dead data read by nothing since before this
 * test existed — `passages.ts` does not read it either.
 *
 * Reading it here would have meant scanning a copy nobody ships for a licence
 * decision about a book we do. It never changed an outcome, because
 * `extracted/` is checked first and always hits, which is exactly why a wrong
 * reason can sit in a green test until someone re-derives it.
 */
const EXTRACTED = join(dirname(fileURLToPath(import.meta.url)), '..', 'data', 'extracted');

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

/**
 * Licences that mean "this book's copyright notice has been read and ruled on".
 *
 * Deliberately a list of decisions, not a list of publishers. Adding an id here
 * is a claim that someone with the authority to make it has said we may use the
 * book — so it should be as hard to add to as the decision was to get, and each
 * entry should point at where that decision is recorded.
 */
const RULED_ON = new Set<string>([
  // Collins-prepared NCCD maths and science, grades 4–10. Iqraa holds the right
  // to use them — Nizar, 2026-09-16, after the notice and the cost of the
  // alternative were both put to him. See `POLICY_BY_LICENSE` in `bank.ts` and
  // the Collins section of STATUS.md.
  'nccd-collins',
]);

describe('quotable authority', () => {
  it('never quotes a third-party publication nobody has ruled on', () => {
    const offenders: string[] = [];

    for (const s of G10_SOURCES) {
      // Not quotable: its text never reaches a teacher verbatim, so whose
      // copyright page it carries is not this test's business.
      if (usePolicy(s) !== 'quotable') continue;
      // Quotable *and* accounted for — someone read this notice and decided.
      if (s.license && RULED_ON.has(s.license)) continue;

      // Not every manifest row is extracted — an un-ingested row has nothing to
      // read, and that is a legitimate state, not a failure.
      const file = EXTRACTED.map(d => join(d, `${s.id}.json`)).find(existsSync);
      if (!file) continue;
      const file = join(EXTRACTED, `${s.id}.json`);
      if (!existsSync(file)) continue;

      const head = readFileSync(file, 'utf8').slice(0, HEAD_CHARS);
      const hit = THIRD_PARTY_MARKS.find(m => m.test(head));
      if (hit) offenders.push(`${s.id} (${s.subject}) — matched ${hit}`);
    }

    assert.deepEqual(
      offenders,
      [],
      'These sources are quotable, so their text is reproduced verbatim into '
      + 'generated worksheets — and their own front matter carries someone '
      + 'else\'s copyright notice, with nothing on the row saying that was '
      + 'looked at. Read the notice, then either set `authority: \'third-party\'` '
      + '(reference-only, never reproduced) or, if we hold the right to use it, '
      + 'give it a `license` and add that id to RULED_ON with the decision '
      + `recorded.\n  ${offenders.join('\n  ')}`,
    );
  });

  it('still fails a Collins book whose licence is missing', () => {
    // The 49 were invisible for months because a semicolon did not match. This
    // is the same books, with the punctuation fixed and the licence stripped —
    // the state every one of them was in before 2026-09-16. If this stops
    // failing, the detector has gone blind again and the `RULED_ON` exemption
    // is the most likely place it happened.
    const collins = G10_SOURCES.find(s => s.license === 'nccd-collins' && s.authority === 'nccd');
    assert.ok(collins, 'no Collins-licensed source to test with');

    const file = EXTRACTED.map(d => join(d, `${collins.id}.json`)).find(existsSync);
    assert.ok(file, `${collins.id} has no extracted text`);
    const file = join(EXTRACTED, `${collins.id}.json`);
    assert.ok(existsSync(file), `${collins.id} has no extracted text`);
    const head = readFileSync(file, 'utf8').slice(0, HEAD_CHARS);

    const { license: _dropped, ...unlicensed } = collins;
    assert.equal(usePolicy(unlicensed), 'quotable', 'without its licence it is quotable by authority');
    assert.ok(THIRD_PARTY_MARKS.some(m => m.test(head)), 'the notice is no longer detected');
  });
});
