/**
 * What this guards: a material's share link (spec
 * docs/superpowers/specs/2026-11-20-material-share-link-design.md).
 *
 * The link is what a colleague taps in WhatsApp, so it must point at the live
 * site whatever host the teacher is on, open without an account, and the
 * message must carry the title in front of it. The code is the only credential
 * the link has, so a crash report must not carry it.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { PROD_ORIGIN } from '../siteOrigin.ts';
import { isLocalMaterialId, materialShareUrl, shareLinkMessage } from '../materialShareLink.ts';
import { isPublicRoute } from '../routeGating.ts';
import { scrub } from '../crashReportingCore.ts';

describe('material share link', () => {
  it('points at the live site', () => {
    assert.equal(materialShareUrl('K7QX4MPA'), `${PROD_ORIGIN}/m/K7QX4MPA`);
  });

  it('puts the title in front of the link, in the teacher\'s language', () => {
    const url = materialShareUrl('K7QX4MPA');
    const ar = shareLinkMessage('اختبار قانون الجيوب', url, true);
    assert.ok(ar.startsWith('اختبار قانون الجيوب'), ar);
    assert.ok(ar.includes('إقرأ'), ar);
    assert.ok(ar.endsWith(url), ar);
    const en = shareLinkMessage('Sine rule quiz', url, false);
    assert.ok(en.startsWith('Sine rule quiz'), en);
    assert.ok(en.includes('Iqrra'), en);
    assert.ok(en.endsWith(url), en);
  });

  it('opens without an account, and only under /m/', () => {
    for (const p of ['/m', '/m/K7QX4MPA']) assert.equal(isPublicRoute(p), true, p);
    for (const p of ['/messaging', '/my-exams', '/mx/K7QX4MPA']) assert.equal(isPublicRoute(p), false, p);
  });

  it('keeps the code out of a crash report', () => {
    assert.equal(scrub('GET /shared/K7QX4MPA failed on /m/K7QX4MPA'), 'GET /shared/<code> failed on /m/<code>');
  });

  it('tells a device-only save from one the server holds', () => {
    assert.equal(isLocalMaterialId('ws_1732090000000_ab12cd'), true);
    assert.equal(isLocalMaterialId('7c1f3a52-0d4e-4b8a-9c36-2e5f8a1b7d90'), false);
  });
});
