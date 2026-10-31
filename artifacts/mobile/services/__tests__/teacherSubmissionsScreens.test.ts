/**
 * The teacher's screens over a homework's project submissions: the LIST screen
 * (`app/homework-submissions/[homeworkId]/index.tsx`) and the DETAIL screen, one student's project and the button
 * that deletes it (`app/homework-submissions/[homeworkId]/[studentId].tsx`, the second half of this file).
 *
 * The screens import react-native and expo-router, which `node --test` cannot load, so this reads the source
 * (the pattern homeworkProjectScreen.test.ts uses). What it proves is textual; how it looks is checked in the
 * browser, not here.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
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

// ---------------------------------------------------------------------------------------------------------------
// The detail screen. It is read lazily, so a missing file fails these tests and not the list screen's above.
// ---------------------------------------------------------------------------------------------------------------

const detailFile = path.resolve(here, '../../app/homework-submissions/[homeworkId]/[studentId].tsx');
const detailSrc = (): string => readFileSync(detailFile, 'utf8');

/** The text after the first `marker` in the detail screen, `n` characters long. */
function dAfter(marker: string | RegExp, n: number): string {
  const src = detailSrc();
  const at = typeof marker === 'string' ? src.indexOf(marker) : src.search(marker);
  assert.ok(at >= 0, `the detail screen no longer contains ${String(marker)} — update this test`);
  return src.slice(at, at + n);
}

/** The body of `const <name> = async () => { … };` or `const <name> = () => { … };` (two-space indent, closing `};`). */
function handler(name: string): string {
  const src = detailSrc();
  const start = src.search(new RegExp(`const ${name} = (async )?\\(`));
  assert.ok(start >= 0, `the detail screen has no \`const ${name} = …\``);
  const end = src.indexOf('\n  };\n', start);
  assert.ok(end > start, `could not find the end of ${name}`);
  return src.slice(start, end);
}

/** The body of `const load = useCallback(async () => { … }, [deps]);`. */
function loadBody(): string {
  const src = detailSrc();
  const start = src.indexOf('const load = useCallback(');
  assert.ok(start >= 0, 'the detail screen has no `const load = useCallback(`');
  const end = src.indexOf('\n  }, [', start);
  assert.ok(end > start, 'could not find the end of load');
  return src.slice(start, end);
}

/** Where `needle` first appears in `body`, failing loudly when it does not. */
function at(body: string, needle: string | RegExp): number {
  const i = typeof needle === 'string' ? body.indexOf(needle) : body.search(needle);
  assert.ok(i >= 0, `${String(needle)} is missing from:\n${body}`);
  return i;
}

