/**
 * What this guards: the boot redirect used to replace *every* signed-in cold
 * boot with the tabs, so on web — where a reload is a cold boot — no deep link
 * survived. Opening /admin/dashboard landed you on the home screen.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { isEntryRoute, isPublicRoute } from '../routeGating.ts';

describe('isEntryRoute', () => {
  it('treats the auth and onboarding routes as entries', () => {
    for (const p of ['/login', '/register', '/forgot-password', '/onboarding']) {
      assert.equal(isEntryRoute(p), true, p);
    }
  });

  it('treats the app root and an unresolved path as entries', () => {
    assert.equal(isEntryRoute('/'), true);
    assert.equal(isEntryRoute(null), true);
    assert.equal(isEntryRoute(undefined), true);
    assert.equal(isEntryRoute(''), true);
  });

  it('leaves real destinations alone — these were being thrown away', () => {
    for (const p of [
      '/admin/dashboard',
      '/workspace',
      '/workspace/view',
      '/ai-tools/slides',
      '/ai-tools/classroom/presentation',
      '/evaluations/abc123/results',
      '/curriculum/lesson-detail',
    ]) {
      assert.equal(isEntryRoute(p), false, p);
    }
  });

  it('keeps the tabs themselves navigable on reload', () => {
    // Reloading on /profile should stay on /profile, not bounce to the index.
    for (const p of ['/profile', '/iqra', '/ai-tools', '/curriculum', '/notifications']) {
      assert.equal(isEntryRoute(p), false, p);
    }
  });

  it('does not match a route that merely starts with an entry name', () => {
    // '/registered-classes' is not '/register'.
    assert.equal(isEntryRoute('/registered-classes'), false);
    assert.equal(isEntryRoute('/logins'), false);
  });
});

describe('isPublicRoute', () => {
  it('lets a student reach an exam link without an account', () => {
    for (const p of ['/take', '/take/9VBMQD', '/take/9VBMQD/answer']) {
      assert.equal(isPublicRoute(p), true, p);
    }
  });

  it('keeps every teacher route private', () => {
    for (const p of ['/', '/home', '/classes', '/evaluations', '/admin/dashboard', '/workspace']) {
      assert.equal(isPublicRoute(p), false, p);
    }
  });

  it('does not open a route that merely starts with the same letters', () => {
    // '/takeover' is not '/take'. A prefix check without the boundary would
    // make any future route beginning "take" public.
    assert.equal(isPublicRoute('/takeover'), false);
    assert.equal(isPublicRoute('/taken'), false);
  });

  it('treats no path as private, unlike isEntryRoute', () => {
    // isEntryRoute answers true here because there is no destination to keep.
    // This one must fail closed: unknown is not public.
    assert.equal(isPublicRoute(null), false);
    assert.equal(isPublicRoute(undefined), false);
    assert.equal(isPublicRoute(''), false);
  });
});
