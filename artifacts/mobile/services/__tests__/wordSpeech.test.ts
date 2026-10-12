import test from 'node:test';
import assert from 'node:assert/strict';

import { playRecordingOrSpeak, speakWordAloud } from '../wordSpeech.ts';

/** An <audio> stand-in whose play() outcome the test chooses. */
function fakeAudio(play: () => Promise<void> | void) {
  const el = {
    paused: false,
    onerror: null as null | (() => void),
    play,
    pause() {
      el.paused = true;
    },
  };
  return el;
}

test('plays the recording and never speaks when it loads', async () => {
  const spoken: string[] = [];
  const el = fakeAudio(() => Promise.resolve());
  playRecordingOrSpeak('u', 'uniform', { createAudio: () => el, speak: w => spoken.push(w) > 0, cancelSpeech: () => {} });
  await Promise.resolve();
  assert.deepEqual(spoken, []);
});

test('speaks the word when play() rejects — a 404 recording', async () => {
  const spoken: string[] = [];
  const el = fakeAudio(() => Promise.reject(new Error('NotSupportedError')));
  playRecordingOrSpeak('u', 'casually', { createAudio: () => el, speak: w => spoken.push(w) > 0, cancelSpeech: () => {} });
  await new Promise(r => setTimeout(r, 0));
  assert.deepEqual(spoken, ['casually']);
});

test('speaks the word when the element reports an error', () => {
  const spoken: string[] = [];
  const el = fakeAudio(() => new Promise(() => {}));
  playRecordingOrSpeak('u', 'results', { createAudio: () => el, speak: w => spoken.push(w) > 0, cancelSpeech: () => {} });
  el.onerror?.();
  assert.deepEqual(spoken, ['results']);
});

test('speaks once when both the error event and the rejection fire', async () => {
  const spoken: string[] = [];
  const el = fakeAudio(() => Promise.reject(new Error('x')));
  playRecordingOrSpeak('u', 'celebration', { createAudio: () => el, speak: w => spoken.push(w) > 0, cancelSpeech: () => {} });
  el.onerror?.();
  await new Promise(r => setTimeout(r, 0));
  assert.deepEqual(spoken, ['celebration']);
});

test('stopping (a newer word was tapped) is not a failure: no speech, audio paused, speech cancelled', async () => {
  const spoken: string[] = [];
  let cancelled = 0;
  // pause() makes the browser reject the pending play() with AbortError.
  let rejectPlay: (e: Error) => void = () => {};
  const el = fakeAudio(() => new Promise<void>((_, rej) => (rejectPlay = rej)));
  const stop = playRecordingOrSpeak('u', 'uniform', {
    createAudio: () => el,
    speak: w => spoken.push(w) > 0,
    cancelSpeech: () => cancelled++,
  });
  stop();
  rejectPlay(new Error('AbortError'));
  await new Promise(r => setTimeout(r, 0));
  assert.equal(el.paused, true);
  assert.equal(cancelled, 1);
  assert.deepEqual(spoken, []);
});

test('a throwing play() also falls back', () => {
  const spoken: string[] = [];
  const el = fakeAudio(() => {
    throw new Error('boom');
  });
  playRecordingOrSpeak('u', 'uniform', { createAudio: () => el, speak: w => spoken.push(w) > 0, cancelSpeech: () => {} });
  assert.deepEqual(spoken, ['uniform']);
});

// ─── speakWordAloud ─────────────────────────────────────────────────────────

class FakeUtterance {
  lang = '';
  voice: unknown = null;
  rate = 1;
  text: string;
  constructor(text: string) {
    this.text = text;
  }
}

test('speakWordAloud: no speech engine → false, nothing thrown', () => {
  assert.equal(speakWordAloud('uniform', undefined, undefined), false);
});

test('speakWordAloud: cancels what was speaking, asks for British English, prefers a en-GB voice', () => {
  const calls: string[] = [];
  const us = { lang: 'en-US', name: 'US' };
  const gb = { lang: 'en-GB', name: 'GB' };
  const synth = {
    cancel: () => calls.push('cancel'),
    speak: (u: FakeUtterance) => calls.push(`speak:${u.text}:${u.lang}:${(u.voice as { name: string }).name}`),
    getVoices: () => [us, gb],
  };
  assert.equal(speakWordAloud('uniform', synth, FakeUtterance as never), true);
  assert.deepEqual(calls, ['cancel', 'speak:uniform:en-GB:GB']);
});

test('speakWordAloud: falls back to any English voice, then to none', () => {
  const us = { lang: 'en-US', name: 'US' };
  const spoken: FakeUtterance[] = [];
  const mk = (voices: { lang: string; name: string }[]) => ({
    cancel: () => {},
    speak: (u: FakeUtterance) => spoken.push(u),
    getVoices: () => voices,
  });
  speakWordAloud('a', mk([{ lang: 'ar-JO', name: 'AR' }, us]), FakeUtterance as never);
  assert.equal((spoken[0].voice as { name: string }).name, 'US');
  speakWordAloud('b', mk([{ lang: 'ar-JO', name: 'AR' }]), FakeUtterance as never);
  assert.equal(spoken[1].voice, null);
  assert.equal(spoken[1].lang, 'en-GB');
});

test('speakWordAloud: a throwing engine is swallowed and reported as false', () => {
  const synth = {
    cancel: () => {},
    speak: () => {
      throw new Error('x');
    },
    getVoices: () => [],
  };
  assert.equal(speakWordAloud('uniform', synth, FakeUtterance as never), false);
});
