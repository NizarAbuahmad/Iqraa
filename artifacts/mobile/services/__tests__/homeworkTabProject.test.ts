/**
 * The teacher's homework tab (`components/classes/HomeworkTab.tsx`): the project switch, the handed-in
 * button on the card and the delete wording.
 *
 * The component imports react-native, which `node --test` cannot load, so this reads the source (the
 * pattern homeworkProjectScreen.test.ts uses). What it proves is textual; how it looks is checked in the browser.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import translations from '../i18n.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
const src = readFileSync(path.resolve(here, '../../components/classes/HomeworkTab.tsx'), 'utf8');

/** The text after the first `marker`, `n` characters long. */
function after(marker: string | RegExp, n: number): string {
  const at = typeof marker === 'string' ? src.indexOf(marker) : src.search(marker);
  assert.ok(at >= 0, `HomeworkTab no longer contains ${String(marker)} — update this test`);
  return src.slice(at, at + n);
}

describe('HomeworkTab: the project switch', () => {
  it('keeps requiresSubmission in the Draft, seeded from the edited item and false for a new one', () => {
    assert.match(after('type Draft = {', 420), /requiresSubmission: boolean/);
    assert.match(after('const EMPTY_DRAFT', 200), /requiresSubmission: false/);
    assert.match(after('const openEdit', 500), /requiresSubmission: item\.requiresSubmission/);
  });

  it('sends it on create, and on edit only through requiresSubmissionPatch', () => {
    assert.match(after('await createHomework({', 500), /requiresSubmission: draft\.requiresSubmission/);
    assert.match(after('await updateHomework(', 500), /\.\.\.requiresSubmissionPatch\(editing\.requiresSubmission, draft\.requiresSubmission\)/);
  });

  it('draws a switch with aria-checked and aria-disabled bound to the lock', () => {
    assert.match(src, /<Switch\b/);
    const sw = after('<Switch', 700);
    assert.match(sw, /aria-checked=\{draft\.requiresSubmission\}/);
    assert.match(sw, /aria-disabled=\{locked\}/);
    assert.match(sw, /disabled=\{locked\}/);
    assert.match(src, /const locked = .*requiresSubmissionLocked/);
  });

  it('says why a locked switch is disabled, in words, not only a greyed look', () => {
    assert.match(src, /locked \? t\('hwRequiresProjectLocked'\) : t\('hwRequiresProjectHint'\)/);
  });

  it('is a 44-point row and never uses accessibilityState', () => {
    assert.match(after('switchRow:', 120), /minHeight: TOUCH/);
    assert.doesNotMatch(src, /accessibilityState=/);
  });

  it('shows the server refusal through apiErrorMessage (submission_locked has its own key)', () => {
    assert.match(src, /apiErrorMessage\(e, 'hwSaveFailed', t\)/);
  });

  it('recovers from a 409 submission_locked: reverts the switch, locks the item and reloads the list', () => {
    const at = src.indexOf('if (isSwitchLockedError(e))');
    assert.ok(at >= 0, 'onSave must branch on isSwitchLockedError(e)');
    const block = src.slice(at, at + 500);
    assert.match(block, /requiresSubmission: editing\?\.requiresSubmission \?\? d\.requiresSubmission/);
    assert.match(block, /setEditing\(prev => prev && \{ \.\.\.prev, requiresSubmissionLocked: true \}\)/);
    assert.match(block, /void load\(\)/);
    // …and still shows the error text.
    assert.match(src.slice(at, at + 800), /setModalError\(apiErrorMessage\(e, 'hwSaveFailed', t\)\)/);
  });

  it('announces the locked reason on the control itself', () => {
    assert.match(after('<Switch', 900), /accessibilityHint=\{locked \? t\('hwRequiresProjectLocked'\) : t\('hwRequiresProjectHint'\)\}/);
  });
});

