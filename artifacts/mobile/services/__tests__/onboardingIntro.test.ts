// The first-run intro is shown before login, on a fresh install, to someone who
// almost certainly has no account yet. Two things went wrong there (found
// 2026-11-27):
//   - it ended on the sign-in screen, so a new teacher's first screen after the
//     intro asked for a password they never made;
//   - its second slide advertised the «اسأل إقرأ» chat, which has been hidden
//     since 2026-11-23 (`IQRA_CHAT_ENABLED`), so the intro promised a feature
//     nobody could find. The tour, Today, the FAQ and the command palette all
//     respect the flag; the intro did not.
// The screen imports react-native, so it is read as text, like the other
// screen invariants in this folder.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const src = readFileSync(join(import.meta.dirname, '..', '..', 'app', 'onboarding.tsx'), 'utf8');

test('the intro ends on sign-up, not sign-in', () => {
  const finish = src.slice(src.indexOf('const finish = async'), src.indexOf('const handleNext'));
  assert.ok(finish.length > 0, 'finish() not found');
  assert.match(finish, /router\.replace\('\/\(auth\)\/register'\)/);
  assert.doesNotMatch(finish, /\/\(auth\)\/login/);
});

test('the chat slide is shown only while the chat is enabled', () => {
  assert.match(src, /import \{ IQRA_CHAT_ENABLED \} from '@\/services\/features'/);
  const chatSlide = src.split('\n').find(l => l.includes("titleKey: 'onboardingSlide6Title'"));
  assert.ok(chatSlide, 'the chat slide (onboardingSlide6) is gone; drop this test with it');
  assert.match(chatSlide!, /chat: true/, 'the chat slide must be marked chat: true');
  assert.match(src, /\.filter\(s => !s\.chat \|\| IQRA_CHAT_ENABLED\)/);
});
