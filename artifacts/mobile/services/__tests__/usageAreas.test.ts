/**
 * The time-spent heartbeat names an AREA, never a path (services/usageAreas.ts). These pin:
 * the app's list is the API's list (the server folds anything it does not know into `other`,
 * so a drift would silently lose a whole area); every top-level screen maps somewhere on
 * purpose; and no id or query ever survives the mapping.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { USAGE_AREAS, areaForPath } from '../usageAreas.ts';

const here = dirname(fileURLToPath(import.meta.url));
const appDir = join(here, '..', '..', 'app');
const apiFile = join(here, '..', '..', '..', 'api-server', 'src', 'lib', 'usageAreas.ts');

describe('usage areas', () => {
  it('is the same list, in the same order, as the API', () => {
    const src = readFileSync(apiFile, 'utf8');
    const block = src.slice(src.indexOf('USAGE_AREAS = ['), src.indexOf('] as const'));
    const apiList = [...block.matchAll(/"([a-z-]+)"/g)].map(m => m[1]);
    assert.deepEqual([...USAGE_AREAS], apiList);
  });

  it('maps the screens a teacher spends time on', () => {
    const cases: [string, string][] = [
      ['/', 'today'],
      ['/ai-tools', 'tools'],
      ['/ai-tools/quiz', 'gen-quiz'],
      ['/ai-tools/worksheet', 'gen-worksheet'],
      ['/ai-tools/lesson-plan', 'gen-lesson-plan'],
      ['/ai-tools/activity', 'gen-activity'],
      ['/ai-tools/slides', 'gen-slides'],
      ['/ai-tools/prompt-slides', 'gen-slides'],
      ['/ai-tools/classroom/presentation', 'classroom'],
      ['/ai-tools/whiteboard', 'classroom'],
      ['/ai-tools/parent-message', 'gen-other'],
      ['/iqra', 'chat'],
      ['/curriculum', 'curriculum'],
      ['/curriculum/lesson-detail', 'curriculum'],
      ['/curriculum/math/practice', 'corner-math'],
      ['/curriculum/lab', 'corner-lab'],
      ['/curriculum/quran/surah', 'corner-quran'],
      ['/curriculum/english', 'corner-english'],
      ['/play/memory', 'play'],
      ['/live/ABC123', 'play'],
      ['/classes/0b6c…/students', 'classes'],
      ['/evaluations/42', 'evaluations'],
      ['/take/XYZ', 'evaluations'],
      ['/my-exams', 'evaluations'],
      ['/homework-submissions/1', 'homework'],
      ['/schedule', 'schedule'],
      ['/calendar', 'schedule'],
      ['/teaching-plans', 'teaching-plans'],
      ['/workspace', 'workspace'],
      ['/messaging/thread/9', 'messaging'],
      ['/school', 'school'],
      ['/notifications', 'notifications'],
      ['/profile', 'profile'],
      ['/settings', 'profile'],
      ['/setup-subjects', 'profile'],
      ['/teacher-profile', 'profile'],
      ['/admin/insights', 'admin'],
      ['/something-new', 'other'],
    ];
    for (const [path, area] of cases) assert.equal(areaForPath(path), area, path);
  });

  it('ignores a query, a fragment and a trailing slash', () => {
    assert.equal(areaForPath('/ai-tools/quiz?lessonId=abc#x'), 'gen-quiz');
    assert.equal(areaForPath('/classes/'), 'classes');
  });

  it('never beats on the parent consent page', () => {
    assert.equal(areaForPath('/guardian'), null);
    assert.equal(areaForPath('/guardian/abc'), null);
  });

  it('gives every top-level screen of the app an area on purpose (not the catch-all)', () => {
    // Auth, error and dev screens are not "time in the product".
    const exempt = new Set(['(auth)', '+not-found', '_layout', 'dev', 'guardian', 'guardian-waiting', 'claim-required', 'join-class']);
    const names = readdirSync(appDir)
      .map(n => n.replace(/\.tsx$/, ''))
      .filter(n => !exempt.has(n));
    for (const name of names) {
      const path = name === '(tabs)' ? '/' : `/${name}`;
      assert.notEqual(areaForPath(path), 'other', `app/${name} maps to "other"`);
    }
    for (const tab of readdirSync(join(appDir, '(tabs)')).map(n => n.replace(/\.tsx$/, ''))) {
      if (tab === '_layout') continue;
      const path = tab === 'index' ? '/' : `/${tab}`;
      assert.notEqual(areaForPath(path), 'other', `app/(tabs)/${tab} maps to "other"`);
    }
  });
});
