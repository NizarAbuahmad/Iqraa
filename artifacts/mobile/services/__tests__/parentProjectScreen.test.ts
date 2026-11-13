/**
 * The parent's project screen (`app/homework-project/child/[id].tsx`), its link on «المدرسة», and the parent's
 * landing route.
 *
 * The screens import react-native and expo, which `node --test` cannot load, so this reads their source (the pattern
 * homeworkProjectScreen.test.ts uses). What it proves is textual; how the screen looks is checked in a browser.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { childProjectHref } from '../homework.ts';
import { isNonTeacherRoute } from '../routeGating.ts';
import { shouldTrackScreen } from '../screenTracking.ts';
import { homeHrefFor } from '../tour.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => readFileSync(path.resolve(here, '../..', rel), 'utf8');
const screen = read('app/homework-project/child/[id].tsx');
const school = read('app/(tabs)/school.tsx');
const index = read('app/(tabs)/index.tsx');

describe('parent project screen: where it lives', () => {
  const href = childProjectHref('3f0c8a4e-1111-4222-8333-944455556666', 'k1', 'مشروع');
  const pathname = href.split('?')[0]!;

  it('a parent may open it (route allowlist)', () => {
    assert.equal(isNonTeacherRoute(pathname), true);
  });

  it('is never reported to analytics: it shows a minor’s photos and its path carries a homework id', () => {
    assert.equal(shouldTrackScreen(pathname), false);
  });
});

describe('parent project screen: read-only, from the parent route', () => {
  it('reads through the parent client and nothing that writes', () => {
    assert.match(screen, /parentProjectApi\.get\(/);
    assert.doesNotMatch(screen, /homeworkSubmissionApi|teacherSubmissionsApi/);
    assert.doesNotMatch(screen, /method:\s*'(POST|PUT|PATCH|DELETE)'/);
    assert.doesNotMatch(screen, /\.clear\(|\.handIn\(|\.upload/);
  });

  it('never mistakes a failed load for an empty project', () => {
    assert.match(screen, /if \(failure\)/);
    assert.match(screen, /t\('retry'\)/);
    // A reload that fails while a project is shown keeps it.
    assert.match(screen, /hasData\.current && !final/);
  });

  it('reads the project again on every focus (signed photo links live ten minutes)', () => {
    assert.match(screen, /useFocusEffect\(/);
  });

  it('opens on the child «المدرسة» was showing', () => {
    assert.match(screen, /childrenToShow\(children, childKey\)/);
  });
});

describe('parent project screen: the shared design rules', () => {
  it('takes colours from useColors(), never the global palette', () => {
    assert.match(screen, /useColors\(\)/);
    assert.doesNotMatch(screen, /\bpalette\b/);
  });

  it('adds no keyboard avoidance of its own', () => {
    assert.doesNotMatch(screen, /KeyboardAvoidingView/);
  });

  it('draws cards with useSurface(), with no leftover border width and no clipping', () => {
    assert.match(screen, /useSurface\(/);
    assert.doesNotMatch(screen, /borderWidth: 1\b/);
    assert.doesNotMatch(screen, /overflow: 'hidden'/);
  });

  it('caps the content width', () => {
    assert.match(screen, /maxWidth: CONTENT_MAX_WIDTH/);
  });

  it('sizes every Ionicons from the ICON scale', () => {
    const icons = [...screen.matchAll(/<Ionicons\b[\s\S]*?\/>/g)].map(m => m[0]);
    assert.ok(icons.length >= 3, `found only ${icons.length} icons — the regex stopped matching`);
    for (const el of icons) assert.match(el, /size=\{ICON\.\w+\}/, el);
  });

  it('declares state with aria-* only, and draws no tick or cross with an emoji', () => {
    assert.doesNotMatch(screen, /accessibilityState=/);
    assert.doesNotMatch(screen, /[✓✕✗⚠💡✅❌]/u);
  });
});

describe('«المدرسة»: the parent’s way in', () => {
  it('shows the parent link by the tested rule and builds it with the tested href', () => {
    assert.match(school, /isParent && showsChildProjectLink\(item\)/);
    assert.match(school, /childProjectHref\(item\.id, childKey, item\.title\)/);
  });

  it('keeps the student’s hand-in link for students only', () => {
    assert.match(school, /const showLink = !isParent && showsSubmissionLink\(item\)/);
  });
});

describe('a parent lands on «المدرسة»', () => {
  it('the landing redirect uses the tour’s home href, so the two cannot drift', () => {
    assert.match(index, /homeHrefFor\(role\)/);
    assert.match(index, /tourRoleOf\(user\.role\)/);
    assert.equal(homeHrefFor('parent'), '/(tabs)/school');
  });

  it('an unknown role still fails closed to Messages', () => {
    assert.match(index, /role \? homeHrefFor\(role\) : '\/notifications'/);
  });
});
