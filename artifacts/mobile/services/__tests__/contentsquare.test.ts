import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { SESSION_REPLAY_CONFIG } from '../analytics.ts';
import {
  contentsquareScriptUrl,
  installContentsquare,
  parseContentsquareTagId,
  type ContentsquareDocument,
  type ContentsquareWindow,
} from '../contentsquare.ts';

function fakeDom() {
  const appended: Array<{ async: boolean; src: string }> = [];
  const doc: ContentsquareDocument = {
    createElement: () => ({ async: false, src: '' }),
    head: { appendChild: (n) => appended.push(n as { async: boolean; src: string }) },
  };
  const win: ContentsquareWindow = {};
  return { doc, win, appended };
}

describe('parseContentsquareTagId', () => {
  it('accepts a plain alphanumeric id, trimmed', () => {
    assert.equal(parseContentsquareTagId('68a876b193165'), '68a876b193165');
    assert.equal(parseContentsquareTagId('  68a876b193165 '), '68a876b193165');
  });

  it('treats anything else as "not configured"', () => {
    // An unset repository variable reaches the bundle as '' or undefined.
    for (const v of [undefined, null, '', '   ', 'abc', '68a8 76b1', '68a876b193165.js', '<script>', '../x', 'a'.repeat(33)]) {
      assert.equal(parseContentsquareTagId(v), null, String(v));
    }
  });
});

describe('installContentsquare', () => {
  it('loads nothing and makes no request without a valid tag id', () => {
    for (const v of [undefined, '', 'no']) {
      const { doc, win, appended } = fakeDom();
      assert.equal(installContentsquare(v, win, doc, '/'), false);
      assert.equal(appended.length, 0);
      assert.equal(win._uxa, undefined);
    }
  });

  it('sets the path, then adds one async script from t.contentsquare.net', () => {
    const { doc, win, appended } = fakeDom();
    assert.equal(installContentsquare('68a876b193165', win, doc, '/workspace'), true);
    assert.equal(appended.length, 1);
    assert.equal(appended[0].async, true);
    assert.equal(appended[0].src, 'https://t.contentsquare.net/uxa/68a876b193165.js');
    // Pathname only: no query string, no fragment.
    assert.deepEqual(win._uxa, [['setPath', '/workspace']]);
  });

  it('is idempotent: a second call adds no second script', () => {
    const { doc, win, appended } = fakeDom();
    assert.equal(installContentsquare('68a876b193165', win, doc, '/'), true);
    assert.equal(installContentsquare('68a876b193165', win, doc, '/workspace'), false);
    assert.equal(appended.length, 1);
  });

  it('is not loaded on the parent consent page, whose address carries the approval token', () => {
    for (const p of ['/guardian', '/guardian/', '/guardian/x']) {
      const { doc, win, appended } = fakeDom();
      assert.equal(installContentsquare('68a876b193165', win, doc, p), false, p);
      assert.equal(appended.length, 0, p);
      assert.equal(win._uxa, undefined, p);
    }
  });

  it('is loaded on the exam link page and everywhere else (everyone is recorded)', () => {
    for (const p of ['/', '/take/ABC123', '/my-exams', '/guardian-waiting', '/workspace']) {
      const { doc, win } = fakeDom();
      assert.equal(installContentsquare('68a876b193165', win, doc, p), true, p);
    }
  });
});

describe('contentsquareScriptUrl', () => {
  it('pins the host and path', () => {
    assert.equal(contentsquareScriptUrl('abc123'), 'https://t.contentsquare.net/uxa/abc123.js');
  });
});

describe('SESSION_REPLAY_CONFIG', () => {
  // Students and parents are recorded in the Android app, so the masks must
  // stay on. Loosening one is a privacy decision, not a tweak.
  it('masks all text, images and system views', () => {
    assert.equal(SESSION_REPLAY_CONFIG.maskAllTextInputs, true);
    assert.equal(SESSION_REPLAY_CONFIG.maskAllImages, true);
    assert.equal(SESSION_REPLAY_CONFIG.maskAllSandboxedViews, true);
  });

  it('does not ship console logs or network telemetry with the recording', () => {
    assert.equal(SESSION_REPLAY_CONFIG.captureLog, false);
    assert.equal(SESSION_REPLAY_CONFIG.captureNetworkTelemetry, false);
  });
});
