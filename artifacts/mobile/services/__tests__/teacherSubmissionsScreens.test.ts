/**
 * The teacher's screens over a homework's project submissions. This file is the LIST screen
 * (`app/homework-submissions/[homeworkId]/index.tsx`); the detail screen's tests join it later.
 *
 * The screen imports react-native and expo-router, which `node --test` cannot load, so this reads the source
 * (the pattern homeworkProjectScreen.test.ts uses). What it proves is textual; how it looks is checked in the
 * browser, not here.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import translations from '../i18n.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
const listSrc = readFileSync(path.resolve(here, '../../app/homework-submissions/[homeworkId]/index.tsx'), 'utf8');

/** The text after the first `marker` in the list screen, `n` characters long. */
function after(marker: string | RegExp, n: number): string {
  const at = typeof marker === 'string' ? listSrc.indexOf(marker) : listSrc.search(marker);
  assert.ok(at >= 0, `the list screen no longer contains ${String(marker)} — update this test`);
  return listSrc.slice(at, at + n);
}

describe('submissions list screen: the shared design rules', () => {
  it('takes colours from useColors(), never the global palette', () => {
    assert.match(listSrc, /useColors\(\)/);
    assert.doesNotMatch(listSrc, /\bpalette\b/);
  });

  it('draws rows with useSurface(), with no leftover border width and no clipping', () => {
    assert.match(listSrc, /useSurface\(/);
    assert.doesNotMatch(listSrc, /borderWidth: 1\b/);
    assert.doesNotMatch(listSrc, /overflow: 'hidden'/);
  });

  it('adds no keyboard avoidance (it has no input, and the root Stack wraps every screen)', () => {
    assert.doesNotMatch(listSrc, /KeyboardAvoidingView/);
  });

  it('declares state with aria-* only', () => {
    assert.doesNotMatch(listSrc, /accessibilityState=/);
    assert.match(listSrc, /aria-disabled=/);
  });

  it('caps the content width and uses the shared header pieces', () => {
    assert.match(listSrc, /maxWidth: CONTENT_MAX_WIDTH/);
    assert.match(listSrc, /<BackButton\b/);
    assert.match(listSrc, /accessibilityRole="header"/);
  });

  it('sizes every Ionicons from the ICON scale', () => {
    const icons = [...listSrc.matchAll(/<Ionicons\b[\s\S]*?\/>/g)].map(m => m[0]);
    assert.ok(icons.length >= 4, `found only ${icons.length} icons — the regex stopped matching`);
    for (const el of icons) assert.match(el, /size=\{ICON\.\w+\}/, el);
  });

  it('draws no tick, cross, warning or tip with an emoji', () => {
    assert.doesNotMatch(listSrc, /[✓✕✗⚠💡✅❌]/u);
  });

  it('prints the due day through formatDueDate and builds no Date of its own', () => {
    assert.match(listSrc, /formatDueDate\(/);
    assert.doesNotMatch(listSrc, /new Date\(/);
  });

  it('takes sizes from the scales: no hand-written shadow, and rows at least 44 points tall', () => {
    assert.doesNotMatch(listSrc, /shadowColor/);
    assert.match(listSrc, /minHeight: 44/);
  });
});

describe('submissions list screen: the rows', () => {
  it('reads the list through the bound API client and the shared look and label', () => {
    assert.match(listSrc, /import \{ teacherSubmissionsApi \} from '@\/services\/teacherSubmissionsApi\.default'/);
    assert.match(listSrc, /teacherSubmissionsApi\.list\(/);
    assert.match(listSrc, /submissionLook\(state\)/);
    assert.match(listSrc, /t\(stateLabelKey\(state\)\)/);
  });

  it('draws a record with no account as its own neutral state, from rowState, with an icon and a word', () => {
    assert.match(listSrc, /import \{[^}]*\browState\b[^}]*\} from '@\/services\/teacherSubmissions'/);
    assert.match(listSrc, /const state = rowState\(row\);/);
    assert.match(listSrc, /state === 'noAccount' \? NO_ACCOUNT_LOOK : submissionLook\(state\)/);
    assert.match(listSrc, /state === 'noAccount' \? t\('subRowNoAccount'\)/);
    assert.match(listSrc, /NO_ACCOUNT_LOOK: ChipLook = \{ icon: '[a-z-]+', tone: 'muted' \}/);
  });

  it('never leaves the status to colour: an icon and the label sit side by side', () => {
    const chip = after('const state = rowState(row)', 2200);
    assert.match(chip, /<Ionicons name=\{look\.icon\}/);
    assert.match(chip, /\{statusText\}/);
  });

  it('shows the photo count with an icon and a number, for a handed-in row', () => {
    assert.match(listSrc, /name="images-outline"/);
    assert.match(listSrc, /row\.photoCount/);
  });

  it('opens a project only when rowOpensDetail(row) says it has one', () => {
    assert.match(listSrc, /import \{[^}]*\browOpensDetail\b[^}]*\} from '@\/services\/teacherSubmissions'/);
    assert.equal((listSrc.match(/rowOpensDetail\(row\)/g) ?? []).length, 1, 'ask once, keep the answer');
    assert.match(listSrc, /const opens = rowOpensDetail\(row\);/);
    const branch = listSrc.indexOf('if (opens) {');
    assert.ok(branch >= 0, 'the pressable row must sit behind `if (opens)`');
    const push = listSrc.indexOf('router.push(');
    assert.ok(push > branch, 'the push comes after the guard');
    assert.equal((listSrc.match(/router\.push\(/g) ?? []).length, 1, 'one push, behind the guard');
    assert.equal((listSrc.match(/<PressableScale\b/g) ?? []).length, 1, 'only one pressable row, the openable one');
    // The branch that is not guarded is the plain View.
    assert.ok(listSrc.indexOf('<View aria-disabled') > push, 'the plain row follows the guarded one');
  });

  it('pushes /homework-submissions/<homeworkId>/<studentId>, both encoded', () => {
    assert.match(
      listSrc,
      /router\.push\(`\/homework-submissions\/\$\{encodeURIComponent\(homeworkId\)\}\/\$\{encodeURIComponent\(row\.studentId\)\}` as never\)/,
    );
  });

  it('names the openable row with subRowOpenA11y, and makes it a 44-point target', () => {
    const press = after('<PressableScale', 700);
    // The label replaces the row's children, so it carries the state and the photo count too.
    assert.match(press, /aria-label=\{t\('subRowOpenA11y', name, statusText, row\.photoCount\)\}/);
    assert.match(press, /accessibilityRole="button"/);
    assert.match(listSrc, /row: \{[^}]*minHeight: 44/);
  });

  it('flips the chevron for RTL', () => {
    assert.match(listSrc, /isRTL \? 'chevron-back' : 'chevron-forward'/);
  });

  it('draws a row with no project as a plain View, disabled, with no chevron and no hint of a draft', () => {
    assert.match(after('<View aria-disabled', 120), /<View aria-disabled=\{true\} style=\{\[styles\.row, surface/);
    // The chevron and the photo count are drawn once, inside `opens ? (…)`.
    const gated = after('{opens ? (', 1100);
    assert.match(gated, /images-outline/);
    assert.match(gated, /chevron-back/);
    assert.equal((listSrc.match(/chevron-/g) ?? []).length, 2, 'one chevron expression (back and forward)');
    assert.equal((listSrc.match(/images-outline/g) ?? []).length, 1);
    // Nothing on the screen speaks of a draft: the teacher is not told that unsent work exists.
    assert.doesNotMatch(listSrc.replace(/\/\*[\s\S]*?\*\//g, ''), /draft/i);
  });
});

describe('submissions list screen: loading', () => {
  it('guards against a stale load with loadSeq', () => {
    assert.match(listSrc, /const loadSeq = useRef\(0\)/);
    assert.match(listSrc, /const seq = \+\+loadSeq\.current/);
    assert.equal((listSrc.match(/seq !== loadSeq\.current/g) ?? []).length, 2, 'both the success and the failure path check it');
  });

  it('reloads on every focus (a count changes after a clear on the detail screen)', () => {
    assert.match(listSrc, /useFocusEffect\(/);
    assert.match(after('useFocusEffect(', 160), /void load\(\)/);
  });

  it('shows a failed load as an error with a retry, never as an empty class', () => {
    assert.match(listSrc, /subListLoadFailed/);
    assert.match(listSrc, /t\('retry'\)/);
    assert.match(listSrc, /accessibilityRole="alert"/);
  });

  it('treats a 404 or 403 as final: its own wording and no retry that can only fail again', () => {
    assert.match(listSrc, /const final = status === 404 \|\| status === 403;/);
    assert.match(listSrc, /errNotFound/);
    assert.match(listSrc, /failure\.final \? null/);
  });

  it('keeps the list a failed reload could not refresh, and says so', () => {
    // Only a final answer drops the list; any other failure with a list shown becomes a notice above it.
    assert.match(listSrc, /if \(final\) setData\(null\)/);
    assert.match(listSrc, /failure && \(failure\.final \|\| !data\)/);
    assert.match(after('ListHeaderComponent={', 200), /failure \?/);
  });

  it('says so with an EmptyState when the class has no students', () => {
    assert.match(listSrc, /<EmptyState\b/);
    assert.match(listSrc, /subListEmpty/);
  });

  it('puts the homework, its due day and the handed-in count in the header', () => {
    const head = after('accessibilityRole="header"', 1200);
    assert.match(head, /t\('subListTitle'\)/);
    assert.match(listSrc, /data\.homework\.title/);
    assert.match(listSrc, /t\('subListDue', formatDueDate\(/);
    assert.match(listSrc, /t\('hwSubmittedCount', shown\.submitted, shown\.of\)/);
  });

  it("counts «X of Y» as the card does: projectSubmittedText over trackableCount, never the number of rows", () => {
    assert.match(listSrc, /import \{ formatDueDate, projectSubmittedText \} from '@\/services\/homework'/);
    assert.match(listSrc, /const shown = data \? projectSubmittedText\(data\) : null;/);
    assert.doesNotMatch(listSrc, /submissions\.length/);
  });
});

describe('submissions list screen: copy', () => {
  it('has every new key in both languages, the function ones as functions', () => {
    for (const lang of ['ar', 'en'] as const) {
      const tr = translations[lang] as Record<string, unknown>;
      for (const k of ['subListTitle', 'subListEmpty', 'subListLoadFailed', 'subRowNoAccount']) assert.equal(typeof tr[k], 'string', `${lang}.${k}`);
      for (const k of ['subListDue', 'subRowOpenA11y']) assert.equal(typeof tr[k], 'function', `${lang}.${k}`);
    }
  });

  it('says the agreed things', () => {
    assert.equal(translations.ar.subListTitle, 'مشاريع الطلبة');
    assert.equal(translations.en.subListTitle, 'Student projects');
    assert.equal(translations.ar.subListEmpty, 'لا يوجد طلبة في هذا الصف بعد');
    assert.equal(translations.en.subListEmpty, 'No students in this class yet');
  });

  it('the due line carries the date it is given, in both languages', () => {
    assert.ok(translations.ar.subListDue('05-11-2026').includes('05-11-2026'));
    assert.ok(translations.en.subListDue('05-11-2026').includes('05-11-2026'));
  });

  it('says the agreed things for a record with no account', () => {
    assert.equal(translations.ar.subRowNoAccount, 'بلا حساب');
    assert.equal(translations.en.subRowNoAccount, 'No account');
  });

  it('the row name carries the student, the state and the photos, in both languages', () => {
    assert.equal(translations.ar.subRowOpenA11y('سارة', 'تم التسليم', 3), 'افتح مشروع سارة، تم التسليم، 3 صور');
    assert.equal(translations.en.subRowOpenA11y('Sara', 'Handed in', 3), "Open Sara's project, Handed in, 3 photos");
    assert.equal(translations.ar.subRowOpenA11y('سارة', 'تم التسليم', 1), 'افتح مشروع سارة، تم التسليم، صورة');
    assert.equal(translations.ar.subRowOpenA11y('سارة', 'تم التسليم', 2), 'افتح مشروع سارة، تم التسليم، صورتان');
    assert.equal(translations.ar.subRowOpenA11y('سارة', 'تم التسليم', 12), 'افتح مشروع سارة، تم التسليم، 12 صورة');
    assert.equal(translations.en.subRowOpenA11y('Sara', 'Handed in', 1), "Open Sara's project, Handed in, 1 photo");
  });

  it('says nothing of photos for a project with none, and never prints undefined', () => {
    for (const lang of ['ar', 'en'] as const) {
      const out = translations[lang].subRowOpenA11y('X', 'S', 0);
      assert.ok(!/undefined|0/.test(out), out);
    }
  });
});
