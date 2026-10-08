/**
 * Editing a media slide must not lose, or misplace, the credit it carries.
 *
 * Lab slides (and teacher attachments) are built with the credit in BOTH
 * `content` (the presenter) and `mediaCaption` (PDF and PPTX). Three ways the
 * slide editor broke that, each reproduced against a real lab slide first.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { getLabItem } from '@workspace/curriculum/lab';
import { getExternalResource } from '@workspace/curriculum/external';

import { applyMediaEdit, contentAfterMediaEdit } from '../classMedia.ts';
import { buildLabSlide } from '../labSlides.ts';

const imageSlide = buildLabSlide(getLabItem('lab-ext-commons-net-force')!, true, 1)!;
const credit = getExternalResource('commons-net-force')!.attribution;
const docSlide = buildLabSlide(getLabItem('lab-periodic-table')!, true, 2)!;

describe('applyMediaEdit — the credit survives an edit', () => {
  it('keeps the caption when it is cleared and the media is unchanged', () => {
    const out = applyMediaEdit(imageSlide, { url: imageSlide.mediaUrl!, caption: '' });
    assert.ok(out.ok);
    assert.ok(out.slide.mediaCaption?.includes(credit), 'PDF and PPTX read the credit from mediaCaption');
  });

  it('keeps it for whitespace too', () => {
    const out = applyMediaEdit(imageSlide, { url: imageSlide.mediaUrl!, caption: '   ' });
    assert.ok(out.ok);
    assert.ok(out.slide.mediaCaption?.includes(credit));
  });

  it('still lets a teacher replace the caption with their own words', () => {
    const out = applyMediaEdit(imageSlide, { url: imageSlide.mediaUrl!, caption: 'my own words' });
    assert.ok(out.ok);
    assert.equal(out.slide.mediaCaption, 'my own words');
  });

  it('still drops the old caption when the media itself is swapped (it credits something else now)', () => {
    const out = applyMediaEdit(imageSlide, { url: 'https://example.test/other.png', caption: imageSlide.mediaCaption! });
    assert.ok(out.ok);
    assert.equal(out.slide.mediaCaption, undefined);
  });

  it('still clears a swapped slide’s caption when the teacher blanks it', () => {
    const out = applyMediaEdit(imageSlide, { url: 'https://example.test/other.png', caption: '' });
    assert.ok(out.ok);
    assert.equal(out.slide.mediaCaption, undefined);
  });
});

describe('applyMediaEdit — a slide whose media cannot be classified', () => {
  it('can be saved when its link is unchanged (the link slide for an interactive)', () => {
    const out = applyMediaEdit(docSlide, { url: docSlide.mediaUrl!, caption: docSlide.mediaCaption! });
    assert.ok(out.ok, 'editing only the title must not be blocked');
    assert.equal(out.slide.mediaKind, 'document', 'its kind is kept, not guessed');
    assert.equal(out.slide.mediaUrl, docSlide.mediaUrl);
  });

  it('keeps its caption when cleared', () => {
    const out = applyMediaEdit(docSlide, { url: docSlide.mediaUrl!, caption: '' });
    assert.ok(out.ok);
    assert.equal(out.slide.mediaCaption, docSlide.mediaCaption);
  });

  it('still refuses a NEW link it cannot embed', () => {
    for (const url of ['', 'not a url', 'https://example.com/page', 'javascript:alert(1)']) {
      assert.equal(applyMediaEdit(docSlide, { url, caption: 'x' }).ok, false, url);
    }
  });

  it('still converts a document slide when given a picture or a video', () => {
    const out = applyMediaEdit(docSlide, { url: 'https://example.test/a.png', caption: '' });
    assert.ok(out.ok);
    assert.equal(out.slide.mediaKind, 'image');
  });

  it('refuses an unchanged link on a slide that never had a kind', () => {
    const bare = { ...docSlide, mediaKind: undefined };
    assert.equal(applyMediaEdit(bare, { url: bare.mediaUrl!, caption: '' }).ok, false);
  });
});

describe('contentAfterMediaEdit — the presenter must not credit the old media', () => {
  it('drops the old credit from the body when the media is swapped', () => {
    const swapped = applyMediaEdit(imageSlide, { url: 'https://example.test/other.png', caption: imageSlide.mediaCaption! });
    assert.ok(swapped.ok);
    assert.equal(contentAfterMediaEdit(imageSlide, swapped.slide, imageSlide.content), '');
  });

  it('follows a new caption the teacher wrote', () => {
    const swapped = applyMediaEdit(imageSlide, { url: 'https://example.test/other.png', caption: 'new words' });
    assert.ok(swapped.ok);
    assert.equal(contentAfterMediaEdit(imageSlide, swapped.slide, imageSlide.content), 'new words');
  });

  it('leaves body text the teacher edited themselves alone', () => {
    const swapped = applyMediaEdit(imageSlide, { url: 'https://example.test/other.png', caption: '' });
    assert.ok(swapped.ok);
    assert.equal(contentAfterMediaEdit(imageSlide, swapped.slide, 'their own note'), 'their own note');
  });

  it('changes nothing when the media was not swapped', () => {
    const same = applyMediaEdit(imageSlide, { url: imageSlide.mediaUrl!, caption: imageSlide.mediaCaption! });
    assert.ok(same.ok);
    assert.equal(contentAfterMediaEdit(imageSlide, same.slide, imageSlide.content), imageSlide.content);
  });

  it('does not blank a slide whose body is empty', () => {
    const bare = { ...imageSlide, content: '' };
    const swapped = applyMediaEdit(bare, { url: 'https://example.test/other.png', caption: '' });
    assert.ok(swapped.ok);
    assert.equal(contentAfterMediaEdit(bare, swapped.slide, ''), '');
  });
});
