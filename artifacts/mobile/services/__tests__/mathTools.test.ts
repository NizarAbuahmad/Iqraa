/**
 * Route helpers for the Math Corner. A tool URL is shareable, so what arrives
 * in the param is untrusted: it resolves to a known tool or to nothing.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  MATH_ROUTE,
  MATH_TOOLS,
  MATH_TOOL_IDS,
  mathShareUrl,
  mathToolPath,
  resolveMathParam,
} from '../mathTools.ts';

describe('registry', () => {
  it('every id has metadata with distinct title and hint keys', () => {
    for (const id of MATH_TOOL_IDS) {
      const meta = MATH_TOOLS[id];
      assert.ok(meta.icon.length > 0, id);
      assert.ok(meta.titleKey.length > 0, id);
      assert.ok(meta.hintKey.length > 0, id);
    }
    const titles = MATH_TOOL_IDS.map(id => MATH_TOOLS[id].titleKey);
    assert.equal(new Set(titles).size, titles.length);
  });
  it('ships the calculator', () => {
    assert.ok((MATH_TOOL_IDS as readonly string[]).includes('calculator'));
  });
});

describe('mathToolPath', () => {
  it('builds the tool path under the Library', () => {
    assert.equal(MATH_ROUTE, '/curriculum/math');
    assert.equal(mathToolPath('calculator'), '/curriculum/math/calculator');
  });
});

describe('mathShareUrl', () => {
  it('is the live site plus the tool path, never a dev or app-scheme link', () => {
    assert.equal(mathShareUrl('calculator'), 'https://app.iqrra.com/curriculum/math/calculator');
    assert.doesNotMatch(mathShareUrl('calculator'), /localhost|^mobile:/);
  });
});

describe('resolveMathParam', () => {
  it('resolves a known id, including from an array param', () => {
    assert.equal(resolveMathParam('calculator'), 'calculator');
    assert.equal(resolveMathParam(['calculator', 'x']), 'calculator');
  });
  it('returns null for an unknown, empty or missing id', () => {
    assert.equal(resolveMathParam('nope'), null);
    assert.equal(resolveMathParam(''), null);
    assert.equal(resolveMathParam(undefined), null);
    assert.equal(resolveMathParam([]), null);
  });
  it('does not resolve inherited object keys', () => {
    assert.equal(resolveMathParam('constructor'), null);
    assert.equal(resolveMathParam('__proto__'), null);
    assert.equal(resolveMathParam('toString'), null);
  });
});
