/**
 * The project screen's decisions (`app/homework-project/[id].tsx`), kept where `node --test` can run them:
 * when the note's draft must be saved, when a removal would empty a handed-in project, which failures may have
 * stored an upload, when the draft follows the server, and when a hand-in is celebrated.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  celebratesHandIn,
  draftAfterSaveRefusal,
  draftAfterServer,
  isEmptyRefusal,
  isStaleRefusal,
  needsLateConfirm,
  noteNeedsSave,
  photoSlotSize,
  submissionLook,
  removalWouldEmpty,
  saveAgain,
  uploadMayHaveStored,
} from '../homeworkProject.ts';
import { SubmissionError } from '../homeworkSubmissionApi.ts';

const photos = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `p${i}` }));

describe('noteNeedsSave', () => {
  it('saves a changed draft of an open project', () => {
    assert.equal(noteNeedsSave({ locked: false }, 'a', 'b'), true);
  });
  it('does not save an unchanged draft, nor one that differs only by outer spaces', () => {
    assert.equal(noteNeedsSave({ locked: false }, 'a', 'a'), false);
    assert.equal(noteNeedsSave({ locked: false }, 'a', ' a '), false);
  });
  it('never saves into a locked project, nor before the first load', () => {
    assert.equal(noteNeedsSave({ locked: true }, 'a', 'b'), false);
    assert.equal(noteNeedsSave({ locked: false }, null, 'b'), false);
  });
});

describe('saveAgain (an edit made while a save was in flight)', () => {
  it('saves again when the draft moved on after it was sent', () => {
    assert.equal(saveAgain('ab', 'abc', 'ab'), true);
  });
  it('does not loop when the draft is what was sent, even if the server normalised it', () => {
    assert.equal(saveAgain('ab', 'ab', 'ab'), false);
    assert.equal(saveAgain('a  b', 'a  b', 'a b'), false);
  });
  it('does not save again when the later edit came back to what the server holds', () => {
    assert.equal(saveAgain('ab', 'ab ', 'ab'), false);
  });
});

describe('removalWouldEmpty', () => {
  it('is true for the last photo of a handed-in project whose note will be blank', () => {
    assert.equal(removalWouldEmpty({ status: 'submitted', photos: photos(1) }, ''), true);
    assert.equal(removalWouldEmpty({ status: 'late', photos: photos(1) }, '   '), true);
  });
  it('is false when a note will remain (the draft is saved before the removal)', () => {
    assert.equal(removalWouldEmpty({ status: 'submitted', photos: photos(1) }, 'my poster'), false);
  });
  it('is false while other photos remain', () => {
    assert.equal(removalWouldEmpty({ status: 'submitted', photos: photos(2) }, ''), false);
  });
  it('is false before the project is handed in: a draft may be emptied', () => {
    assert.equal(removalWouldEmpty({ status: 'none', photos: photos(1) }, ''), false);
  });
});

describe('uploadMayHaveStored', () => {
  it('is true with no answer at all: offline, a timeout, an abort', () => {
    assert.equal(uploadMayHaveStored(new TypeError('Failed to fetch')), true);
    const abort = new Error('aborted');
    abort.name = 'AbortError';
    assert.equal(uploadMayHaveStored(abort), true);
    assert.equal(uploadMayHaveStored(undefined), true);
  });
  it('is true for a 2xx the client could not read: the server stored it', () => {
    assert.equal(uploadMayHaveStored(new SubmissionError('Unexpected response', 201)), true);
    assert.equal(uploadMayHaveStored(new SubmissionError('Unexpected response', 200)), true);
  });
  it('is true for a 5xx: the write may have happened before the failure', () => {
    assert.equal(uploadMayHaveStored(new SubmissionError('x', 500)), true);
    assert.equal(uploadMayHaveStored(new SubmissionError('x', 502)), true);
  });
  it('is false for a refusal: nothing was stored', () => {
    for (const status of [400, 403, 409, 413, 429]) {
      assert.equal(uploadMayHaveStored(new SubmissionError('x', status)), false, String(status));
    }
  });
});

describe('isStaleRefusal and isEmptyRefusal', () => {
  it('reads 409 and 404 as "the project changed under the screen"', () => {
    assert.equal(isStaleRefusal(new SubmissionError('x', 409, 'locked')), true);
    assert.equal(isStaleRefusal(new SubmissionError('x', 404)), true);
    assert.equal(isStaleRefusal(new SubmissionError('x', 500)), false);
    assert.equal(isStaleRefusal(new TypeError('offline')), false);
  });
  it('recognises the project route’s own `empty`, and no other feature’s', () => {
    assert.equal(isEmptyRefusal(new SubmissionError('x', 409, 'empty')), true);
    assert.equal(isEmptyRefusal(new SubmissionError('x', 409, 'locked')), false);
    assert.equal(isEmptyRefusal(Object.assign(new Error('x'), { status: 409, code: 'empty' })), false);
    assert.equal(isEmptyRefusal(null), false);
  });
});

describe('draftAfterServer', () => {
  it('takes the server’s note on the first load', () => {
    assert.equal(draftAfterServer(null, '', 'from server', false), 'from server');
  });
  it('follows the server while the student has not changed the draft', () => {
    assert.equal(draftAfterServer('old', 'old', 'new', false), 'new');
    assert.equal(draftAfterServer('old', 'old ', 'new', false), 'new');
  });
  it('keeps a draft the student changed', () => {
    assert.equal(draftAfterServer('old', 'typed', 'new', false), 'typed');
  });
  it('shows the server’s note once the project is locked, never an unsaved draft in the read-only field', () => {
    // Edited at 23:58, the save refused as locked after midnight: the teacher holds «A», not «B».
    assert.equal(draftAfterServer('A', 'B', 'A', true), 'A');
  });
});

describe('draftAfterSaveRefusal', () => {
  it('puts back the saved note after an `empty` refusal, so the refused clear is not retried on every blur', () => {
    assert.equal(draftAfterSaveRefusal(new SubmissionError('x', 409, 'empty'), 'my note', ''), 'my note');
  });
  it('keeps the draft after any other failure, so nothing typed is lost', () => {
    for (const e of [new SubmissionError('x', 409, 'locked'), new SubmissionError('x', 500), new TypeError('offline')]) {
      assert.equal(draftAfterSaveRefusal(e, 'my note', 'typed'), 'typed');
    }
  });
});

describe('submissionLook (the School row and the project screen draw a state alike)', () => {
  it('draws not handed in as a muted outline', () => {
    assert.deepEqual(submissionLook('none'), { icon: 'ellipse-outline', tone: 'muted' });
  });
  it('draws handed in as a filled tick in the primary colour', () => {
    assert.deepEqual(submissionLook('submitted'), { icon: 'checkmark-circle', tone: 'primary' });
  });
  it('draws late in the destructive colour, never amber (amber means now)', () => {
    assert.deepEqual(submissionLook('late'), { icon: 'time', tone: 'destructive' });
  });
  it('gives each state its own icon, so colour is never the only difference', () => {
    const icons = (['none', 'submitted', 'late'] as const).map(s => submissionLook(s).icon);
    assert.equal(new Set(icons).size, 3);
  });
});

describe('needsLateConfirm', () => {
  it('does not ask on the due day itself: it is not late yet', () => {
    assert.equal(needsLateConfirm('none', '2026-11-02', '2026-11-02'), false);
  });
  it('asks from the day after the due day, before a first hand-in', () => {
    assert.equal(needsLateConfirm('none', '2026-11-02', '2026-11-03'), true);
    assert.equal(needsLateConfirm('none', '2026-12-31', '2027-01-01'), true);
  });
  it('does not ask before the due day', () => {
    assert.equal(needsLateConfirm('none', '2026-11-02', '2026-11-01'), false);
  });
  it('does not ask for a project already handed in', () => {
    assert.equal(needsLateConfirm('submitted', '2026-11-02', '2026-11-03'), false);
    assert.equal(needsLateConfirm('late', '2026-11-02', '2026-11-03'), false);
  });
  it('does not ask when either day is unreadable', () => {
    assert.equal(needsLateConfirm('none', '', '2026-11-03'), false);
    assert.equal(needsLateConfirm('none', '2026-11-02', 'today'), false);
  });
});

describe('celebratesHandIn', () => {
  it('celebrates the crossing from not handed in to handed in on time', () => {
    assert.equal(celebratesHandIn('none', 'submitted'), true);
  });
  it('does not celebrate a late hand-in', () => {
    assert.equal(celebratesHandIn('none', 'late'), false);
  });
  it('does not celebrate handing in again', () => {
    assert.equal(celebratesHandIn('submitted', 'submitted'), false);
    assert.equal(celebratesHandIn('late', 'submitted'), false);
  });
  it('does not celebrate a hand-in that changed nothing', () => {
    assert.equal(celebratesHandIn('none', 'none'), false);
  });
});

describe('photoSlotSize', () => {
  it('fits three slots in a row where they can, capped at 104', () => {
    const size = photoSlotSize(296, 8);
    assert.ok(3 * size + 2 * 8 <= 296, `3 × ${size} + gaps overflows 296`);
    assert.equal(size, 93);
    assert.equal(photoSlotSize(1000, 8), 104);
  });
  it('never goes below a tappable size on a very narrow screen', () => {
    assert.equal(photoSlotSize(150, 8), 72);
  });
});
