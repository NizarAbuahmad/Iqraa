/**
 * The homework flag travels two ways: the Tools tab and chat send `'1'` as a
 * route param, while a saved material stores a boolean in `formState`, which
 * the workspace spreads back into the route as the string `'true'`. The
 * worksheet screen accepted only `'1'`, so every reopened homework came back
 * as a worksheet and the next save demoted it for good.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { readHomeworkParam } from '../materialParams.ts';

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
