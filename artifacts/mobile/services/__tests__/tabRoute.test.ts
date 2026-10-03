import test from 'node:test';
import assert from 'node:assert/strict';
import { isTabActive, tabHref } from '../tabRoute.ts';

test('the index tab is the landing page, every other tab is its own name', () => {
  assert.equal(tabHref('index'), '/');
  assert.equal(tabHref('iqra'), '/iqra');
  assert.equal(tabHref('ai-tools'), '/ai-tools');
});

test('the landing page lights up «اليوم», under either spelling the router reports', () => {
  assert.equal(isTabActive('/', 'index'), true);
  assert.equal(isTabActive('/index', 'index'), true);
});

test('«اليوم» is not active on every other page just because they all start with /', () => {
  assert.equal(isTabActive('/iqra', 'index'), false);
  assert.equal(isTabActive('/profile', 'index'), false);
});

test('a tab is active on its own path and on paths nested under it', () => {
  assert.equal(isTabActive('/iqra', 'iqra'), true);
  assert.equal(isTabActive('/curriculum/resources', 'curriculum'), true);
  assert.equal(isTabActive('/notifications', 'profile'), false);
});

test('a sibling route that merely shares a prefix is not the tab', () => {
  assert.equal(isTabActive('/ai-tools-x', 'ai-tools'), false);
  assert.equal(isTabActive('/iqraa', 'iqra'), false);
});
