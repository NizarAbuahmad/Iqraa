import test from 'node:test';
import assert from 'node:assert/strict';
import {
  closedCopyKey,
  initialView,
  needsConfirmFirst,
  outcomeForDecideError,
  viewForDecision,
  viewForLookup,
  viewForLookupFailure,
  viewForMissingToken,
} from '../guardianConsentView.ts';
import { GuardianApiError } from '../guardianApi.ts';

test('web starts loading, native shows the browser note and nothing else', () => {
  assert.deepEqual(initialView(true), { kind: 'loading' });
  assert.deepEqual(initialView(false), { kind: 'browser' });
});

test('a missing or malformed token is a link that does not work, with no lookup', () => {
  assert.deepEqual(viewForMissingToken(), { kind: 'closed', reason: 'invalid' });
});

test('each lookup status maps to its own view', () => {
  assert.deepEqual(viewForLookup({ status: 'open', childFirstName: 'Sara' }), { kind: 'open', childFirstName: 'Sara' });
  assert.deepEqual(viewForLookup({ status: 'expired' }), { kind: 'closed', reason: 'expired' });
  assert.deepEqual(viewForLookup({ status: 'decided' }), { kind: 'closed', reason: 'decided' });
  assert.deepEqual(viewForLookup({ status: 'invalid' }), { kind: 'closed', reason: 'invalid' });
});

test('a lookup that threw is retry, never a closed link', () => {
  assert.deepEqual(viewForLookupFailure(), { kind: 'retry' });
});

test('a recorded decision is done and keeps which one', () => {
  assert.deepEqual(viewForDecision('approved'), { kind: 'done', decision: 'approved' });
  assert.deepEqual(viewForDecision('declined'), { kind: 'done', decision: 'declined' });
});

test('only approving needs the tick', () => {
  assert.equal(needsConfirmFirst('approved', false), true);
  assert.equal(needsConfirmFirst('approved', true), false);
  assert.equal(needsConfirmFirst('declined', false), false);
  assert.equal(needsConfirmFirst('declined', true), false);
});

test('decide errors: closed link reloads, missing tick warns, everything else is retry', () => {
  assert.deepEqual(outcomeForDecideError(new GuardianApiError('gone', 410)), { next: 'reload' });
  assert.deepEqual(outcomeForDecideError(new GuardianApiError('not found', 404)), { next: 'reload' });
  assert.deepEqual(outcomeForDecideError(new GuardianApiError('x', 400, 'guardian_confirmation_required')), { next: 'warn', warn: 'confirmFirst' });
  assert.deepEqual(outcomeForDecideError(new GuardianApiError('x', 429)), { next: 'warn', warn: 'retry' });
  assert.deepEqual(outcomeForDecideError(new GuardianApiError('x', 500)), { next: 'warn', warn: 'retry' });
  assert.deepEqual(outcomeForDecideError(new GuardianApiError('Network request failed', 0)), { next: 'warn', warn: 'retry' });
  assert.deepEqual(outcomeForDecideError(new Error('boom')), { next: 'warn', warn: 'retry' });
  assert.deepEqual(outcomeForDecideError(null), { next: 'warn', warn: 'retry' });
  assert.deepEqual(outcomeForDecideError('410'), { next: 'warn', warn: 'retry' });
});

test('a closed page has its own copy key', () => {
  assert.equal(closedCopyKey('expired'), 'parentConsentExpired');
  assert.equal(closedCopyKey('decided'), 'parentConsentDecided');
  assert.equal(closedCopyKey('invalid'), 'parentConsentInvalid');
});
