/**
 * What this guards: a published legal document that is empty, half-translated,
 * or missing the two things a store reviewer looks for.
 *
 * These render from data rather than from prose in a screen, so a dropped
 * section is a silently shorter page — no crash, no type error, and nobody
 * reads a policy carefully enough to notice on a phone.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  getLegalDoc,
  isLegalDocId,
  LEGAL_CONTACT_EMAIL,
  LEGAL_LAST_UPDATED,
  type LegalDocId,
} from '../../constants/legal.ts';

const IDS: LegalDocId[] = ['privacy', 'terms'];
const LANGS = ['ar', 'en'] as const;

describe('legal documents', () => {
  it('exists, in both languages, with nothing empty', () => {
    for (const id of IDS) {
      for (const lang of LANGS) {
        const doc = getLegalDoc(id, lang);
        assert.ok(doc.title.trim(), `${id}/${lang} has no title`);
        assert.ok(doc.intro.trim(), `${id}/${lang} has no intro`);
        assert.ok(doc.sections.length >= 8, `${id}/${lang} has only ${doc.sections.length} sections`);
        for (const section of doc.sections) {
          assert.ok(section.heading.trim(), `${id}/${lang} has a section with no heading`);
          assert.ok(section.body.length > 0, `${id}/${lang} — "${section.heading}" has no body`);
          for (const paragraph of section.body) {
            assert.ok(paragraph.trim(), `${id}/${lang} — "${section.heading}" has an empty paragraph`);
          }
        }
      }
    }
  });

  it('keeps the two documents in step across languages', () => {
    // A section added to one language and forgotten in the other is the most
    // likely edit to go wrong here, and the least visible.
    for (const id of IDS) {
      assert.equal(
        getLegalDoc(id, 'ar').sections.length,
        getLegalDoc(id, 'en').sections.length,
        `${id} has a different number of sections in Arabic and English`,
      );
    }
  });

  it('gives a reader somewhere to write, in every version', () => {
    // A policy with no contact address fails a data-subject request and a
    // store review at the same time.
    for (const id of IDS) {
      for (const lang of LANGS) {
        const text = getLegalDoc(id, lang).sections.flatMap(s => s.body).join('\n');
        assert.ok(
          text.includes(LEGAL_CONTACT_EMAIL),
          `${id}/${lang} never names the contact address`,
        );
      }
    }
  });

  it('tells the reader that deletion is in the app, not by email', () => {
    // The policy is where a reviewer checks that the required deletion path
    // exists. If app/delete-account.tsx is ever removed, this sentence
    // becomes a false claim — so it is pinned to the promise, not the screen.
    for (const lang of LANGS) {
      const text = getLegalDoc('privacy', lang).sections.flatMap(s => s.body).join('\n');
      const promise = lang === 'ar' ? 'حذف الحساب' : 'Delete account';
      assert.ok(text.includes(promise), `privacy/${lang} does not point at in-app deletion`);
    }
  });

  it('stamps both languages with a last-updated date', () => {
    for (const lang of LANGS) {
      assert.ok(LEGAL_LAST_UPDATED[lang].trim(), `no last-updated date for ${lang}`);
    }
  });

  it('accepts only the two slugs it can render', () => {
    assert.equal(isLegalDocId('privacy'), true);
    assert.equal(isLegalDocId('terms'), true);
    assert.equal(isLegalDocId('cookies'), false);
    assert.equal(isLegalDocId(undefined), false);
  });
});
