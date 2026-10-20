import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { linkedEditionYear } from '../nccdEdition.ts';

const NCCD = 'https://nccd.gov.jo/EBV4.0/Root_Storage/AR/';

describe('linkedEditionYear', () => {
  it('reads the school year when the link names it', () => {
    assert.equal(linkedEditionYear(`${NCCD}2026-2027%20book/Math/G3/1/ST/2026_MT03.ST2.pdf`), '2026-2027');
    assert.equal(linkedEditionYear(`${NCCD}2026-2027 book/sciences/G1/1/StBook1.pdf`), '2026-2027');
  });

  it('says nothing when the folder is only a bare year or has no year', () => {
    // `/2025/` is a publication year or a school year; the link can't tell us which.
    assert.equal(linkedEditionYear(`${NCCD}Math/2025/G01/2/MT01/SE/MA.01.ST2.pdf`), undefined);
    assert.equal(linkedEditionYear('https://nccd.gov.jo/EBV4.0/Root_Storage/EN/2026/G9/book.pdf'), undefined);
    assert.equal(linkedEditionYear(`${NCCD}Islam/Islam/2025/G1/2/G1-Islamic.pdf`), undefined);
  });

  it('does not mistake a year range elsewhere in the path for the edition', () => {
    assert.equal(linkedEditionYear(`${NCCD}Science/2024-2025/G5/StBook5.pdf`), undefined);
  });

  it('handles a missing link', () => {
    assert.equal(linkedEditionYear(undefined), undefined);
    assert.equal(linkedEditionYear(''), undefined);
  });
});
