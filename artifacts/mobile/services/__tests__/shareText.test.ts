/**
 * What this guards: Share handed the OS sheet plain text, and the Windows sheet
 * (Edge/Chrome on desktop) offers no "copy" for text — only for a URL — so a
 * teacher who wanted the quiz on the clipboard had no way there from Share.
 * Share now always puts the text on the clipboard as well, on web and in the
 * app, and says honestly which of the two happened.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { shareOrCopy, shareToastKey } from '../shareText.ts';
import translations from '../i18n.ts';

describe('shareToastKey', () => {
  it('says the text was copied whenever it was, and nothing when it was not', () => {
    assert.equal(shareToastKey('copied'), 'copiedToClipboard');
    assert.equal(shareToastKey('both'), 'sharedAlsoCopied');
    assert.equal(shareToastKey('shared'), null);
  });

  it('names keys both languages have', () => {
    for (const lang of ['ar', 'en'] as const) {
      for (const o of ['copied', 'both'] as const) {
        const key = shareToastKey(o)!;
        assert.ok(translations[lang][key], `${lang}.${key}`);
      }
    }
  });
});

function deps(over: Partial<Parameters<typeof shareOrCopy>[2]> = {}) {
  const calls: string[] = [];
  return {
    calls,
    d: {
      canShare: true,
      copy: async (text: string) => { calls.push(`copy:${text}`); },
      share: async (text: string, title: string) => { calls.push(`share:${text}:${title}`); },
      ...over,
    },
  };
}

describe('shareOrCopy', () => {
  it('copies and opens the sheet, starting the copy before the sheet', async () => {
    const { calls, d } = deps();
    assert.equal(await shareOrCopy('quiz', 'Title', d), 'both');
    // The copy must start first: on web the sheet consumes the click's user
    // activation, and a clipboard write after it may be refused.
    assert.deepEqual(calls, ['copy:quiz', 'share:quiz:Title']);
  });

  it('only copies where there is no share sheet (most desktop browsers)', async () => {
    const { calls, d } = deps({ canShare: false });
    assert.equal(await shareOrCopy('quiz', 'Title', d), 'copied');
    assert.deepEqual(calls, ['copy:quiz']);
  });

  it('reports copied when the teacher closes the sheet without sharing', async () => {
    const { d } = deps({
      share: async () => { throw Object.assign(new Error('Share canceled'), { name: 'AbortError' }); },
    });
    assert.equal(await shareOrCopy('quiz', 'Title', d), 'copied');
  });

  it('reports shared, not both, when the copy failed but the sheet opened', async () => {
    const { d } = deps({ copy: async () => { throw new Error('NotAllowedError'); } });
    assert.equal(await shareOrCopy('quiz', 'Title', d), 'shared');
  });

  it('throws when neither the copy nor the sheet worked', async () => {
    const { d } = deps({
      copy: async () => { throw new Error('no clipboard'); },
      share: async () => { throw new Error('no share'); },
    });
    await assert.rejects(shareOrCopy('quiz', 'Title', d));
  });

  it('throws when there is no sheet and the copy failed', async () => {
    const { d } = deps({ canShare: false, copy: async () => { throw new Error('no clipboard'); } });
    await assert.rejects(shareOrCopy('quiz', 'Title', d));
  });
});
