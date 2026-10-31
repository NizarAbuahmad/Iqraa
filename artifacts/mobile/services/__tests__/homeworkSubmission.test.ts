import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PHOTOS_MAX, NOTE_MAX, normalizeSubmission, normalizeSubmissionState, emptySubmission,
  slotsLeft, canAddPhoto, canHandIn, noteChanged, photoDataUrlOk, stateLabelKey,
} from '../homeworkSubmission.ts';

test('limits mirror the server', () => {
  assert.equal(PHOTOS_MAX, 6);
  assert.equal(NOTE_MAX, 2000);
});

test('state: only the three known values survive', () => {
  assert.equal(normalizeSubmissionState('submitted'), 'submitted');
  assert.equal(normalizeSubmissionState('late'), 'late');
  assert.equal(normalizeSubmissionState('none'), 'none');
  assert.equal(normalizeSubmissionState('draft'), 'none');
  assert.equal(normalizeSubmissionState(undefined), 'none');
  assert.equal(normalizeSubmissionState(3), 'none');
});

test('normalizeSubmission is tolerant and drops bad photos', () => {
  assert.deepEqual(normalizeSubmission(null), emptySubmission());
  assert.deepEqual(normalizeSubmission('x'), emptySubmission());
  const v = normalizeSubmission({
    status: 'late', locked: true, note: 'hi', submittedAt: '2026-10-01T10:00:00.000Z',
    photos: [
      { id: 'a', url: 'https://x/a.jpg', mime: 'image/jpeg', sizeBytes: 10 },
      { id: 7 }, null, { url: 'u' },
      { id: 'b', url: null, mime: 'image/png', sizeBytes: 5 },
    ],
  });
  assert.equal(v.status, 'late');
  assert.equal(v.locked, true);
  assert.equal(v.note, 'hi');
  assert.deepEqual(v.photos.map(p => p.id), ['a', 'b']);
  assert.equal(v.photos[1].url, null);
});

test('locked defaults to false and a non-boolean is false', () => {
  assert.equal(normalizeSubmission({ locked: 'yes' }).locked, false);
});

test('slots and add rule', () => {
  assert.equal(slotsLeft(0), 6);
  assert.equal(slotsLeft(6), 0);
  assert.equal(slotsLeft(9), 0);
  assert.equal(canAddPhoto({ photos: [1, 2, 3, 4, 5], locked: false }), true);
  assert.equal(canAddPhoto({ photos: [1, 2, 3, 4, 5, 6], locked: false }), false);
  assert.equal(canAddPhoto({ photos: [], locked: true }), false);
});

test('hand-in needs a photo or a non-blank note, and not locked', () => {
  assert.equal(canHandIn({ photos: [], locked: false }, ''), false);
  assert.equal(canHandIn({ photos: [], locked: false }, '   \n'), false);
  assert.equal(canHandIn({ photos: [], locked: false }, 'x'), true);
  assert.equal(canHandIn({ photos: [1], locked: false }, ''), true);
  assert.equal(canHandIn({ photos: [1], locked: true }, 'x'), false);
});

test('noteChanged compares trimmed text', () => {
  assert.equal(noteChanged('a', ' a '), false);
  assert.equal(noteChanged('a', 'b'), true);
  assert.equal(noteChanged('', '  '), false);
});

test('photoDataUrlOk accepts jpeg/png/webp base64 only, within the server cap', () => {
  assert.equal(photoDataUrlOk('data:image/jpeg;base64,AAAA'), true);
  assert.equal(photoDataUrlOk('data:image/png;base64,AAAA'), true);
  assert.equal(photoDataUrlOk('data:image/webp;base64,AAAA'), true);
  assert.equal(photoDataUrlOk('data:image/heic;base64,AAAA'), false);
  assert.equal(photoDataUrlOk('data:image/gif;base64,AAAA'), false);
  assert.equal(photoDataUrlOk('data:image/jpeg,AAAA'), false);
  assert.equal(photoDataUrlOk('image/jpeg;base64,AAAA'), false);
  assert.equal(photoDataUrlOk('data:image/jpeg;base64,' + 'A'.repeat(6_000_000)), false);
});

test('label keys', () => {
  assert.equal(stateLabelKey('none'), 'submissionNone');
  assert.equal(stateLabelKey('submitted'), 'submissionSubmitted');
  assert.equal(stateLabelKey('late'), 'submissionLate');
});