describe('HomeworkTab: the handed-in button on the card', () => {
  it('only exists for a project homework and opens the list screen', () => {
    const at = src.indexOf('{project ? (');
    assert.ok(at >= 0, 'the card button must be guarded by `project` (null unless item.requiresSubmission)');
    const block = src.slice(at, at + 1400);
    assert.match(block, /<PressableScale/);
    assert.match(block, /router\.push\(`\/homework-submissions\/\$\{encodeURIComponent\(item\.id\)\}` as never\)/);
    // The accessible name carries the visible count as well as the title (voice control says what it sees).
    assert.match(block, /aria-label=\{t\('hwSubmissionsOpenA11y', item\.title, project\.submitted, project\.of\)\}/);
    assert.match(block, /t\('hwSubmittedCount', project\.submitted, project\.of\)/);
    assert.doesNotMatch(block, /projectSubmittedText\(/);
  });

  it('computes projectSubmittedText once per card', () => {
    assert.equal((src.match(/projectSubmittedText\(item\)/g) ?? []).length, 1);
  });

  it('shows one count for a project homework: no done-count line, and the bar follows the hand-ins', () => {
    const at = src.indexOf('const project = ');
    assert.ok(at >= 0, 'the card must compute `project` from projectSubmittedText');
    assert.match(src.slice(at, at + 200), /item\.requiresSubmission \? projectSubmittedText\(item\) : null/);
    assert.match(after('const doneShown', 160), /project \? project\.submitted : clampedDone\(item\.doneCount, item\.trackableCount\)/);
    // The «أنجزه X من Y» line is rendered only when this is not a project homework.
    const doneAt = src.indexOf("t('hwDoneCount'");
    assert.ok(doneAt >= 0, 'the done-count line is gone for everyone — it must stay for a plain homework');
    assert.match(src.slice(doneAt - 400, doneAt), /project \? null/);
    // The «بلا حساب» line still applies.
    assert.match(src, /t\('hwNoAccountCount', noAccount\)/);
  });

  it('is at least 44 points tall', () => {
    assert.match(after('submissionsBtn:', 200), /minHeight: TOUCH/);
  });
});

describe('HomeworkTab: the list is fresh when the class page is shown again', () => {
  it('reloads on focus through useFocusEffect, because the handed-in count changes on the screens it opens', () => {
    assert.match(src, /import \{ router, useFocusEffect \} from 'expo-router'/);
    assert.match(after('useFocusEffect(', 400), /void load\(\)/);
  });

  it('skips the first focus, which the mount effect already loads (no double load)', () => {
    const block = after('useFocusEffect(', 400);
    assert.match(block, /firstFocus\.current/);
    assert.match(src, /const firstFocus = useRef\(true\)/);
  });

  it('still drops a stale response: the same loadSeq guards every load', () => {
    assert.match(after('const load = useCallback', 400), /const seq = \+\+loadSeq\.current/);
    assert.equal((src.match(/seq !== loadSeq\.current/g) ?? []).length, 2);
  });
});

describe('HomeworkTab: deleting', () => {
  it('words the confirmation by deleteConfirmKey, so a project homework warns about the photos', () => {
    assert.match(after('const onDelete', 500), /message: t\(deleteConfirmKey\(target\)\)/);
    assert.doesNotMatch(src, /t\('hwDeleteConfirm'\)/);
  });
});

describe('HomeworkTab: shared design rules', () => {
  it('adds no EmptyState of its own (it already has the one the ratchet counts)', () => {
    assert.equal((src.match(/<EmptyState/g) ?? []).length, 1);
  });
});

describe('HomeworkTab: copy', () => {
  it('has every new key in both languages, the function ones as functions', () => {
    for (const lang of ['ar', 'en'] as const) {
      const tr = translations[lang] as Record<string, unknown>;
      for (const k of ['hwRequiresProject', 'hwRequiresProjectHint', 'hwRequiresProjectLocked', 'hwDeleteConfirmProject']) {
        assert.equal(typeof tr[k], 'string', `${lang}.${k}`);
      }
      assert.equal(typeof tr['hwSubmittedCount'], 'function', `${lang}.hwSubmittedCount`);
      assert.equal(typeof tr['hwSubmissionsOpenA11y'], 'function', `${lang}.hwSubmissionsOpenA11y`);
    }
  });

  it('the Arabic helper line addresses the teacher, like the English one', () => {
    assert.doesNotMatch(translations.ar.hwRequiresProjectHint, /ويراها المعلّم/);
    assert.match(translations.ar.hwRequiresProjectHint, /وتطّلع عليها/);
  });

  it('the card button name carries the title and the visible count in both languages', () => {
    const ar = translations.ar.hwSubmissionsOpenA11y('مشروع', 7, 20);
    const en = translations.en.hwSubmissionsOpenA11y('Project', 7, 20);
    assert.ok(ar.includes('مشروع') && ar.includes(translations.ar.hwSubmittedCount(7, 20)), ar);
    assert.ok(en.includes('Project') && en.includes(translations.en.hwSubmittedCount(7, 20)), en);
  });

  it('the locked line says students have STARTED, not that work is visible', () => {
    assert.equal(translations.ar.hwRequiresProjectLocked, 'لا يمكن تغييره بعد أن بدأ الطلبة');
    assert.equal(translations.en.hwRequiresProjectLocked, "Can't be changed once students have started.");
  });
});
