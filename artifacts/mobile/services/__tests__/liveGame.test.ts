/**
 * The pure half of the live game: the deck → question mapping, codes, the
 * server-anchored countdown, the auto-reveal rule, option looks, and the
 * polling loop's three promises (no overlap, pause while hidden, stop on a
 * fatal error).
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { ClassroomActivity, ActivitySlide } from '../ai/AIService.ts';
import {
  LIVE_OPTION_FILLS,
  LIVE_OPTION_SHAPES,
  barFractions,
  canPlayLive,
  clockOffsetMs,
  deckLang,
  isFatalPollError,
  joinErrorKey,
  joinUrl,
  leaderboard,
  liveOptionLook,
  liveOptionMinContrast,
  liveQuestionsFromDeck,
  liveTokenKey,
  normalizeCode,
  normalizeName,
  rateLimitDelayMs,
  LIVE_BACKOFF_CAP_MS,
  ranksFor,
  remainingSeconds,
  shouldAutoReveal,
  toMs,
} from '../liveGame.ts';
import { createPoller } from '../livePoller.ts';

const q = (over: Partial<ActivitySlide> = {}): ActivitySlide => ({
  slideNumber: 1,
  type: 'question',
  title: 't',
  content: 'ما ناتج ٢ + ٢؟',
  options: ['٣', '٤', '٥', '٦'],
  correctIndex: 1,
  durationSeconds: 0,
  ...over,
});

const deck = (slides: ActivitySlide[]): ClassroomActivity => ({
  activityName: 'درس',
  activityType: 'lesson',
  grade: '',
  subject: '',
  lesson: 'درس',
  duration: 10,
  difficulty: 'standard',
  groupType: 'whole-class',
  learningObjective: '',
  materials: [],
  teacherPreparation: '',
  slides,
  teacherNotes: [],
  answerKey: [],
  printables: [],
  assessment: '',
  extensionChallenge: '',
});

describe('liveQuestionsFromDeck', () => {
  it('takes only scoreable question slides, with their key', () => {
    const d = deck([
      q({ type: 'intro', options: undefined, correctIndex: undefined }),
      q(),
      q({ content: 'second', correctIndex: 0 }),
      q({ type: 'challenge' }),
      q({ options: ['only one'], correctIndex: 0 }),
      q({ correctIndex: 9 }),
    ]);
    const out = liveQuestionsFromDeck(d);
    assert.equal(out.length, 2);
    assert.deepEqual(out[1], { content: 'second', options: ['٣', '٤', '٥', '٦'], correctIndex: 0 });
  });

  it('drops a baked-in option marker, since the tile draws its own letter', () => {
    const [one] = liveQuestionsFromDeck(deck([q({ options: ['أ. ثلاثة', 'ب. أربعة'], correctIndex: 1 })]));
    assert.deepEqual(one!.options, ['ثلاثة', 'أربعة']);
  });

  it('leaves out a question the server could not take', () => {
    const seven = Array.from({ length: 7 }, (_, i) => `خيار ${i}`);
    assert.equal(liveQuestionsFromDeck(deck([q({ options: seven })])).length, 0);
    assert.equal(liveQuestionsFromDeck(deck([q({ content: '   ' })])).length, 0);
  });

  it('caps a long deck at 30 and needs three to play', () => {
    const many = Array.from({ length: 40 }, () => q());
    assert.equal(liveQuestionsFromDeck(deck(many)).length, 30);
    assert.equal(canPlayLive(deck([q(), q()])), false);
    assert.equal(canPlayLive(deck([q(), q(), q()])), true);
    assert.equal(canPlayLive(null), false);
  });

  it('reads the deck language off its questions', () => {
    assert.equal(deckLang(liveQuestionsFromDeck(deck([q()]))), 'ar');
    assert.equal(deckLang([{ content: 'What is 2 + 2?', options: ['3', '4'], correctIndex: 1 }]), 'en');
  });
});

describe('codes and names', () => {
  it('normalises what a student types', () => {
    assert.equal(normalizeCode(' ab-c 123 '), 'ABC123');
    assert.equal(normalizeCode('abc123456'), 'ABC123');
    assert.equal(normalizeCode('٣ab٤cd'), '3AB4CD');
    assert.equal(normalizeCode(null), '');
  });

  it('reads the code out of a pasted join link', () => {
    assert.equal(normalizeCode('https://app.iqrra.com/live?code=xk3m9p'), 'XK3M9P');
    assert.equal(joinUrl('XK3M9P'), 'https://app.iqrra.com/live?code=XK3M9P');
  });

  it('trims and collapses a name, and caps it', () => {
    assert.equal(normalizeName('  أحمد   علي '), 'أحمد علي');
    assert.equal(normalizeName('x'.repeat(50)).length, 20);
    assert.equal(normalizeName('   '), '');
  });

  it('keys the stored token by the normalised code', () => {
    assert.equal(liveTokenKey('xk3m9p'), 'live.token.XK3M9P');
  });
});

describe('server-anchored countdown', () => {
  const t = { seconds: 20, questionStartedAt: 1_000_000 };

  it('counts down from the server start, not the device clock', () => {
    // Device is 60 s fast: serverNow − Date.now() = −60 000.
    const offset = clockOffsetMs(1_005_000, 1_065_000);
    assert.equal(offset, -60_000);
    assert.equal(remainingSeconds(t, offset, 1_065_000), 15);
    assert.equal(remainingSeconds(t, offset, 1_065_000 + 14_500), 1);
  });

  it('never goes below zero or above the question length', () => {
    assert.equal(remainingSeconds(t, 0, 1_100_000), 0);
    assert.equal(remainingSeconds(t, 0, 900_000), 20);
  });

  it('shows the full time before the server has started the clock', () => {
    assert.equal(remainingSeconds({ seconds: 20, questionStartedAt: null }, 0, 123), 20);
  });

  it('reads an ISO time as well as epoch ms', () => {
    assert.equal(toMs('2026-10-22T10:00:00.000Z'), Date.parse('2026-10-22T10:00:00.000Z'));
    assert.equal(toMs('nonsense'), null);
    assert.equal(toMs(undefined), null);
    assert.equal(clockOffsetMs(undefined, 5), 0);
  });
});

describe('shouldAutoReveal', () => {
  const players = (n: number) => Array.from({ length: n }, (_, i) => ({
    id: `p${i}`, name: `n${i}`, score: 0, answeredCurrent: false, signedIn: false,
  }));

  it('reveals when time is up', () => {
    assert.equal(shouldAutoReveal({ state: 'question', answeredCount: 0, players: players(3) }, 0), true);
  });
  it('reveals when everyone has answered', () => {
    assert.equal(shouldAutoReveal({ state: 'question', answeredCount: 3, players: players(3) }, 12), true);
  });
  it('waits while someone is still thinking', () => {
    assert.equal(shouldAutoReveal({ state: 'question', answeredCount: 2, players: players(3) }, 12), false);
  });
  it('never treats an empty room as everyone answered', () => {
    assert.equal(shouldAutoReveal({ state: 'question', answeredCount: 0, players: [] }, 12), false);
  });
  it('only acts on a question', () => {
    for (const state of ['lobby', 'reveal', 'ended'] as const) {
      assert.equal(shouldAutoReveal({ state, answeredCount: 3, players: players(3) }, 0), false);
    }
  });
});

describe('option looks', () => {
  it('gives six distinct fills, shapes and letters', () => {
    const looks = [0, 1, 2, 3, 4, 5].map(i => liveOptionLook(i, 'ar'));
    for (const key of ['fill', 'shape', 'letter'] as const) {
      assert.equal(new Set(looks.map(l => l[key])).size, 6, key);
    }
    assert.equal(LIVE_OPTION_FILLS.length, 6);
    assert.equal(LIVE_OPTION_SHAPES.length, 6);
  });

  it('letters follow the language', () => {
    assert.deepEqual([0, 1, 2, 3].map(i => liveOptionLook(i, 'ar').letter), ['أ', 'ب', 'ج', 'د']);
    assert.deepEqual([0, 1, 2, 3].map(i => liveOptionLook(i, 'en').letter), ['A', 'B', 'C', 'D']);
  });

  it('every label reads at AA on its fill', () => {
    assert.ok(liveOptionMinContrast() >= 4.5, `lowest ${liveOptionMinContrast().toFixed(2)}:1`);
  });
});

describe('leaderboard helpers', () => {
  it('orders by score and keeps join order for ties', () => {
    const rows = [{ n: 'a', score: 5 }, { n: 'b', score: 9 }, { n: 'c', score: 5 }];
    assert.deepEqual(leaderboard(rows).map(r => r.n), ['b', 'a', 'c']);
    assert.equal(leaderboard(rows, 2).length, 2);
  });
  it('shares a rank between ties and skips the next', () => {
    assert.deepEqual(ranksFor([900, 900, 700, 700, 100]), [1, 1, 3, 3, 5]);
  });
  it('scales bars to the busiest option, and survives an all-zero question', () => {
    assert.deepEqual(barFractions([2, 4, 0, 1]), [0.5, 1, 0, 0.25]);
    assert.deepEqual(barFractions([0, 0]), [0, 0]);
  });
});

describe('errors', () => {
  it('names the join failure the student can act on', () => {
    assert.equal(joinErrorKey(409, 'name_taken'), 'liveErrNameTaken');
    assert.equal(joinErrorKey(404, 'game_not_found'), 'liveErrNotFound');
    assert.equal(joinErrorKey(429, 'rate_limited'), 'liveErrRate');
    assert.equal(joinErrorKey(409, 'game_full'), 'liveErrFull');
    assert.equal(joinErrorKey(0), 'liveErrNetwork');
    assert.equal(joinErrorKey(500), 'liveErrGeneric');
    assert.equal(joinErrorKey(404), 'liveErrNotFound');
  });
  it('treats 401, 403 and 404 as the end of polling, not a blip', () => {
    for (const status of [401, 403, 404]) assert.equal(isFatalPollError({ status }), true);
    for (const status of [0, 429, 500, 502]) assert.equal(isFatalPollError({ status }), false);
    assert.equal(isFatalPollError(new TypeError('network')), false);
    assert.equal(isFatalPollError(null), false);
  });
});

describe('rateLimitDelayMs', () => {
  it('honours Retry-After, capped', () => {
    assert.equal(rateLimitDelayMs({ status: 429, retryAfterSec: 12 }, 1), 12_000);
    assert.equal(rateLimitDelayMs({ status: 429, retryAfterSec: 600 }, 1), LIVE_BACKOFF_CAP_MS);
  });
  it('falls back to 5 s, doubling while it keeps happening, up to the cap', () => {
    assert.deepEqual([1, 2, 3, 4, 5, 6].map(n => rateLimitDelayMs({ status: 429 }, n)), [5000, 10000, 20000, 30000, 30000, 30000]);
    assert.equal(rateLimitDelayMs({ status: 429, retryAfterSec: 0 }, 1), 5000);
  });
  it('leaves every other failure on the normal interval', () => {
    for (const status of [0, 401, 500, 502]) assert.equal(rateLimitDelayMs({ status }, 1), null);
    assert.equal(rateLimitDelayMs(null, 1), null);
  });
});

const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

describe('createPoller', () => {
  it('never has two requests in flight', async () => {
    let active = 0;
    let maxActive = 0;
    let calls = 0;
    const p = createPoller({
      intervalMs: 2,
      fetch: async () => {
        active++; calls++;
        maxActive = Math.max(maxActive, active);
        await sleep(15);
        active--;
        return calls;
      },
      onData: () => {},
    });
    p.start();
    p.pollNow();
    p.pollNow();
    // Wait for enough calls rather than a fixed time: a loaded machine is slow, not wrong.
    for (let waited = 0; calls < 3 && waited < 3000; waited += 10) await sleep(10);
    p.stop();
    assert.ok(calls >= 3, `only ${calls} calls`);
    assert.equal(maxActive, 1);
  });

  it('delivers data and keeps going through a transient failure', async () => {
    const seen: number[] = [];
    const errors: boolean[] = [];
    let n = 0;
    const p = createPoller({
      intervalMs: 2,
      fetch: async () => {
        n++;
        if (n === 2) throw Object.assign(new Error('blip'), { status: 502 });
        return n;
      },
      onData: d => seen.push(d),
      onError: (_e, fatal) => errors.push(fatal),
      isFatal: isFatalPollError,
    });
    p.start();
    await sleep(60);
    p.stop();
    assert.deepEqual(errors, [false]);
    assert.ok(seen.includes(1) && seen.includes(3));
  });

  it('stops on a fatal error and does not poll again', async () => {
    let n = 0;
    const errors: boolean[] = [];
    const p = createPoller({
      intervalMs: 2,
      fetch: async () => { n++; throw Object.assign(new Error('gone'), { status: 404 }); },
      onData: () => {},
      onError: (_e, fatal) => errors.push(fatal),
      isFatal: isFatalPollError,
    });
    p.start();
    await sleep(60);
    assert.equal(n, 1);
    assert.deepEqual(errors, [true]);
    p.pollNow();
    await sleep(20);
    assert.equal(n, 1);
  });

  it('pauses while hidden and polls at once when shown again', async () => {
    let n = 0;
    const p = createPoller({ intervalMs: 5, fetch: async () => ++n, onData: () => {} });
    p.setPaused(true);
    p.start();
    await sleep(40);
    assert.equal(n, 0, 'polled while paused');
    p.setPaused(false);
    for (let waited = 0; n < 1 && waited < 1000; waited += 5) await sleep(5);
    assert.ok(n >= 1, 'did not poll on resume');
    p.setPaused(true);
    await sleep(15);
    const frozen = n;
    await sleep(40);
    assert.equal(n, frozen, 'kept polling while paused');
    p.stop();
  });

  it('backs off after a 429 instead of polling every interval, then resumes', async () => {
    let n = 0;
    const delays: Array<[number, number | null]> = [];
    const p = createPoller({
      intervalMs: 2,
      fetch: async () => {
        n++;
        if (n <= 2) throw Object.assign(new Error('slow down'), { status: 429, retryAfterSec: 0.05 });
        return n;
      },
      onData: () => {},
      retryDelay: (e, failures) => { const d = rateLimitDelayMs(e, failures); delays.push([failures, d]); return d === null ? null : 40; },
    });
    p.start();
    await sleep(25);
    // One try, then waiting out the back-off rather than hitting every 2 ms.
    assert.equal(n, 1);
    for (let waited = 0; n < 4 && waited < 3000; waited += 10) await sleep(10);
    p.stop();
    // Two backed-off failures, then a success resets the count and polling is quick again.
    assert.deepEqual(delays.map(d => d[0]), [1, 2]);
    assert.ok(n >= 4, `only ${n} calls after resuming`);
  });

  it('a success clears the failure count', async () => {
    const counts: number[] = [];
    let n = 0;
    const p = createPoller({
      intervalMs: 2,
      fetch: async () => { n++; if (n === 1 || n === 3) throw Object.assign(new Error('x'), { status: 502 }); return n; },
      onData: () => {},
      retryDelay: (_e, failures) => { counts.push(failures); return null; },
    });
    p.start();
    await sleep(60);
    p.stop();
    assert.deepEqual(counts, [1, 1]);
  });

  it('drops a response that lands after stop', async () => {
    const seen: number[] = [];
    const p = createPoller({
      intervalMs: 50,
      fetch: async () => { await sleep(20); return 1; },
      onData: d => seen.push(d),
    });
    p.start();
    p.stop();
    await sleep(50);
    assert.deepEqual(seen, []);
  });
});
