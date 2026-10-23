import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { isNoise, safeRole, scrub, scrubbedError } from '../crashReportingCore.ts';

describe('scrub', () => {
  it('removes emails', () => {
    assert.equal(scrub('failed for ahmad.k@school.edu.jo today'), 'failed for <email> today');
  });

  it('removes JWTs and bearer tokens', () => {
    const jwt = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NSJ9.c2lnbmF0dXJlX2hlcmU';
    assert.equal(scrub(`token ${jwt} rejected`), 'token <token> rejected');
    assert.equal(scrub('Authorization: Bearer abcDEF123456789'), 'Authorization: Bearer <token>');
  });

  it('removes the student link code and the personal login code', () => {
    assert.equal(scrub('GET /take/RKAU5K failed'), 'GET /take/<code> failed');
    assert.equal(scrub('code A1B2C3D4E5F6 is wrong'), 'code <code> is wrong');
  });

  it('keeps ordinary upper-case words and short constants', () => {
    assert.equal(scrub('NETWORK_ERROR and INTERNALERROR'), 'NETWORK_ERROR and INTERNALERROR');
    assert.equal(scrub('A12 is fine, ABCDEFGHIJKL has no digit'), 'A12 is fine, ABCDEFGHIJKL has no digit');
  });

  it('removes long numbers but not small ones', () => {
    assert.equal(scrub('phone 0791234567 on line 42'), 'phone <number> on line 42');
  });

  it('removes URL query strings', () => {
    assert.equal(scrub('fetch https://x.example/api/thing?name=Sara&id=3 failed'), 'fetch https://x.example/api/thing?<query> failed');
  });

  it('leaves Arabic text alone (it cannot recognise a name, so none is ever attached on purpose)', () => {
    assert.equal(scrub('تعذّر تحميل التقييم'), 'تعذّر تحميل التقييم');
  });

  it('cuts to the limit', () => {
    const out = scrub('x'.repeat(1000), 50);
    assert.equal(out.length, 51);
    assert.ok(out.endsWith('…'));
  });
});

describe('isNoise', () => {
  it('treats connectivity failures as noise', () => {
    assert.equal(isNoise(new TypeError('Network request failed')), true);
    assert.equal(isNoise(new TypeError('Failed to fetch')), true);
    const abort = new Error('The user aborted a request.');
    abort.name = 'AbortError';
    assert.equal(isNoise(abort), true);
  });

  it('does not hide real bugs', () => {
    assert.equal(isNoise(new TypeError("Cannot read properties of undefined (reading 'map')")), false);
  });
});

describe('scrubbedError', () => {
  it('keeps the type, scrubs the message and the stack', () => {
    const original = new RangeError('bad value for ahmad@school.jo');
    original.stack = 'RangeError: bad value for ahmad@school.jo\n    at f (app.bundle:1:2)';
    const clean = scrubbedError(original);
    assert.ok(clean);
    assert.equal(clean.name, 'RangeError');
    assert.equal(clean.message, 'bad value for <email>');
    assert.ok(!clean.stack?.includes('ahmad@'));
    assert.notEqual(clean, original, 'the original error object is never sent');
  });

  it('accepts things that are not Errors', () => {
    assert.equal(scrubbedError('plain string failure')?.message, 'plain string failure');
    assert.equal(scrubbedError({ toString: () => 'object failure' })?.message, 'object failure');
    assert.ok(scrubbedError(null));
  });

  it('returns null for connectivity noise', () => {
    assert.equal(scrubbedError(new TypeError('Network request failed')), null);
  });
});

describe('safeRole', () => {
  it('passes only the four known roles', () => {
    for (const role of ['teacher', 'parent', 'student', 'admin']) assert.equal(safeRole(role), role);
    assert.equal(safeRole('Ahmad Al-Rashidi'), undefined);
    assert.equal(safeRole(undefined), undefined);
    assert.equal(safeRole(42), undefined);
  });
});
