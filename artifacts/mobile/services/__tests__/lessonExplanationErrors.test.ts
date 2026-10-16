import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isNotAvailable } from '../lessonExplanationErrors.ts';

// The server's own «nothing approved for this lesson» answer is a 404 that
// carries `code: 'not_available'`. A 404 without it is something else — an API
// revision that has no such route — and must not be shown to a student as
// «قريبًا», because that would be permanent and wrong.
test('a 404 with code not_available is the "no explanation yet" answer', () => {
  assert.equal(isNotAvailable({ status: 404, code: 'not_available' }), true);
});

test('an ApiError-shaped object (an Error carrying status and code) counts too', () => {
  const err = Object.assign(new Error('No explanation is available for this lesson.'), { status: 404, code: 'not_available' });
  assert.equal(isNotAvailable(err), true);
});

test('a plain 404 is not "not available" (route missing on an older API)', () => {
  assert.equal(isNotAvailable({ status: 404 }), false);
  assert.equal(isNotAvailable({ status: 404, code: undefined }), false);
  assert.equal(isNotAvailable({ status: 404, code: 'not_found' }), false);
  assert.equal(isNotAvailable(Object.assign(new Error('Request failed: 404'), { status: 404 })), false);
});

test('the code on another status is not "not available"', () => {
  for (const status of [200, 400, 401, 403, 500, 503, undefined]) {
    assert.equal(isNotAvailable({ status, code: 'not_available' }), false, String(status));
  }
});

test('a status that is not the number 404 is not "not available"', () => {
  assert.equal(isNotAvailable({ status: '404', code: 'not_available' }), false);
});

test('null, undefined and non-objects are not "not available"', () => {
  for (const v of [null, undefined, 404, 'not_available', true, [], () => {}]) {
    assert.equal(isNotAvailable(v), false, String(v));
  }
});
