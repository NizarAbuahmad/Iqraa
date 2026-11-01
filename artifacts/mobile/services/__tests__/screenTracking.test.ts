import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { shouldTrackScreen } from '../screenTracking.ts';

describe('shouldTrackScreen', () => {
  it('never reports the parent consent page', () => {
    for (const p of ['/guardian', '/guardian/', '/guardian/x']) assert.equal(shouldTrackScreen(p), false, p);
  });
  it('never reports a student’s homework project (a minor’s photos and note)', () => {
    for (const p of ['/homework-project', '/homework-project/', '/homework-project/hw-1', '/homework-project/a%20b']) {
      assert.equal(shouldTrackScreen(p), false, p);
    }
  });
  it('never reports a teacher’s view of the class’s projects (list or one student’s photos)', () => {
    for (const p of [
      '/homework-submissions',
      '/homework-submissions/',
      '/homework-submissions/h1',
      '/homework-submissions/h1/s1',
      '/homework-submissions/a%20b/c%20d',
    ]) {
      assert.equal(shouldTrackScreen(p), false, p);
    }
  });
  it('reports every other screen, including a lookalike', () => {
    for (const p of [
      '/',
      '/(tabs)',
      '/guardian-waiting',
      '/guardians',
      '/take/ABC234',
      '/live',
      '/homework-projects',
      '/homework-submissionsX',
      '/school',
    ]) {
      assert.equal(shouldTrackScreen(p), true, p);
    }
  });
});
