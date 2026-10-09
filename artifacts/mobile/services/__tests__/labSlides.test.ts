/**
 * Lab items as deck slides. The load-bearing tests are the two guards at the
 * bottom: every SHIPPED law is run through the deck's real formula helpers,
 * and every shipped credit is checked on both fields the exports read.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { LAB_ITEMS, getLabItem, type LabLawItem, type LabExternalItem } from '@workspace/curriculum/lab';
import { getExternalResource, type ExternalResource } from '@workspace/curriculum/external';

import { isBulletLine, looksLikeEquation, stripBullet } from '../deckText.ts';
import { hasRenderableMath, isolateForeignRuns } from '../mathRender.ts';
import { labShareUrl } from '../labLinks.ts';
import {
  buildLabSlide,
  deckableLabItems,
  labSlidesFor,
  lawFormulaLines,
  slideSymbol,
  unitForSlide,
} from '../labSlides.ts';

const LRI = '⁦';
const PDI = '⁩';
/** How many separate top-level isolates a string holds (nesting does not count). */
function topLevelIsolates(text: string): number {
  let depth = 0;
  let top = 0;
  for (const ch of text) {
    if (ch === LRI) { if (depth === 0) top += 1; depth += 1; }
    else if (ch === PDI) depth = Math.max(0, depth - 1);
  }
  return top;
}
const withoutIsolates = (text: string) => text.replace(/[\u2066\u2069]/g, '');
const laws = LAB_ITEMS.filter((i): i is LabLawItem => i.kind === 'law');
const externals = LAB_ITEMS.filter((i): i is LabExternalItem => i.kind === 'external');

describe('unitForSlide', () => {
  it('writes a unit with a slash as a negative power, which the deck draws as plain text', () => {
    assert.equal(unitForSlide('m/s²'), 'm·s⁻²');
    assert.equal(unitForSlide('g/mol'), 'g·mol⁻¹');
    assert.equal(unitForSlide('particles/mol'), 'particles·mol⁻¹');
  });
  it('leaves a unit with no slash alone', () => {
    assert.equal(unitForSlide('N'), 'N');
    assert.equal(unitForSlide('same as A and B'), 'same as A and B');
  });
  it('leaves a slash it cannot read alone instead of guessing (the guard below then catches it)', () => {
    assert.equal(unitForSlide('m/(s·s)'), 'm/(s·s)');
  });
});

describe('slideSymbol', () => {
  it('writes a subscript letter as the plain capital, which stays inside the isolate', () => {
    assert.equal(slideSymbol('Nₐ'), 'NA');
    assert.equal(slideSymbol('N = n × Nₐ'), 'N = n × NA');
  });
  it('leaves digit subscripts and everything else alone', () => {
    assert.equal(slideSymbol('H₂O'), 'H₂O');
  });
});

describe('lawFormulaLines', () => {
  it('gives each equation its own line', () => {
    const vec = getLabItem('law-vector-resultant') as LabLawItem;
    assert.deepEqual(lawFormulaLines(vec), ['Rx = Ax + Bx', 'Ry = Ay + By', 'R = √(Rx² + Ry²)']);
  });
  it('keeps a single equation as one line', () => {
    assert.deepEqual(lawFormulaLines(getLabItem('law-newton-second') as LabLawItem), ['F = m × a']);
  });
});

describe('law slides', () => {
  it('is an ordinary intro slide, no new slide kind', () => {
    const s = buildLabSlide(getLabItem('law-newton-second')!, true, 0)!;
    assert.equal(s.type, 'intro');
    assert.ok(s.title.includes('القانون الثاني لنيوتن'));
    assert.ok(s.content.split('\n')[0] === 'F = m × a');
    assert.ok(s.content.includes(`• ${LRI}a — Acceleration (m·s⁻²)${PDI}`));
  });
  it('carries the lesson terms only in an Arabic deck, and never repeats the title as a term', () => {
    const ar = buildLabSlide(getLabItem('law-molar-mass')!, true, 0)!;
    assert.ok(ar.content.includes('• المول'));
    assert.ok(!ar.content.includes('• الكتلة المولية'));
    const en = buildLabSlide(getLabItem('law-molar-mass')!, false, 0)!;
    assert.ok(!/[؀-ۿ]/.test(en.content));
  });
});

describe('interactive slides', () => {
  it('is a link slide: a document media slide carrying the share link and the title', () => {
    const item = getLabItem('lab-periodic-table')!;
    const s = buildLabSlide(item, true, 0)!;
    assert.equal(s.type, 'media');
    assert.equal(s.mediaKind, 'document');
    assert.equal(s.mediaUrl, labShareUrl('lab-periodic-table'));
    assert.equal(s.mediaCaption, item.titleAr);
    assert.equal(s.content, item.titleAr);
  });
});

describe('external slides — refusals', () => {
  const item = externals.find(e => getExternalResource(e.externalId)?.kind === 'image')!;
  const image = getExternalResource(item.externalId)!;
  const withResource = (patch: Partial<ExternalResource>) => () => ({ ...image, ...patch });

  it('builds the slide for a licensed, credited image', () => {
    assert.ok(buildLabSlide(item, true, 0, withResource({})));
  });
  it('produces no slide without an attribution', () => {
    assert.equal(buildLabSlide(item, true, 0, withResource({ attribution: '  ' })), null);
  });
  it('produces no slide for a reference-only licence', () => {
    assert.equal(buildLabSlide(item, true, 0, withResource({ license: 'CC-BY-SA-4.0' })), null);
  });
  it('produces no image slide without a stable fetchUrl', () => {
    assert.equal(buildLabSlide(item, true, 0, withResource({ fetchUrl: undefined })), null);
  });
  it('produces no slide when the resource is gone', () => {
    assert.equal(buildLabSlide(item, true, 0, () => undefined), null);
  });
  it('refuses a video that is not an embeddable YouTube link', () => {
    const vid = externals.find(e => getExternalResource(e.externalId)?.kind === 'video')!;
    const v = getExternalResource(vid.externalId)!;
    assert.ok(buildLabSlide(vid, true, 0, () => v));
    assert.equal(buildLabSlide(vid, true, 0, () => ({ ...v, sourceUrl: 'https://example.test/x' })), null);
    assert.equal(buildLabSlide(vid, true, 0, () => ({ ...v, license: 'CC-BY-SA-4.0' })), null);
  });
});

