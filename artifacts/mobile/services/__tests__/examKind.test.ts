/**
 * What this guards: the switch between «ورقة للطباعة» and «تقييم يُرصد».
 *
 * Both halves must keep resolving to the routes everything else already links
 * to (the quiz tool, the evaluations list), and every string the switch
 * renders must exist in both languages — a missing Arabic key renders the
 * key's own name into the UI (see i18n.test.ts).
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import translations from '../i18n.ts';
import { EXAM_KINDS, examKindDef } from '../examKind.ts';
import { ALL_TOOLS } from '../toolCatalog.ts';

describe('examKind', () => {
  it('offers the paper first, then the marked evaluation', () => {
    assert.deepEqual(EXAM_KINDS.map(k => k.id), ['paper', 'evaluation']);
  });

  it('points at the routes the catalog already owns', () => {
    const routeOf = (id: string) => ALL_TOOLS.find(t => t.id === id)!.route;
    assert.equal(examKindDef('paper').route, routeOf('quiz'));
    assert.equal(examKindDef('evaluation').route, routeOf('evaluations'));
  });

  it('has copy in both languages for every label and hint', () => {
    for (const k of EXAM_KINDS) {
      for (const key of [k.labelKey, k.hintKey]) {
        for (const lang of ['ar', 'en'] as const) {
          const v = (translations[lang] as Record<string, unknown>)[key];
          assert.equal(typeof v, 'string', `${lang}.${key} is missing`);
          assert.ok((v as string).trim().length > 0, `${lang}.${key} is empty`);
        }
      }
    }
  });

  it('keeps the two hints apart, so the control still says which is which', () => {
    const [a, b] = EXAM_KINDS;
    for (const lang of ['ar', 'en'] as const) {
      const t = translations[lang];
      assert.notEqual(t[a!.hintKey], t[b!.hintKey]);
      assert.notEqual(t[a!.labelKey], t[b!.labelKey]);
    }
  });
});
