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

describe('scrub: parent consent links', () => {
  const TOKEN = 'AbCdEfGhIjKlMnOpQrStUvWxYz0123456789_-abcde';
  it('removes a fragment and a bare consent token', () => {
    assert.ok(!scrub(`Failed at https://app.iqrra.com/guardian#${TOKEN}`).includes(TOKEN));
    assert.ok(!scrub(`bad token ${TOKEN} here`).includes(TOKEN));
    // A token that starts or ends with "-" must go too.
    const EDGE = `-${TOKEN.slice(1, 42)}-`;
    assert.equal(EDGE.length, 43);
    assert.ok(!scrub(`edge ${EDGE} end`).includes(EDGE));
    assert.match(scrub('see https://x.test/p#frag-ment_123456789012'), /#<fragment>/);
  });
  it('removes the whole token even when an earlier rule would match a piece of it', () => {
    // A dash-flanked run of 6+ digits (<number>) or of 12 capitals/digits (<code>) inside a token must not
    // pre-empt the token rule and leave the rest of the token behind.
    const shapes = [
      `${'a'.repeat(20)}-123456-${'b'.repeat(15)}`,
      `${'a'.repeat(18)}-ABCDEFGH1234-${'b'.repeat(11)}`,
      `123456-${'b'.repeat(36)}`,
      `${'b'.repeat(36)}-123456`,
    ];
    for (const t of shapes) {
      assert.equal(t.length, 43, t);
      for (const text of [`bad token ${t} here`, `https://app.iqrra.com/guardian#${t}`]) {
        const out = scrub(text);
        for (let i = 0; i + 20 <= t.length; i++) {
          assert.ok(!out.includes(t.slice(i, i + 20)), `${t.slice(i, i + 20)} survived in ${out}`);
        }
      }
    }
  });
  it('still redacts a whole JWT, whose signature is also 43 base64url characters', () => {
    const header = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9';
    const payload = 'eyJzdWIiOiIxMjM0NTY3ODkwIiwicm9sZSI6InN0dWRlbnQifQ';
    const sig = 'SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
    assert.equal(sig.length, 43);
    const out = scrub(`Failed with token ${header}.${payload}.${sig} for user`);
    assert.ok(!out.includes(header) && !out.includes(payload) && !out.includes(sig), out);
    assert.equal(out, 'Failed with token <token> for user');
  });
  it('still redacts numbers and codes that are not part of a token', () => {
    assert.match(scrub('call 0791234567 now'), /<number>/);
    assert.match(scrub('code ABCDEFGH1234 used'), /<code>/);
  });
  it('leaves ordinary words and short ids alone', () => {
    assert.equal(scrub('Cannot read property of undefined'), 'Cannot read property of undefined');
    assert.match(scrub('item #12 failed'), /#12/);
  });
});