describe('labSlidesFor / deckableLabItems', () => {
  it('keeps the order given and skips unknown ids', () => {
    const out = labSlidesFor(['law-molar-mass', 'nope', 'law-newton-second'], true);
    assert.equal(out.length, 2);
    assert.ok(out[0]!.title.includes('الكتلة المولية'));
  });
  it('offers only the lesson’s items that can actually be built', () => {
    const lessonId = getLabItem('law-newton-second')!.lessonId;
    const items = deckableLabItems(lessonId, true);
    assert.ok(items.length > 0);
    assert.ok(items.every(i => i.lessonId === lessonId));
    assert.ok(items.every(i => buildLabSlide(i, true, 0) !== null));
  });
  it('is empty for no lesson', () => {
    assert.deepEqual(deckableLabItems('', true), []);
  });
});

// ── The guards ───────────────────────────────────────────────────────────────

describe('GUARD: every shipped law, through the deck’s real formula helpers', () => {
  it('has teeth: the raw forms really are misdrawn', () => {
    assert.equal(hasRenderableMath('m/s²'), true, 'a slash unit parses as a stacked fraction');
    assert.notEqual(isolateForeignRuns('N = n × Nₐ'), `${LRI}N = n × Nₐ${PDI}`, 'ₐ is stranded outside the isolate');
  });

  it('every shipped unit, on its own, is plain text on the slide', () => {
    // A unit can stand alone on a line (or follow a colon) in a later layout; the
    // raw `m/s²` is a stacked fraction there, so the converted form must not be.
    for (const law of laws) {
      for (const q of law.quantities) {
        const unit = unitForSlide(q.unit);
        assert.ok(!hasRenderableMath(unit), `unit "${q.unit}" of ${law.id} would stack as a fraction`);
        assert.ok(!hasRenderableMath(`${slideSymbol(q.symbol)}: ${unit}`), `"${q.symbol}: ${unit}" would stack`);
      }
    }
  });

  for (const law of laws) {
    for (const isAr of [true, false]) {
      it(`${law.id} (${isAr ? 'ar' : 'en'})`, () => {
        const slide = buildLabSlide(law, isAr, 0)!;
        const lines = slide.content.split('\n');
        const blank = lines.indexOf('');
        const equations = lines.slice(0, blank);
        const rest = lines.slice(blank + 1).filter(Boolean);

        assert.ok(equations.length > 0, 'a formula section first');
        for (const line of equations) {
          assert.ok(looksLikeEquation(line), `"${line}" should be drawn as an equation`);
          // The whole equation is one isolated run: nothing stranded in the RTL flow.
          assert.equal(isolateForeignRuns(line), `${LRI}${line}${PDI}`, `"${line}" is not one isolated run`);
        }
        for (const line of rest) {
          assert.ok(isBulletLine(line), `"${line}" must be a bullet so it is never drawn as a boxed equation`);
          assert.ok(!hasRenderableMath(withoutIsolates(stripBullet(line))), `"${line}" would be parsed as stacked maths`);
          // A Latin phrase in an Arabic deck must be ONE left-to-right run. The deck's own
          // isolation splits at «,» and «·», and the pieces then lay out right to left:
          // «Rx, Ry» printed as «Ry ,Rx» and «m·s⁻²» as «s⁻²·m» (seen in a real render).
          if (/[A-Za-z]/.test(line)) {
            assert.equal(
              topLevelIsolates(isolateForeignRuns(line)),
              1,
              `"${line}" is split into several runs, which an Arabic page lays out in reverse`,
            );
          }
        }
        assert.ok(!/[ₐ-ₜ]/.test(slide.content), 'a subscript letter would be stranded outside the isolate');
      });
    }
  }
});

describe('GUARD: every shipped credit reaches both fields the exports read', () => {
  for (const item of externals) {
    const res = getExternalResource(item.externalId)!;
    it(`${item.id}`, () => {
      const slide = buildLabSlide(item, true, 0);
      assert.ok(slide, 'a shipped external item must be deckable');
      assert.ok(res.attribution.trim());
      assert.ok(slide.content.includes(res.attribution), 'presenter reads the credit from content');
      assert.ok(slide.mediaCaption?.includes(res.attribution), 'PDF and PPTX read it from mediaCaption');
      // The credit is Latin text with commas inside an Arabic page: it must stay one run, or it
      // prints backwards («via Wikimedia Commons ,CC BY 3.0 ,2012rc» in a real render).
      assert.ok(slide.content.includes(`${LRI}${res.attribution}${PDI}`), 'credit is one isolated run in content');
      assert.ok(slide.mediaCaption!.includes(`${LRI}${res.attribution}${PDI}`), 'credit is one isolated run in mediaCaption');
      assert.equal(topLevelIsolates(isolateForeignRuns(slide.mediaCaption!)), 1, 'the credit is the only run in the caption');
      if (res.kind === 'image') {
        assert.equal(slide.mediaUrl, res.fetchUrl);
        assert.ok(!slide.mediaUrl!.includes('/media/external/'), 'never the one-hour presigned link');
      } else {
        assert.equal(slide.mediaUrl, res.sourceUrl);
      }
    });
  }
});
