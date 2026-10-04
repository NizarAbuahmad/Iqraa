import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { routeFromNotificationData, threadIdFromNotificationData } from '../notificationDeepLink.ts';

describe('routeFromNotificationData', () => {
  it('opens the thread for a message push', () => {
    assert.equal(routeFromNotificationData({ threadId: 't1' }), '/messaging/t1');
  });

  it('opens the admin report queue for an artifact-report push', () => {
    assert.equal(routeFromNotificationData({ screen: 'artifact-reports' }), '/admin/artifact-reports');
  });

  it('opens the student screen, with its unlink button, for a link push', () => {
    assert.equal(routeFromNotificationData({ screen: 'student-link', studentId: 's 1' }), '/messaging/claim/s%201');
    assert.equal(routeFromNotificationData({ screen: 'student-link' }), null);
  });

  it('ignores screens that are not whitelisted and malformed data', () => {
    assert.equal(routeFromNotificationData({ screen: '/admin/dashboard' }), null);
    assert.equal(routeFromNotificationData({ screen: 'toString' }), null);
    assert.equal(routeFromNotificationData({ screen: 7 }), null);
    assert.equal(routeFromNotificationData(null), null);
  });
});

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