describe('submissions detail screen: the shared design rules', () => {
  it('takes colours from useColors(), never the global palette, and writes no hex colour', () => {
    const src = detailSrc();
    assert.match(src, /useColors\(\)/);
    assert.doesNotMatch(src, /\bpalette\b/);
    assert.doesNotMatch(src, /['"]#[0-9a-fA-F]{3,8}['"]/);
  });

  it('draws its cards with useSurface(), with no leftover border width and no clipping', () => {
    const src = detailSrc();
    assert.match(src, /useSurface\(/);
    assert.ok((src.match(/\[styles\.card, surface\]/g) ?? []).length >= 3, 'status, photos and note are surface cards');
    assert.doesNotMatch(src, /borderWidth: 1\b/);
    assert.doesNotMatch(src, /overflow: 'hidden'/);
    assert.doesNotMatch(src, /shadowColor/);
  });

  it('adds no keyboard avoidance (it has no input, and the root Stack wraps every screen)', () => {
    assert.doesNotMatch(detailSrc(), /KeyboardAvoidingView/);
  });

  it('declares state with aria-* only', () => {
    const src = detailSrc();
    assert.doesNotMatch(src, /accessibilityState=/);
    assert.match(src, /aria-disabled=/);
  });

  it('caps the content width and uses the shared header pieces', () => {
    const src = detailSrc();
    assert.match(src, /maxWidth: CONTENT_MAX_WIDTH/);
    assert.match(src, /<BackButton\b/);
    assert.match(src, /accessibilityRole="header"/);
  });

  it('sizes every Ionicons from the ICON scale', () => {
    const icons = [...detailSrc().matchAll(/<Ionicons\b[\s\S]*?\/>/g)].map(m => m[0]);
    assert.ok(icons.length >= 3,`found only ${icons.length} icons — the regex stopped matching`);
    for (const el of icons) assert.match(el, /size=\{ICON\.\w+\}/, el);
  });

  it('draws no tick, cross, warning or tip with an emoji', () => {
    assert.doesNotMatch(detailSrc(), /[✓✕✗⚠💡✅❌]/u);
  });

  it('prints every date through the repo helpers: no Date of its own, no locale-less formatter', () => {
    const src = detailSrc();
    assert.doesNotMatch(src, /new Date\(/);
    assert.doesNotMatch(src, /toLocale\w*String/);
    assert.match(src, /import \{[^}]*\bformatHandedInAt\b[^}]*\} from '@\/services\/teacherSubmissions'/);
    assert.match(src, /formatHandedInAt\(detail\.submission\.submittedAt, lang\)/);
  });
});

describe('submissions detail screen: the route', () => {
  it('lives at /homework-submissions/[homeworkId]/[studentId], the names the list pushes to', () => {
    assert.ok(existsSync(detailFile));
    assert.ok(existsSync(path.resolve(here, '../../app/homework-submissions/[homeworkId]/index.tsx')));
    // The list's push is `/homework-submissions/<homeworkId>/<row.studentId>`; the file names are those two segments.
    assert.match(
      listSrc,
      /router\.push\(`\/homework-submissions\/\$\{encodeURIComponent\(homeworkId\)\}\/\$\{encodeURIComponent\(row\.studentId\)\}` as never\)/,
    );
  });

  it('reads both params as the names the folders give them, each as one string (a param may be an array)', () => {
    const src = detailSrc();
    assert.match(src, /useLocalSearchParams<\{ homeworkId\?: string \| string\[\]; studentId\?: string \| string\[\] \}>\(\)/);
    assert.match(src, /const homeworkId = firstParam\(params\.homeworkId\);/);
    assert.match(src, /const studentId = firstParam\(params\.studentId\);/);
  });

  it('is kept out of analytics by the prefix the list shares (the path carries a minor\'s id)', () => {
    const tracking = readFileSync(path.resolve(here, '../screenTracking.ts'), 'utf8');
    assert.match(tracking, /'\/homework-submissions'/);
    const test = readFileSync(path.resolve(here, 'screenTracking.test.ts'), 'utf8');
    assert.match(test, /'\/homework-submissions\/h1\/s1'/);
  });
});

describe('submissions detail screen: loading', () => {
  it('reads the project through the bound API client, for this homework and this student', () => {
    const src = detailSrc();
    assert.match(src, /import \{ teacherSubmissionsApi \} from '@\/services\/teacherSubmissionsApi\.default'/);
    assert.match(loadBody(), /await teacherSubmissionsApi\.detail\(homeworkId, studentId\)/);
  });

  it('guards against a stale load with loadSeq, on the success path and the failure path', () => {
    const body = loadBody();
    assert.match(detailSrc(), /const loadSeq = useRef\(0\)/);
    assert.match(body, /const seq = \+\+loadSeq\.current/);
    assert.equal((body.match(/seq !== loadSeq\.current/g) ?? []).length, 2);
  });

  it('reloads on every focus (a signed photo link lives ten minutes)', () => {
    assert.match(detailSrc(), /useFocusEffect\(/);
    assert.match(dAfter('useFocusEffect(', 160), /void load\(\)/);
  });

  it('treats a 404 or 403 as final, with the neutral «no longer available» wording, never a retry', () => {
    const body = loadBody();
    assert.match(body, /const final = status === 404 \|\| status === 403;/);
    assert.match(body, /status === 404 \? t\('errNotFound'\)/);
    // Nothing on the screen re-asks by itself: no timer, no interval, no load from inside the failure branch.
    assert.doesNotMatch(detailSrc(), /setInterval|setTimeout/);
    assert.equal((detailSrc().match(/void load\(\)/g) ?? []).length, 2, 'the focus effect and the retry button, nothing else');
  });

  it('gives a final failure a way back and no retry, and any other failure a retry', () => {
    const panel = dAfter('accessibilityRole="alert"', 1200);
    assert.match(panel, /failure\.final \? \(\s*<Button label=\{t\('back'\)\} onPress=\{leave\}/);
    assert.match(panel, /<Button label=\{t\('retry'\)\} onPress=\{retry\}/);
  });

  it('keeps the project on screen when a reload fails and says so; only a final answer drops it', () => {
    const body = loadBody();
    assert.match(body, /if \(hasDetail\.current && !final\) \{\s*say\(message\);\s*return;\s*\}/);
    assert.match(body, /hasDetail\.current = false;\s*setDetail\(null\);/);
    assert.match(body, /apiErrorMessage\(e, 'subDetailLoadFailed', t\)/);
  });

  it('has no project to read without both ids, and says so as a final answer', () => {
    assert.match(loadBody(), /if \(!homeworkId \|\| !studentId\) \{\s*setFailure\(\{ message: t\('errNotFound'\), final: true/);
  });
});

describe('submissions detail screen: what it shows', () => {
  it('titles the screen with the student from the response, and a fallback until then', () => {
    const head = dAfter('accessibilityRole="header"', 400);
    assert.match(head, /detail\?\.student\.displayName \|\| t\('subDetailTitle'\)/);
  });

  it('shows the state as an icon and a word from the shared look and label, never colour alone', () => {
    const src = detailSrc();
    assert.match(src, /const look = submissionLook\(detail\.submission\.status\);/);
    const card = dAfter('<Ionicons name={look.icon}', 400);
    assert.match(card, /t\(stateLabelKey\(detail\.submission\.status\)\)/);
  });

  it('shows when it was handed in, and the late note for a late one', () => {
    const src = detailSrc();
    assert.match(src, /t\('subHandedInAt', handedIn\)/);
    assert.match(src, /const handedIn = formatHandedInAt\(/);
    assert.match(src, /detail\.submission\.status === 'late' \? <Text style=\{muted\}>\{t\('projectLateNote'\)\}<\/Text> : null/);
  });

  it('draws the photos as the student screen does: photoSlotSize, a 72-104 square, cacheKey on the photo id', () => {
    const src = detailSrc();
    assert.match(src, /import \{[^}]*\bphotoSlotSize\b[^}]*\} from '@\/services\/homeworkProject'/);
    assert.match(src, /const slot = photoSlotSize\(Math\.min\(width, CONTENT_MAX_WIDTH\) - 4 \* SPACE\.lg - 2, SPACE\.sm\);/);
    assert.match(src, /import \{ Image \} from 'expo-image'/);
    assert.match(src, /source=\{\{ uri: photo\.url, cacheKey: photo\.id \}\}/);
    assert.match(src, /key=\{photo\.id\}/);
  });

  it('opens a photo in the viewer, by a name that says which one', () => {
    const src = detailSrc();
    assert.match(src, /import \{ ImageViewerModal \} from '@\/components\/ui\/ImageViewer'/);
    assert.match(src, /<ImageViewerModal url=\{viewerUrl\} onClose=\{\(\) => setViewerUrl\(null\)\} \/>/);
    const thumb = dAfter('onPress={() => (photo.url ? setViewerUrl(photo.url) : undefined)}', 420);
    assert.match(thumb, /disabled=\{!photo\.url\}/);
    assert.match(thumb, /aria-disabled=\{!photo\.url\}/);
    assert.match(thumb, /photo\.url \? t\('projectOpenPhoto', i \+ 1\) : t\('projectPhotoUnavailable'\)/);
  });

  it('draws a photo with no link (null url) as a placeholder, not a broken image', () => {
    assert.match(dAfter('{photo.url ? (', 520), /\) : \(\s*<Ionicons name="image-outline" size=\{ICON\.xl\}/);
  });

  it('is read-only: no way to add, remove or pick a photo, no input', () => {
    const src = detailSrc();
    for (const gone of [/trash-outline/, /pickHomeworkPhoto/, /uploadPhoto/, /removePhoto/, /<Input\b/, /TextInput/, /saveNote/, /handIn\(/]) {
      assert.doesNotMatch(src, gone);
    }
  });

  it('says how many photos, and that a note-only project has none', () => {
    const src = detailSrc();
    assert.match(src, /t\('projectPhotosCount', detail\.submission\.photos\.length\)/);
    assert.match(src, /detail\.submission\.photos\.length === 0 \? <Text style=\{muted\}>\{t\('projectNoPhotos'\)\}/);
  });

  it('shows the note, or «no note» when it is blank', () => {
    const src = detailSrc();
    assert.match(src, /detail\.submission\.note\.trim\(\) \?/);
    assert.match(src, /t\('subNoNote'\)/);
    assert.match(src, /t\('subNote'\)/);
  });
});

describe('submissions detail screen: deleting the project', () => {
  it('is a destructive full-width Button, loading while it clears, that calls clearProject', () => {
    const btn = dAfter(/<Button\s+label=\{t\('subDeleteProject'\)\}/, 400);
    assert.match(btn, /variant="destructive"/);
    assert.match(btn, /onPress=\{\(\) => void clearProject\(\)\}/);
    assert.match(btn, /loading=\{clearing\}/);
    assert.match(btn, /fullWidth/);
    // The shared Button is a 44-point target and sets aria-busy from `loading`.
    const button = readFileSync(path.resolve(here, '../../components/ui/Button.tsx'), 'utf8');
    assert.match(button, /minHeight: 44/);
    assert.match(button, /aria-busy=\{loading\}/);
  });

  it('is offered only once a project has loaded', () => {
    const src = detailSrc();
    const button = src.search(/<Button\s+label=\{t\('subDeleteProject'\)\}/);
    assert.ok(button > src.indexOf('if (!detail) return') && src.indexOf('if (!detail) return') > src.indexOf('if (failure) {'), 'behind the failure and loading returns');
  });

  it('asks first: confirm({ destructive: true }) comes before, and gates, the one call to clear', () => {
    const body = handler('clearProject');
    const askAt = at(body, 'await confirm({');
    const clearAt = at(body, 'await teacherSubmissionsApi.clear(homeworkId, studentId)');
    assert.ok(askAt < clearAt, 'confirm before clear');
    assert.ok(at(body, 'if (!ok) return;') > askAt && at(body, 'if (!ok) return;') < clearAt, 'a refusal returns before clear');
    const options = body.slice(askAt, body.indexOf('});', askAt));
    assert.match(options, /title: t\('subDeleteTitle'\)/);
    assert.match(options, /message: t\('subDeleteBody'\)/);
    assert.match(options, /confirmLabel: t\('subDeleteProject'\)/);
    assert.match(options, /cancelLabel: t\('cancel'\)/);
    assert.match(options, /destructive: true/);
    assert.equal((detailSrc().match(/teacherSubmissionsApi\.clear\(/g) ?? []).length, 1, 'clear is called from one place');
    assert.equal((detailSrc().match(/\bconfirm\(/g) ?? []).length, 1);
  });

  it('guards a second tap with a ref set before the dialog opens and cleared in finally', () => {
    const body = handler('clearProject');
    const guard = at(body, 'if (clearingRef.current || !homeworkId || !studentId) return;');
    const set = at(body, 'clearingRef.current = true;');
    assert.ok(guard < set && set < at(body, 'await confirm({'), 'guard, then claim, then ask');
    const fin = at(body, 'finally {');
    assert.match(body.slice(fin), /clearingRef\.current = false;/);
    assert.match(body.slice(fin), /setClearing\(false\);/);
    assert.match(detailSrc(), /const clearingRef = useRef\(false\);/);
    // The spinner shows only for the call, after the dialog said yes.
    assert.ok(at(body, 'setClearing(true);') > at(body, 'if (!ok) return;'));
  });

  it('on success remembers the «deleted» note and leaves for the list', () => {
    const body = handler('clearProject');
    const clearAt = at(body, 'await teacherSubmissionsApi.clear(homeworkId, studentId)');
    const done = at(body, "leaveWith('subDeleted')");
    assert.ok(done > clearAt, 'only after clear resolved');
    assert.ok(done < at(body, 'catch (e)'), 'on the success path, not in the catch');
  });

  it('reads a 404 from clear as «already gone»: neutral note, back to the list, no failure message', () => {
    const body = handler('clearProject');
    const caught = body.slice(at(body, 'catch (e)'), at(body, 'finally {'));
    const gone = at(caught, "if (statusOf(e) === 404) {");
    const goneBranch = caught.slice(gone, caught.indexOf('}', gone));
    assert.match(goneBranch, /leaveWith\('subAlreadyGone'\);/);
    assert.match(goneBranch, /return;/);
    assert.doesNotMatch(goneBranch, /subDeleteFailed/);
    assert.ok(at(caught, "say(t('subDeleteFailed'))") > gone, 'any other failure says it failed, after the 404 branch');
  });

  it('on any other failure says it failed, stays, and looks again to see whether it was cleared after all', () => {
    const body = handler('clearProject');
    const caught = body.slice(at(body, 'catch (e)'), at(body, 'finally {'));
    assert.match(caught, /say\(t\('subDeleteFailed'\)\);\s*await recheck\(\);/);
    assert.doesNotMatch(caught, /leave\(\)/, 'a failure does not leave');
    const re = handler('recheck');
    assert.match(re, /await teacherSubmissionsApi\.detail\(homeworkId, studentId\)/);
    assert.match(re, /if \(statusOf\(e\) === 404\) leaveWith\('subAlreadyGone'\);/);
    assert.equal((re.match(/seq !== loadSeq\.current/g) ?? []).length, 2);
    assert.match(re, /setDetail\(next\)/);
  });

  it('leaves by going back, or to the list when there is nothing to go back to (a refreshed web tab)', () => {
    const body = handler('leave');
    assert.match(body, /if \(router\.canGoBack\(\)\) router\.back\(\);/);
    assert.match(body, /else router\.replace\(/);
    assert.match(body, /\/homework-submissions\/\$\{encodeURIComponent\(homeworkId\)\}/);
    assert.match(detailSrc(), /<BackButton\b[^>]*onPress=\{leave\}/);
  });

  it('leaves WITH a note: remembered first, then the navigation', () => {
    const body = handler('leaveWith');
    assert.ok(at(body, 'rememberSubmissionsFlash(key);') < at(body, 'leave();'));
  });

  it('the list shows that note on its next focus, in a Toast', () => {
    assert.match(listSrc, /import \{[^}]*\btakeSubmissionsFlash\b[^}]*\} from '@\/services\/teacherSubmissions'/);
    assert.match(listSrc, /import \{ Toast \} from '@\/components\/ui\/Toast'/);
    assert.match(after('useFocusEffect(', 330), /const flash = takeSubmissionsFlash\(\);\s*if \(flash\) setToast\(t\(flash\)\);/);
    assert.match(listSrc, /<Toast visible=\{!!toast\} message=\{toast\} onHide=\{\(\) => setToast\(''\)\} \/>/);
  });

  it('says what happened in a Toast on this screen too', () => {
    assert.match(detailSrc(), /<Toast visible=\{!!toast\} message=\{toast\} onHide=\{\(\) => setToast\(''\)\} \/>/);
  });
});

describe('submissions detail screen: copy', () => {
  const KEYS = ['subDetailTitle', 'subNote', 'subNoNote', 'subDeleteProject', 'subDeleteTitle', 'subDeleteBody', 'subDeleteFailed', 'subDeleted', 'subAlreadyGone', 'subDetailLoadFailed'];

  it('has every new key in both languages, the date line as a function', () => {
    for (const lang of ['ar', 'en'] as const) {
      const tr = translations[lang] as Record<string, unknown>;
      for (const k of KEYS) assert.ok(typeof tr[k] === 'string' && (tr[k] as string).length > 0, `${lang}.${k}`);
      assert.equal(typeof tr['subHandedInAt'], 'function', `${lang}.subHandedInAt`);
    }
  });

  it('says the agreed things', () => {
    assert.equal(translations.ar.subDeleteProject, 'حذف المشروع');
    assert.equal(translations.en.subDeleteProject, 'Delete project');
    assert.equal(translations.ar.subNoNote, 'لا توجد ملاحظة');
    assert.equal(translations.en.subNoNote, 'No note');
    assert.equal(translations.ar.subDeleteFailed, 'تعذّر حذف المشروع، حاول مرة أخرى');
    assert.equal(translations.en.subDeleteFailed, "Couldn't delete the project. Try again.");
  });

  it('the warning says: photos and note deleted for good, the done tick removed, the student can start again', () => {
    assert.equal(translations.ar.subDeleteBody, 'ستُحذف صور المشروع والملاحظة نهائيًا، وتُزال علامة «تم» عن الطالب، ويستطيع الطالب أن يبدأ من جديد.');
    assert.equal(translations.en.subDeleteBody, "The photos and note are deleted for good, the student's done tick is removed, and the student can start again.");
  });

  it('the date line carries the date it is given, in both languages', () => {
    assert.ok(translations.ar.subHandedInAt('30 Oct 2026').includes('30 Oct 2026'));
    assert.ok(translations.en.subHandedInAt('30 Oct 2026').includes('30 Oct 2026'));
  });

  it('writes no tanwin on the alif («اً») in the new Arabic', () => {
    for (const k of [...KEYS, 'subHandedInAt']) {
      const v = (translations.ar as Record<string, unknown>)[k];
      assert.ok(v !== undefined, `${k} is missing, so there is nothing to check`);
      const text = typeof v === 'function' ? (v as (s: string) => string)('x') : String(v);
      assert.ok(!text.includes('اً'), `${k}: ${text}`);
    }
  });
});
