import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { takeErrorKey } from '../takeErrorKey.ts';

describe('takeErrorKey', () => {
  it('maps every code the student route answers with to a translation key', () => {
    assert.equal(takeErrorKey({ code: 'link_not_found', status: 404 }, 'takeStartFailed'), 'takeLinkFailed');
    assert.equal(takeErrorKey({ code: 'name_taken', status: 409 }, 'takeStartFailed'), 'takeNameTakenError');
    assert.equal(takeErrorKey({ code: 'no_level_scale', status: 409 }, 'takeStartFailed'), 'takeExamNotReady');
    assert.equal(takeErrorKey({ code: 'already_submitted', status: 409 }, 'takeSubmitFailed'), 'takeAlreadySubmitted');
    assert.equal(takeErrorKey({ code: 'token_invalid', status: 401 }, 'takeSubmitFailed'), 'takeSessionExpired');
    assert.equal(takeErrorKey({ code: 'time_up', status: 409 }, 'takeSaveFailed'), 'takeTimeUp');
    assert.equal(takeErrorKey({ code: 'exam_closed', status: 409 }, 'takeSaveFailed'), 'takeExamClosed');
  });

  it('names a used-up recording allowance, and never prints a recording rejection', () => {
    assert.equal(takeErrorKey({ code: 'too_many_takes', status: 429 }, 'readAloudFailed'), 'readAloudNoTakesLeft');
    // The rejection that hid a Chrome-only bug: the student read
    // "audio must be a base64 data URL". Unknown codes fall back.
    assert.equal(takeErrorKey({ code: 'bad_audio', status: 400 }, 'readAloudFailed'), 'readAloudFailed');
    assert.equal(takeErrorKey({ code: 'audio_too_long', status: 413 }, 'readAloudFailed'), 'readAloudFailed');
  });

  it('reads a rate limit off the status, which carries no code', () => {
    assert.equal(takeErrorKey({ code: '', status: 429 }, 'takeSaveFailed'), 'takeTooManyRequests');
  });

  it('falls back to the caller’s key for anything else, never the English body', () => {
    assert.equal(takeErrorKey({ code: 'something_else', status: 500 }, 'takeSubmitFailed'), 'takeSubmitFailed');
    assert.equal(takeErrorKey(new Error('boom'), 'takeSubmitFailed'), 'takeSubmitFailed');
    assert.equal(takeErrorKey(undefined, 'takeLinkFailed'), 'takeLinkFailed');
  });
});
