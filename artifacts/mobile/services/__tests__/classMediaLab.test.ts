import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import type { ActivitySlide } from '../ai/AIService.ts';
import { insertLabSlides, insertLessonResources } from '../classMedia.ts';

const slide = (type: ActivitySlide['type'], title: string): ActivitySlide => ({
  slideNumber: 0,
  type,
  title,
  content: title,
  durationSeconds: 0,
});
const titles = (s: readonly ActivitySlide[]) => s.map(x => x.title);

describe('insertLabSlides', () => {
  const lab = [slide('intro', 'LAB-1'), slide('media', 'LAB-2')];

  it('goes before the first worked example', () => {
    const deck = [slide('intro', 'title'), slide('intro', 'teach'), slide('challenge', 'ex'), slide('summary', 'sum')];
    assert.deepEqual(titles(insertLabSlides(deck, lab)), ['title', 'teach', 'LAB-1', 'LAB-2', 'ex', 'sum']);
  });

  it('falls back to before the summary, then to the end', () => {
    assert.deepEqual(
      titles(insertLabSlides([slide('intro', 'title'), slide('summary', 'sum')], lab)),
      ['title', 'LAB-1', 'LAB-2', 'sum'],
    );
    assert.deepEqual(
      titles(insertLabSlides([slide('intro', 'title'), slide('intro', 'teach')], lab)),
      ['title', 'teach', 'LAB-1', 'LAB-2'],
    );
  });

  it('never lands at slide 0, which the exports always draw as the title slide', () => {
    assert.deepEqual(titles(insertLabSlides([slide('intro', 'title')], lab)), ['title', 'LAB-1', 'LAB-2']);
    assert.equal(titles(insertLabSlides([slide('challenge', 'odd'), slide('intro', 'x')], lab))[0], 'odd');
  });

  it('keeps the order given, as a batch', () => {
    const out = insertLabSlides([slide('intro', 't'), slide('challenge', 'c')], lab);
    assert.deepEqual(titles(out).slice(1, 3), ['LAB-1', 'LAB-2']);
  });

  it('renumbers every slide from 1', () => {
    const out = insertLabSlides([slide('intro', 't'), slide('challenge', 'c')], lab);
    assert.deepEqual(out.map(s => s.slideNumber), [1, 2, 3, 4]);
  });

  it('is a copy, and a no-op for an empty batch', () => {
    const deck = [slide('intro', 't')];
    const out = insertLabSlides(deck, []);
    assert.notEqual(out, deck);
    assert.deepEqual(titles(out), ['t']);
  });

  it('lands after the teacher’s attachments when both are inserted', () => {
    const deck = [slide('intro', 'title'), slide('challenge', 'ex')];
    const withAttachments = insertLessonResources(deck, [{ kind: 'image', url: 'https://x.test/a.png', caption: 'ATT' }], true);
    const both = insertLabSlides(withAttachments, [slide('intro', 'LAB')]);
    assert.deepEqual(
      titles(both).map(t => (t === 'صورة' ? 'ATT' : t)),
      ['title', 'ATT', 'LAB', 'ex'],
    );
  });
});
