import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { queryKeysToRefresh, routeFromNotificationData, threadIdFromNotificationData } from '../notificationDeepLink.ts';
import { classLinkRequestsQueryKey, linkRequestSummaryQueryKey } from '../rosterQueryKeys.ts';

describe('routeFromNotificationData', () => {
  it('opens the thread for a message push', () => {
    assert.equal(routeFromNotificationData({ threadId: 't1' }), '/messaging/t1');
  });

  it('opens the class for a join-request push, and only a real class id', () => {
    const id = '3f2b8c1e-9a4d-4e6f-8b7a-1c2d3e4f5a6b';
    assert.equal(routeFromNotificationData({ screen: 'class-link-requests', classGroupId: id }), `/classes/${id}`);
    assert.equal(routeFromNotificationData({ screen: 'class-link-requests', classGroupId: '../admin' }), '/classes');
    assert.equal(routeFromNotificationData({ screen: 'class-link-requests' }), '/classes');
  });

  it('opens the admin report queue for an artifact-report push', () => {
    assert.equal(routeFromNotificationData({ screen: 'artifact-reports' }), '/admin/artifact-reports');
  });

  it('opens «اختباراتي» for a results-release push', () => {
    assert.equal(routeFromNotificationData({ screen: 'my-exams' }), '/my-exams');
  });

  it('opens the School tab for a homework, reminder or exam-date push', () => {
    assert.equal(routeFromNotificationData({ screen: 'school' }), '/school');
  });

  it('still ignores a screen that only looks like the School tab', () => {
    assert.equal(routeFromNotificationData({ screen: '/school' }), null);
    assert.equal(routeFromNotificationData({ screen: 'school/../admin' }), null);
  });

  it('opens the collected-emails list for a waitlist-signup push', () => {
    assert.equal(routeFromNotificationData({ screen: 'admin-signups' }), '/admin/signups');
  });

  it('opens moderation for a message-report push and AI costs for an AI alert', () => {
    // api-server lib/messageReportAlert.ts and lib/aiAlerts.ts.
    assert.equal(routeFromNotificationData({ screen: 'moderation' }), '/admin/moderation');
    assert.equal(routeFromNotificationData({ screen: 'ai-costs' }), '/admin/ai-costs');
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

describe('queryKeysToRefresh', () => {
  const id = '3f2b8c1e-9a4d-4e6f-8b7a-1c2d3e4f5a6b';

  it("marks the bell's count and that class's list stale when a join request arrives", () => {
    assert.deepEqual(queryKeysToRefresh({ screen: 'class-link-requests', classGroupId: id }), [
      linkRequestSummaryQueryKey,
      classLinkRequestsQueryKey(id),
    ]);
  });

  it('still refreshes the bell when the class id is missing or malformed', () => {
    assert.deepEqual(queryKeysToRefresh({ screen: 'class-link-requests' }), [linkRequestSummaryQueryKey]);
    assert.deepEqual(queryKeysToRefresh({ screen: 'class-link-requests', classGroupId: '../x' }), [linkRequestSummaryQueryKey]);
  });

  it('refreshes nothing for any other push', () => {
    assert.deepEqual(queryKeysToRefresh({ threadId: 't1' }), []);
    assert.deepEqual(queryKeysToRefresh({ screen: 'school' }), []);
    assert.deepEqual(queryKeysToRefresh(null), []);
    assert.deepEqual(queryKeysToRefresh('class-link-requests'), []);
  });

  // pushTokens.ts imports expo-notifications, which node:test cannot load, so
  // its wiring is read as text: a push that ARRIVES (not only one tapped) must
  // reach these keys, or the bell lags a minute behind the phone's own banner.
  it('is wired to arriving pushes in pushTokens.ts', () => {
    const here = path.dirname(fileURLToPath(import.meta.url));
    const src = readFileSync(path.join(here, '../pushTokens.ts'), 'utf8');
    assert.match(src, /addNotificationReceivedListener\(/);
    assert.match(src, /queryKeysToRefresh\(/);
    assert.match(src, /queryClient\.invalidateQueries\(/);
  });
});
