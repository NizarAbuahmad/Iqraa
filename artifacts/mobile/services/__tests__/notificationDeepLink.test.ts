import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { threadIdFromNotificationData } from '../notificationDeepLink.ts';

describe('threadIdFromNotificationData', () => {
  it('reads the threadId the server attaches to a message push', () => {
    assert.equal(threadIdFromNotificationData({ threadId: 'thread-123' }), 'thread-123');
  });

  it('returns null for anything that is not a string threadId', () => {
    assert.equal(threadIdFromNotificationData({}), null);
    assert.equal(threadIdFromNotificationData({ threadId: 42 }), null);
    assert.equal(threadIdFromNotificationData(null), null);
    assert.equal(threadIdFromNotificationData(undefined), null);
  });
});
