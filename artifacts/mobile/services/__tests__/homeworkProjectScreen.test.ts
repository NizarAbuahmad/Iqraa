/**
 * The student's homework project screen (`app/homework-project/[id].tsx`).
 *
 * It imports react-native, expo-router and expo-image, which `node --test` cannot load, so this reads the
 * source (the pattern photoPickers.test.ts and generatorScreens.test.ts use). What it proves is textual:
 * the screen is built from the shared pieces and the project rules, never mistakes a failed load for an
 * empty project, and handles the cases earlier reviews of this feature left to it. How it looks is checked
 * in the browser, not here.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const src = readFileSync(path.resolve(here, '../../app/homework-project/[id].tsx'), 'utf8');

/** The text after the first `marker`, `n` characters long: enough to see what a handler does next. */
function after(marker: string | RegExp, n: number): string {
  const at = typeof marker === 'string' ? src.indexOf(marker) : src.search(marker);
  assert.ok(at >= 0, `the screen no longer contains ${String(marker)} — update this test`);
  return src.slice(at, at + n);
}

describe('homework project screen: the shared design rules', () => {
  it('takes colours from useColors(), never the global palette', () => {
    assert.match(src, /useColors\(\)/);
    assert.doesNotMatch(src, /\bpalette\b/);
  });

  it('adds no keyboard avoidance of its own (the root Stack wraps every screen)', () => {
    assert.doesNotMatch(src, /KeyboardAvoidingView/);
  });

  it('declares state with aria-* only', () => {
    assert.doesNotMatch(src, /accessibilityState=/);
    assert.match(src, /aria-busy=/);
    assert.match(src, /aria-disabled=/);
  });

  it('draws cards with useSurface(), with no leftover border width and no clipping', () => {
    assert.match(src, /useSurface\(/);
    assert.doesNotMatch(src, /borderWidth: 1\b/);
    assert.doesNotMatch(src, /overflow: 'hidden'/);
  });

  it('caps the content width', () => {
    assert.match(src, /maxWidth: CONTENT_MAX_WIDTH/);
  });

  it('sizes every Ionicons from the ICON scale', () => {
    const icons = [...src.matchAll(/<Ionicons\b[\s\S]*?\/>/g)].map(m => m[0]);
    assert.ok(icons.length >= 4, `found only ${icons.length} icons — the regex stopped matching`);
    for (const el of icons) assert.match(el, /size=\{ICON\.\w+\}/, el);
  });

  it('draws no tick, cross, warning or tip with an emoji', () => {
    assert.doesNotMatch(src, /[✓✕✗⚠💡✅❌]/u);
  });

  it('prints the due day through formatDueDate and builds no Date of its own', () => {
    assert.match(src, /formatDueDate\(/);
    assert.doesNotMatch(src, /new Date\(/);
  });
});

describe('homework project screen: the project rules', () => {
  it('uses the API client, the picker and the shared rules', () => {
    assert.match(src, /import \{ homeworkSubmissionApi \} from '@\/services\/homeworkSubmissionApi\.default'/);
    assert.match(src, /import \{ pickHomeworkPhoto/);
    for (const name of ['canHandIn', 'canAddPhoto', 'noteChanged', 'NOTE_MAX', 'stateLabelKey']) {
      assert.match(src, new RegExp(`\\b${name}\\b[\\s\\S]*from '@/services/homeworkSubmission'`), name);
    }
    assert.match(src, /import \{ confirm \} from '@\/services\/confirm'/);
  });

  it('gates the add slot on canAddPhoto and the hand-in on canHandIn', () => {
    assert.match(src, /canAddPhoto\(view\)/);
    assert.match(src, /canHandIn\(view, draft\)/);
  });

  it('reloads on every focus, because a signed photo URL lives ten minutes', () => {
    assert.match(src, /useFocusEffect\(/);
  });

  it('shows a failed load as an error with a retry, never as an empty project', () => {
    assert.match(src, /projectLoadFailed/);
    assert.match(src, /projectRetry/);
    // A 404 is final: the not-found copy, and no retry that can only fail again.
    assert.match(src, /status === 404/);
    assert.match(src, /errNotFound/);
  });

  it('refuses a loaded view without a real due day', () => {
    assert.match(src, /isValidYmd\(/);
  });

  it('caps the note at NOTE_MAX and shows the count', () => {
    assert.match(src, /maxLength=\{NOTE_MAX\}/);
    assert.match(src, /projectNoteCounter/);
    assert.match(src, /multiline/);
  });

  it('saves a changed note on blur, and hands in through handIn with the saved note and the draft', () => {
    assert.match(src, /onBlur=/);
    assert.match(src, /homeworkSubmissionApi\s*\.saveNote\(/);
    assert.match(src, /homeworkSubmissionApi\.handIn\(id, /);
  });

  it('catches a throw from the photo picker', () => {
    after('pickHomeworkPhoto()', 1);
    const before = src.slice(0, src.indexOf('pickHomeworkPhoto()'));
    const lastTry = before.lastIndexOf('try {');
    assert.ok(lastTry >= 0 && !before.slice(lastTry).includes('}'), 'pickHomeworkPhoto() must sit directly inside a try block');
    assert.match(src, /projectPickFailed/);
  });

  it('handles every pick result: denied, unsupported, cancelled', () => {
    assert.match(src, /'denied'[\s\S]{0,120}projectPermissionDenied/);
    assert.match(src, /'unsupported'[\s\S]{0,120}errBadImage/);
    assert.match(src, /'cancelled'/);
  });

  it('reloads after a failed upload that may have reached the server, so a retry does not duplicate a photo', () => {
    const upload = after('homeworkSubmissionApi.uploadPhoto(', 900);
    assert.match(upload, /catch \(e\)[\s\S]*mayHaveStored\(e\)[\s\S]*await load\(/);
  });

  it('asks before removing a photo, as a destructive action', () => {
    assert.match(after('confirm({', 400), /destructive: true/);
    assert.match(src, /homeworkSubmissionApi\.removePhoto\(/);
  });

  it('opens a thumbnail in the shared viewer and draws a placeholder for a missing url', () => {
    assert.match(src, /ImageViewerModal/);
    assert.match(src, /from 'expo-image'/);
    assert.match(src, /photo\.url \?/);
  });

  it('celebrates only the crossing into handed in made here, and not a late one', () => {
    assert.match(src, /justCompleted\(/);
    assert.match(src, /next\.status === 'submitted'/);
    assert.match(src, /<Celebrate\b/);
  });

  it('labels the button «hand in again» once handed in, and shows the late note', () => {
    assert.match(src, /projectReplace/);
    assert.match(src, /projectLateNote/);
    assert.match(src, /stateLabelKey\(/);
  });

  it('keeps a locked project read-only and says why', () => {
    assert.match(src, /projectLocked/);
    assert.match(src, /editable=\{!view\.locked\}/);
  });
});
