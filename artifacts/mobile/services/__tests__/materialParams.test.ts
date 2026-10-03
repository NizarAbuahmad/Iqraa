/**
 * The homework flag travels two ways: the Tools tab and chat send `'1'` as a
 * route param, while a saved material stores a boolean in `formState`, which
 * the workspace spreads back into the route as the string `'true'`. The
 * worksheet screen accepted only `'1'`, so every reopened homework came back
 * as a worksheet and the next save demoted it for good.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { readHomeworkParam, readIndexParam } from '../materialParams.ts';

describe('readHomeworkParam', () => {
  it('accepts the route form sent by the tool menus', () => {
    assert.equal(readHomeworkParam('1'), true);
  });

  it('accepts the stringified boolean a reopened saved material carries', () => {
    assert.equal(readHomeworkParam('true'), true);
  });

  it('is false when absent or explicitly off', () => {
    assert.equal(readHomeworkParam(undefined), false);
    assert.equal(readHomeworkParam(''), false);
    assert.equal(readHomeworkParam('0'), false);
    assert.equal(readHomeworkParam('false'), false);
  });
});

describe('readIndexParam — a saved picker position', () => {
  // Indices arrive from موادي form state and from hand-written URLs; a position
  // the option list cannot honour must fall back, not become NaN or overflow.
  it('reads a position inside the list', () => {
    assert.equal(readIndexParam('2', 5, 0), 2);
  });

  it('falls back when absent, non-numeric, negative or past the end', () => {
    assert.equal(readIndexParam(undefined, 5, 1), 1);
    assert.equal(readIndexParam('abc', 5, 1), 1);
    assert.equal(readIndexParam('-1', 5, 1), 1);
    assert.equal(readIndexParam('5', 5, 1), 1);
  });
});
