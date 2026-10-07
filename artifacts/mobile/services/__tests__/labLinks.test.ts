/**
 * Route helpers. A present-mode URL is shareable, so what arrives in the
 * param is untrusted: it has to resolve to a known item or to nothing.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { LAB_ROUTE, labItemPath, labShareUrl, resolveLabParam } from '../labLinks.ts';

describe('labItemPath', () => {
  it('builds the present-mode path', () => {
    assert.equal(LAB_ROUTE, '/curriculum/lab');
    assert.equal(labItemPath('lab-periodic-table'), '/curriculum/lab/lab-periodic-table');
  });
  it('encodes an id that is not url-safe', () => {
    assert.equal(labItemPath('a b/c'), '/curriculum/lab/a%20b%2Fc');
  });
});

describe('labShareUrl', () => {
  it('is the live site plus the present-mode path, never a dev or app-scheme link', () => {
    assert.equal(labShareUrl('lab-periodic-table'), 'https://app.iqrra.com/curriculum/lab/lab-periodic-table');
    assert.doesNotMatch(labShareUrl('lab-periodic-table'), /localhost|^mobile:/);
  });
});

describe('resolveLabParam', () => {
  it('resolves a known id, including from an array param', () => {
    assert.equal(resolveLabParam('lab-mole-calculator')?.kind, 'interactive');
    assert.equal(resolveLabParam(['lab-mole-calculator', 'x'])?.id, 'lab-mole-calculator');
  });
  it('returns null for an unknown, empty or missing id', () => {
    assert.equal(resolveLabParam('nope'), null);
    assert.equal(resolveLabParam(''), null);
    assert.equal(resolveLabParam(undefined), null);
    assert.equal(resolveLabParam([]), null);
  });
});
