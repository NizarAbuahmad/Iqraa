import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import type { AudioItem } from '../englishAudioPlan.ts';
import {
  ASSUMED_KBPS,
  PRICE_PER_MINUTE_USD,
  StopRun,
  cacheHit,
  checkClips,
  compareSpoken,
  estimateCostUsd,
  normalizeSpoken,
  onlyLine,
  parseSpeechCache,
  renderReportMarkdown,
  secondsFromBytes,
  serializeSpeechCache,
  summarizeResults,
} from '../englishAudioCheck.ts';
import type { CacheEntry, CheckDeps, CheckResult, SpeechCache } from '../englishAudioCheck.ts';

const same = (a: string, b: string) => assert.equal(normalizeSpoken(a), normalizeSpoken(b), `${a} vs ${b}`);

describe('normalizeSpoken', () => {
  it('lowercases and drops punctuation but keeps the apostrophe', () => {
    assert.equal(normalizeSpoken("Mum's got a CAT."), "mum's got a cat");
  });
  it('straightens curly apostrophes', () => {
    same('Mum’s', "Mum's");
    same('I’ve', "I've");
    assert.equal(normalizeSpoken('Mum’s'), "mum's");
  });
  it('turns hyphens and space runs into one space', () => {
    same('well-dressed', 'well dressed');
    same('  well   dressed  ', 'well dressed');
    assert.equal(normalizeSpoken('well-dressed'), 'well dressed');
  });
  it('drops quotes around a word but not the apostrophe inside it', () => {
    assert.equal(normalizeSpoken("'hello'"), 'hello');
    assert.equal(normalizeSpoken("o'clock"), "o'clock");
  });
  it('writes digits 0-20 and the tens as words', () => {
    assert.equal(normalizeSpoken("I've got 5 pens."), "i've got five pens");
    assert.equal(normalizeSpoken('0'), 'zero');
    assert.equal(normalizeSpoken('20'), 'twenty');
    assert.equal(normalizeSpoken('90'), 'ninety');
    assert.equal(normalizeSpoken('100'), 'one hundred');
    same('I have 5 pens', 'I have five pens');
  });
  it('leaves other digit runs alone', () => {
    assert.equal(normalizeSpoken('21 pens'), '21 pens');
    assert.equal(normalizeSpoken('1999'), '1999');
    assert.equal(normalizeSpoken('4th'), '4th');
  });
  it('maps British spellings to American', () => {
    same('colour', 'color');
    same('colours', 'colors');
    same('colourful', 'colorful');
    same('favourite', 'favorite');
    same('neighbour', 'neighbor');
    same('organise', 'organize');
    same('organised', 'organized');
    same('organisation', 'organization');
    same('grey', 'gray');
    same('programme', 'program');
    same('centre', 'center');
    same('theatre', 'theater');
    same('metre', 'meter');
    same('kilometres', 'kilometers');
    same('litre', 'liter');
    same('travelling', 'traveling');
    same('cancelled', 'canceled');
    same('jewellery', 'jewelry');
  });
  it('folds practise to practice before the -ise rule can make it «practize»', () => {
    same('practise', 'practice');
    same('practised', 'practiced');
    same('practising', 'practicing');
    same('practises', 'practices');
    assert.equal(normalizeSpoken('practise'), 'practice');
    assert.equal(normalizeSpoken('practising'), 'practicing');
  });
  it('leaves a short word that merely ends in -ise alone', () => {
    // The suffix rule is for words of 5 letters or more: "rise" must not become "rize"
    // on one side only. Both sides go through the same function, so what matters is
    // that the short word is untouched.
    assert.equal(normalizeSpoken('rise'), 'rise');
    assert.equal(normalizeSpoken('wise'), 'wise');
  });
  it('maps homophones to one form (equality, not the form itself)', () => {
    same('write', 'right');
    same('their', 'there');
    same("they're", 'there');
    same('to', 'two');
    same('too', 'two');
    same('no', 'know');
    same('see', 'sea');
    same('buy', 'bye');
    same('by', 'bye');
    same('hear', 'here');
    same('one', 'won');
    same('for', 'four');
    same('sun', 'son');
    same('flour', 'flower');
    same('meet', 'meat');
    same('week', 'weak');
    same('which', 'witch');
    same('new', 'knew');
    same('whole', 'hole');
    same('wait', 'weight');
    same('tail', 'tale');
    same('plane', 'plain');
    same('pair', 'pear');
    same('pair', 'pare');
    same('sale', 'sail');
    same('steal', 'steel');
    same('break', 'brake');
    same('I have 2 pens', 'I have too pens');
  });
  it('does not merge unrelated words', () => {
    assert.notEqual(normalizeSpoken('chair'), normalizeSpoken('share'));
    assert.notEqual(normalizeSpoken('ship'), normalizeSpoken('sheep'));
  });
  it('does not map mum to mom: a recogniser hearing mom is a real accent signal', () => {
    assert.notEqual(normalizeSpoken('mum'), normalizeSpoken('mom'));
  });
  it('returns "" for empty, whitespace-only and punctuation-only text', () => {
    assert.equal(normalizeSpoken(''), '');
    assert.equal(normalizeSpoken('   \n\t '), '');
    assert.equal(normalizeSpoken('...!?'), '');
    assert.equal(normalizeSpoken("'"), '');
  });
  it('is idempotent', () => {
    for (const t of ["Mum's got a CAT.", 'I organise 5 colourful pens', 'Their well-dressed neighbour']) {
      assert.equal(normalizeSpoken(normalizeSpoken(t)), normalizeSpoken(t));
    }
  });
});

describe('compareSpoken', () => {
  it('match: equal after normalising', () => {
    assert.equal(compareSpoken('cat', 'cat').verdict, 'match');
    assert.equal(compareSpoken('cat', 'cat').distance, 0);
    assert.equal(compareSpoken("Mum's got a cat.", "mum’s got a CAT").verdict, 'match');
    assert.equal(compareSpoken('colour', 'Color.').verdict, 'match');
    assert.equal(compareSpoken('I have 5 pens.', 'I have five pens').verdict, 'match');
    assert.equal(compareSpoken('write', 'Right.').verdict, 'match');
  });
  it('returns the normalised texts', () => {
    const c = compareSpoken("Mum's CAT.", 'mums cat!');
    assert.equal(c.expected, "mum's cat");
    assert.equal(c.heard, 'mums cat');
  });
  it('silent: nothing heard', () => {
    assert.equal(compareSpoken('cat', '').verdict, 'silent');
    assert.equal(compareSpoken('cat', '   ').verdict, 'silent');
    assert.equal(compareSpoken('cat', '...').verdict, 'silent');
    assert.equal(compareSpoken('I have a cat.', '').verdict, 'silent');
  });
  it('mismatch: chair vs share', () => {
    const c = compareSpoken('chair', 'share');
    assert.equal(c.verdict, 'mismatch');
    // Levenshtein("chair","share") is 3; the brief said 2, the verdict is what counts.
    assert.equal(c.distance, 3);
  });
  it('mismatch: a short word one letter off (bit / bet, cap / cop)', () => {
    const c = compareSpoken('bit', 'bet');
    assert.equal(c.verdict, 'mismatch');
    assert.equal(c.distance, 1);
    assert.equal(compareSpoken('cap', 'cop').verdict, 'mismatch');
  });
  it('the single-word boundary is 6 letters: 5 mismatches, 6 with an inflection is close', () => {
    assert.equal(compareSpoken('apple', 'apples').verdict, 'mismatch'); // 5 letters
    assert.equal(compareSpoken('banana', 'bananas').verdict, 'close'); // 6 letters
  });
  it('a single word is close only for an inflection suffix: s es d ed ing er ers, either way round', () => {
    assert.equal(compareSpoken('firefighter', 'firefighters').verdict, 'close'); // s
    assert.equal(compareSpoken('firefighters', 'firefighter').verdict, 'close'); // heard drops it
    assert.equal(compareSpoken('church', 'churches').verdict, 'close'); // es
    assert.equal(compareSpoken('bridge', 'bridged').verdict, 'close'); // d
    assert.equal(compareSpoken('listen', 'listened').verdict, 'close'); // ed
    assert.equal(compareSpoken('listen', 'listening').verdict, 'close'); // ing
    assert.equal(compareSpoken('listen', 'listener').verdict, 'close'); // er
    assert.equal(compareSpoken('listen', 'listeners').verdict, 'close'); // ers
    assert.equal(compareSpoken('listens', 'listen').verdict, 'close'); // heard drops it
  });
  it('mismatch: one letter off in a long word that is not an inflection', () => {
    for (const [a, b] of [
      ['carrot', 'parrot'],
      ['donkey', 'monkey'],
      ['bridge', 'fridge'],
      ['danger', 'hanger'],
      ['leaned', 'learned'],
      ['dessert', 'desert'],
      ['brought', 'bought'],
      ['through', 'though'],
      ['banana', 'banano'],
    ] as const) {
      assert.equal(compareSpoken(a, b).verdict, 'mismatch', `${a}/${b}`);
    }
  });
  it('mismatch: a derivational ending is not an inflection (loudly / loud)', () => {
    assert.equal(compareSpoken('loudly', 'loud').verdict, 'mismatch');
    assert.equal(compareSpoken('quickly', 'quick').verdict, 'mismatch');
  });
  it('mismatch: a short word never takes the inflection leniency', () => {
    assert.equal(compareSpoken('apple', 'apples').verdict, 'mismatch');
    assert.equal(compareSpoken('walk', 'walked').verdict, 'mismatch');
  });
  it('close: a long word one letter off (firefighter / firefighters)', () => {
    const c = compareSpoken('firefighter', 'firefighters');
    assert.equal(c.verdict, 'close');
    assert.equal(c.distance, 1);
  });
  it('a long word two letters off is a mismatch', () => {
    assert.equal(compareSpoken('firefighter', 'firefighting').verdict, 'mismatch');
    assert.equal(compareSpoken('banana', 'bananaxx').verdict, 'mismatch');
  });
  it('mismatch: ship vs sheep', () => {
    assert.equal(compareSpoken('ship', 'sheep').verdict, 'mismatch');
  });
  it('a single word heard as two words is a mismatch', () => {
    assert.equal(compareSpoken('firefighter', 'fire fighter').verdict, 'mismatch');
  });
  it('close: one word substituted in ten', () => {
    const ten = 'we go to the park with our dog every day';
    assert.equal(ten.split(' ').length, 10);
    const c = compareSpoken(ten, 'we go to the park with our cat every day');
    assert.equal(c.verdict, 'close');
    assert.equal(c.distance, 1);
  });
  it('under ten words no word-level difference is close: one substitution in four words', () => {
    const c = compareSpoken('I like red apples', 'I like green apples');
    assert.equal(c.verdict, 'mismatch');
    assert.equal(c.distance, 1);
  });
  it('under ten words: a changed pronoun, a changed number, a changed noun are mismatches', () => {
    assert.equal(compareSpoken('She has taught maths since 2010.', 'He has taught maths since 2010.').verdict, 'mismatch');
    assert.equal(compareSpoken('I am ten.', 'I am two.').verdict, 'mismatch');
    assert.equal(compareSpoken('pencil case', 'pencil cake').verdict, 'mismatch');
  });
  it('two substitutions in four words is a mismatch', () => {
    const c = compareSpoken('I like red apples', 'we like green apples');
    assert.equal(c.verdict, 'mismatch');
    assert.equal(c.distance, 2);
  });
  it('a dropped word is one edit, and under ten words one edit is a mismatch', () => {
    const c = compareSpoken('I like red apples', 'I like apples');
    assert.equal(c.distance, 1);
    assert.equal(c.verdict, 'mismatch');
  });
  it('an added word is one edit, and under ten words one edit is a mismatch', () => {
    const c = compareSpoken('I like apples', 'I really like apples');
    assert.equal(c.distance, 1);
    assert.equal(c.verdict, 'mismatch');
  });
  it('ten words allow one edit: a dropped word is close, two substitutions are a mismatch', () => {
    const ten = 'we go to the park with our dog every day';
    assert.equal(ten.split(' ').length, 10);
    const dropped = compareSpoken(ten, 'we go to the park with our dog day');
    assert.equal(dropped.distance, 1);
    assert.equal(dropped.verdict, 'close');
    const two = compareSpoken(ten, 'we go to the park with our cat every night');
    assert.equal(two.distance, 2);
    assert.equal(two.verdict, 'mismatch');
  });
  it('nine words allow none', () => {
    const nine = 'we go to the park with our dog today';
    assert.equal(nine.split(' ').length, 9);
    assert.equal(compareSpoken(nine, 'we go to the park with our cat today').verdict, 'mismatch');
  });
  it('allows floor(10%) edits in a long sentence: 20 words allow 2', () => {
    const base = 'one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen twenty'
      .split(' ');
    assert.equal(base.length, 20);
    const swap = (n: number) => base.map((w, i) => (i < n ? 'x' + w : w)).join(' ');
    const e = base.join(' ');
    assert.equal(compareSpoken(e, swap(2)).verdict, 'close');
    assert.equal(compareSpoken(e, swap(3)).verdict, 'mismatch');
  });
  it('19 words allow one edit, not two', () => {
    const base = 'one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen'
      .split(' ');
    assert.equal(base.length, 19);
    const swap = (n: number) => base.map((w, i) => (i < n ? 'x' + w : w)).join(' ');
    assert.equal(compareSpoken(base.join(' '), swap(1)).verdict, 'close');
    assert.equal(compareSpoken(base.join(' '), swap(2)).verdict, 'mismatch');
  });
  it('mismatch: a completely different sentence', () => {
    const c = compareSpoken('I have got a red pen', 'The weather is nice today');
    assert.equal(c.verdict, 'mismatch');
  });
  it('mismatch: heard is longer by two words', () => {
    const c = compareSpoken('I like apples', 'I like apples and pears');
    assert.equal(c.distance, 2);
    assert.equal(c.verdict, 'mismatch');
  });
  it('spelling and number words do not count as edits inside a sentence', () => {
    assert.equal(compareSpoken('My favourite colour is grey.', 'my favorite color is gray').verdict, 'match');
  });
});

describe('cost estimate', () => {
  it('prices a model per minute', () => {
    assert.equal(estimateCostUsd(600, 'gpt-4o-transcribe'), 0.06);
    assert.equal(estimateCostUsd(0, 'gpt-4o-transcribe'), 0);
    assert.ok(Math.abs((estimateCostUsd(600, 'gpt-4o-mini-transcribe') ?? NaN) - 0.03) < 1e-12);
    assert.ok(Math.abs((estimateCostUsd(600, 'whisper-1') ?? NaN) - 0.06) < 1e-12);
  });
  it('returns null for an unknown model, including object-prototype names', () => {
    assert.equal(estimateCostUsd(600, 'gpt-9-transcribe'), null);
    assert.equal(estimateCostUsd(600, 'constructor'), null);
    assert.equal(estimateCostUsd(600, ''), null);
  });
  it('lists the three models with their list prices', () => {
    assert.deepEqual(PRICE_PER_MINUTE_USD, { 'gpt-4o-transcribe': 0.006, 'gpt-4o-mini-transcribe': 0.003, 'whisper-1': 0.006 });
  });
  it('reads seconds off a size at the assumed bitrate', () => {
    assert.equal(ASSUMED_KBPS, 128);
    assert.equal(secondsFromBytes(16000), 1);
    assert.equal(secondsFromBytes(16000, 128), 1);
    assert.equal(secondsFromBytes(5000, 40), 1);
    assert.equal(secondsFromBytes(0), 0);
  });
});

describe('speech cache', () => {
  const cache: SpeechCache = {
    cat: { size: 1000, etag: '"abc"', heard: 'Cat.' },
    dog: { size: 2000, etag: '"def"', heard: 'Dog.' },
  };
  it('hits only when size and etag both equal', () => {
    assert.equal(cacheHit(cache, 'cat', 1000, '"abc"'), 'Cat.');
    assert.equal(cacheHit(cache, 'cat', 1001, '"abc"'), null);
    assert.equal(cacheHit(cache, 'cat', 1000, '"xyz"'), null);
    assert.equal(cacheHit(cache, 'cat', 1001, '"xyz"'), null);
    assert.equal(cacheHit(cache, 'bird', 1000, '"abc"'), null);
  });
  it('does not read the object prototype as an entry', () => {
    assert.equal(cacheHit(cache, 'constructor', 1, ''), null);
    assert.equal(cacheHit(cache, 'toString', 1, ''), null);
  });
  it('a cached empty transcript is still a hit (it is a string, not null)', () => {
    assert.equal(cacheHit({ x: { size: 1, etag: 'e', heard: '' } }, 'x', 1, 'e'), '');
  });
  it('parses tolerantly', () => {
    assert.deepEqual(parseSpeechCache('not json'), {});
    assert.deepEqual(parseSpeechCache(''), {});
    assert.deepEqual(parseSpeechCache('null'), {});
    assert.deepEqual(parseSpeechCache('[1,2]'), {});
    assert.deepEqual(parseSpeechCache('"text"'), {});
  });
  it('drops malformed entries and keeps good ones', () => {
    const json = JSON.stringify({
      ok: { size: 1, etag: 'e', heard: 'h' },
      noSize: { etag: 'e', heard: 'h' },
      badHeard: { size: 1, etag: 'e', heard: 5 },
      nul: null,
      str: 'x',
    });
    assert.deepEqual(parseSpeechCache(json), { ok: { size: 1, etag: 'e', heard: 'h' } });
  });
  it('round-trips', () => {
    assert.deepEqual(parseSpeechCache(serializeSpeechCache(cache)), cache);
    assert.deepEqual(parseSpeechCache(serializeSpeechCache({})), {});
  });
  it('serialises with sorted keys, so two runs diff cleanly', () => {
    const a = serializeSpeechCache({ b: cache.cat as CacheEntry, a: cache.dog as CacheEntry });
    assert.ok(a.indexOf('"a"') < a.indexOf('"b"'));
  });
  it('never contains a key-looking string', () => {
    assert.ok(!serializeSpeechCache(cache).includes('sk-'));
  });
});

// ─── checkClips ────────────────────────────────────────────────────────────

const mk = (slug: string, text = slug, grades: number[] = [1], source: AudioItem['source'] = 'word'): AudioItem => ({
  slug,
  text,
  register: 'young',
  source,
  grades,
});
const clip = (size = 100, etag = '"e"') => ({ bytes: new Uint8Array(size), size, etag });
const tick = () => new Promise<void>(r => setImmediate(r));

function deps(over: Partial<CheckDeps> = {}): CheckDeps {
  return {
    fetchClip: async () => clip(),
    transcribe: async (_b, item) => item.text,
    cache: {},
    concurrency: 1,
    ...over,
  };
}

describe('checkClips', () => {
  it('(a) a clip whose transcript matches is a match', async () => {
    const { results, stopped } = await checkClips([mk('cat')], deps({ transcribe: async () => 'Cat.' }));
    assert.equal(stopped, false);
    assert.equal(results.length, 1);
    assert.equal(results[0]!.verdict, 'match');
    assert.equal(results[0]!.heard, 'Cat.');
    assert.equal(results[0]!.item.slug, 'cat');
  });
  it('grades a wrong transcript against the item text', async () => {
    const { results } = await checkClips([mk('chair')], deps({ transcribe: async () => 'Share.' }));
    assert.equal(results[0]!.verdict, 'mismatch');
    assert.equal(results[0]!.heard, 'Share.');
  });
  it('an empty transcript is silent', async () => {
    const { results } = await checkClips([mk('cat')], deps({ transcribe: async () => '' }));
    assert.equal(results[0]!.verdict, 'silent');
  });
  it('(b) a missing clip is missing and is never transcribed', async () => {
    let calls = 0;
    const { results } = await checkClips(
      [mk('cat')],
      deps({
        fetchClip: async () => 'missing',
        transcribe: async () => {
          calls++;
          return 'x';
        },
      }),
    );
    assert.equal(results[0]!.verdict, 'missing');
    assert.equal(results[0]!.heard, '');
    assert.equal(calls, 0);
  });
  it('(c) a cache hit skips transcribe and uses the cached transcript', async () => {
    let calls = 0;
    const cache: SpeechCache = { cat: { size: 100, etag: '"e"', heard: 'Cat.' } };
    const { results } = await checkClips(
      [mk('cat')],
      deps({
        cache,
        transcribe: async () => {
          calls++;
          return 'wrong';
        },
      }),
    );
    assert.equal(calls, 0);
    assert.equal(results[0]!.verdict, 'match');
    assert.equal(results[0]!.heard, 'Cat.');
  });
  it('(c) a cache entry for a changed clip is not used', async () => {
    let calls = 0;
    const cache: SpeechCache = { cat: { size: 99, etag: '"e"', heard: 'Cat.' } };
    const { results } = await checkClips(
      [mk('cat')],
      deps({
        cache,
        transcribe: async () => {
          calls++;
          return 'Dog.';
        },
      }),
    );
    assert.equal(calls, 1);
    assert.equal(results[0]!.verdict, 'mismatch');
  });
  it('(d) a fetchClip that throws becomes an error with a detail, and the run continues', async () => {
    const { results, stopped } = await checkClips(
      [mk('a'), mk('b'), mk('c')],
      deps({
        fetchClip: async item => {
          if (item.slug === 'b') throw new Error('socket hang up');
          return clip();
        },
      }),
    );
    assert.equal(stopped, false);
    assert.deepEqual(results.map(r => r.verdict), ['match', 'error', 'match']);
    assert.match(results[1]!.detail ?? '', /socket hang up/);
  });
  it('(d) a transcribe error other than StopRun is an error for that clip only', async () => {
    const { results, stopped } = await checkClips(
      [mk('a'), mk('b'), mk('c')],
      deps({
        transcribe: async (_b, item) => {
          if (item.slug === 'b') throw new Error('500 upstream');
          return item.text;
        },
      }),
    );
    assert.equal(stopped, false);
    assert.deepEqual(results.map(r => r.verdict), ['match', 'error', 'match']);
    assert.match(results[1]!.detail ?? '', /500 upstream/);
  });
  it('(d) an error detail never carries a key-looking string', async () => {
    const { results } = await checkClips(
      [mk('a')],
      deps({
        transcribe: async () => {
          throw new Error('bad header Bearer sk-proj-ABCDEFGHIJKLMNOP1234');
        },
      }),
    );
    assert.equal(results[0]!.verdict, 'error');
    assert.ok(!/sk-proj-ABCDEF/.test(results[0]!.detail ?? ''));
  });
  it('(e) StopRun on the 3rd clip with concurrency 1: stopped, later clips untouched, earlier results kept', async () => {
    const items = ['a', 'b', 'c', 'd', 'e'].map(s => mk(s));
    const fetched: string[] = [];
    let n = 0;
    const { results, stopped, stopReason } = await checkClips(
      items,
      deps({
        fetchClip: async item => {
          fetched.push(item.slug);
          return clip();
        },
        transcribe: async (_b, item) => {
          if (++n === 3) throw new StopRun('401: bad key');
          return item.text;
        },
      }),
    );
    assert.equal(stopped, true);
    assert.equal(stopReason, '401: bad key');
    assert.deepEqual(fetched, ['a', 'b', 'c']);
    assert.deepEqual(results.map(r => r.item.slug), ['a', 'b']);
    assert.deepEqual(results.map(r => r.verdict), ['match', 'match']);
  });
  it('(e) StopRun stops sibling workers from taking new clips', async () => {
    const items = Array.from({ length: 10 }, (_, i) => mk('s' + i));
    const fetched: string[] = [];
    const { stopped, results } = await checkClips(
      items,
      deps({
        concurrency: 3,
        fetchClip: async item => {
          fetched.push(item.slug);
          return clip();
        },
        transcribe: async (_b, item) => {
          await tick();
          if (item.slug === 's1') throw new StopRun('403');
          return item.text;
        },
      }),
    );
    assert.equal(stopped, true);
    assert.ok(fetched.length < items.length, `fetched ${fetched.length}`);
    assert.ok(!results.some(r => r.item.slug === 's1'));
    assert.ok(results.every(r => r.verdict === 'match'));
  });
  it('(f) transcribe never runs more than deps.concurrency at once', async () => {
    for (const concurrency of [1, 2, 3]) {
      let inFlight = 0;
      let peak = 0;
      const items = Array.from({ length: 12 }, (_, i) => mk('c' + i));
      const { results } = await checkClips(
        items,
        deps({
          concurrency,
          transcribe: async (_b, item) => {
            inFlight++;
            peak = Math.max(peak, inFlight);
            await tick();
            await tick();
            inFlight--;
            return item.text;
          },
        }),
      );
      assert.equal(results.length, 12);
      assert.equal(peak, concurrency, `concurrency ${concurrency}`);
    }
  });
  it('(f) concurrency below 1 still makes progress', async () => {
    const { results } = await checkClips([mk('a'), mk('b')], deps({ concurrency: 0 }));
    assert.equal(results.length, 2);
  });
  it('(g) new transcripts go into the cache with size, etag and heard', async () => {
    const cache: SpeechCache = {};
    await checkClips(
      [mk('cat'), mk('dog')],
      deps({
        cache,
        fetchClip: async item => clip(item.slug === 'cat' ? 111 : 222, item.slug === 'cat' ? '"c"' : '"d"'),
        transcribe: async (_b, item) => item.text + '.',
      }),
    );
    assert.deepEqual(cache, {
      cat: { size: 111, etag: '"c"', heard: 'cat.' },
      dog: { size: 222, etag: '"d"', heard: 'dog.' },
    });
  });
  it('(g) a hit leaves its entry as it was, and a missing or errored clip adds none', async () => {
    const cache: SpeechCache = { cat: { size: 100, etag: '"e"', heard: 'Cat.' } };
    await checkClips(
      [mk('cat'), mk('gone'), mk('boom')],
      deps({
        cache,
        fetchClip: async item => {
          if (item.slug === 'gone') return 'missing';
          if (item.slug === 'boom') throw new Error('x');
          return clip();
        },
      }),
    );
    assert.deepEqual(Object.keys(cache), ['cat']);
    assert.deepEqual(cache.cat, { size: 100, etag: '"e"', heard: 'Cat.' });
  });
  it('(g) an empty transcript is not cached, so a re-run retries it', async () => {
    const cache: SpeechCache = {};
    await checkClips([mk('cat')], deps({ cache, transcribe: async () => '' }));
    assert.deepEqual(cache, {});
  });
  it('(h) results come back in the order of items however the work finishes', async () => {
    const items = Array.from({ length: 8 }, (_, i) => mk('o' + i));
    const { results } = await checkClips(
      items,
      deps({
        concurrency: 4,
        transcribe: async (_b, item) => {
          const i = Number(item.slug.slice(1));
          for (let k = 0; k < 8 - i; k++) await tick(); // later items finish first
          return item.text;
        },
      }),
    );
    assert.deepEqual(results.map(r => r.item.slug), items.map(i => i.slug));
  });
  it('reports progress once per finished clip', async () => {
    const seen: Array<[number, number]> = [];
    await checkClips(
      [mk('a'), mk('b'), mk('c')],
      deps({
        fetchClip: async item => (item.slug === 'b' ? 'missing' : clip()),
        onProgress: (d, t) => seen.push([d, t]),
      }),
    );
    assert.deepEqual(seen, [[1, 3], [2, 3], [3, 3]]);
  });
  it('a throwing onProgress neither rejects the run nor loses a result', async () => {
    let calls = 0;
    const { results, stopped } = await checkClips(
      ['a', 'b', 'c', 'd'].map(s => mk(s)),
      deps({
        concurrency: 2,
        onProgress: () => {
          calls++;
          throw new Error('progress bar broke');
        },
      }),
    );
    assert.equal(calls, 4);
    assert.equal(stopped, false);
    assert.deepEqual(results.map(x => x.verdict), ['match', 'match', 'match', 'match']);
  });
  it('a StopRun thrown by fetchClip stops the run too, with its reason', async () => {
    const fetched: string[] = [];
    const { results, stopped, stopReason } = await checkClips(
      ['a', 'b', 'c', 'd'].map(s => mk(s)),
      deps({
        fetchClip: async item => {
          fetched.push(item.slug);
          if (item.slug === 'b') throw new StopRun('stop from fetch');
          return clip();
        },
      }),
    );
    assert.equal(stopped, true);
    assert.equal(stopReason, 'stop from fetch');
    assert.deepEqual(fetched, ['a', 'b']);
    assert.deepEqual(results.map(x => x.item.slug), ['a']);
  });
  it('a run that finishes has no stopReason', async () => {
    const out = await checkClips([mk('a')], deps());
    assert.equal(out.stopped, false);
    assert.equal(out.stopReason, undefined);
  });
  it('an empty list is a quiet success', async () => {
    assert.deepEqual(await checkClips([], deps()), { results: [], stopped: false });
  });
});

// ─── Summary and report ────────────────────────────────────────────────────

const r = (item: AudioItem, heard: string, verdict: CheckResult['verdict'], detail?: string): CheckResult =>
  detail === undefined ? { item, heard, verdict } : { item, heard, verdict, detail };

const fixture: CheckResult[] = [
  r(mk('cat', 'cat', [1], 'word'), 'Cat.', 'match'),
  r(mk('firefighter', 'firefighter', [1, 2], 'word'), 'firefighters', 'close'),
  r(mk('chair', 'chair', [2], 'word'), 'Share.', 'mismatch'),
  r(mk('i-am-ten', 'I am ten.', [2], 'grammar'), '', 'silent'),
  r(mk('zebra', 'zebra', [1], 'word'), '', 'missing'),
];

describe('summarizeResults', () => {
  const lines = summarizeResults(fixture);
  const cells = (line: string) => line.split('|').map(c => c.trim()).filter(c => c !== '');
  const rows = lines.map(cells);
  const header = rows[0]!;
  const col = (name: string) => header.indexOf(name);
  const row = (grade: string, source: string) => rows.find(c => c[0] === grade && c[1] === source);

  it('has a header and a divider, a row per grade and source, and a total row', () => {
    assert.deepEqual(header.slice(0, 2), ['Grade', 'Source']);
    for (const v of ['match', 'close', 'mismatch', 'silent', 'missing', 'error', 'total']) assert.ok(col(v) > 1, v);
    assert.ok(/^\|?\s*-+/.test(lines[1]!), lines[1]);
    assert.ok(row('1', 'word'));
    assert.ok(row('2', 'word'));
    assert.ok(row('2', 'grammar'));
    assert.equal(row('1', 'grammar'), undefined);
    assert.ok(rows.some(c => c[0] === 'All'));
  });
  it('counts per row', () => {
    const g1 = row('1', 'word')!;
    assert.equal(g1[col('match')], '1');
    assert.equal(g1[col('close')], '1'); // firefighter is used by grade 1 and 2
    assert.equal(g1[col('missing')], '1');
    assert.equal(g1[col('total')], '3');
    const g2w = row('2', 'word')!;
    assert.equal(g2w[col('close')], '1');
    assert.equal(g2w[col('mismatch')], '1');
    assert.equal(g2w[col('total')], '2');
    const g2g = row('2', 'grammar')!;
    assert.equal(g2g[col('silent')], '1');
    assert.equal(g2g[col('total')], '1');
  });
  it('counts a recording used by two grades in both rows but once in the total', () => {
    const all = rows.find(c => c[0] === 'All')!;
    assert.equal(all[col('total')], '5');
    assert.equal(all[col('match')], '1');
    assert.equal(all[col('close')], '1');
    assert.equal(all[col('mismatch')], '1');
    assert.equal(all[col('silent')], '1');
    assert.equal(all[col('missing')], '1');
    assert.equal(all[col('error')], '0');
  });
  it('rows are sorted by grade then source', () => {
    const body = rows.slice(2).filter(c => c[0] !== 'All');
    const keys = body.map(c => `${c[0]!.padStart(3, '0')}${c[1]}`);
    assert.deepEqual(keys, [...keys].sort());
  });
  it('puts a recording no grade uses in its own row rather than dropping it', () => {
    const out = summarizeResults([r(mk('x', 'x', []), 'x', 'match')]).map(cells);
    assert.ok(out.some(c => c[0] === '-' && c[1] === 'word'));
    assert.equal(out.find(c => c[0] === 'All')![out[0]!.indexOf('total')], '1');
  });
  it('an empty run still has a header and a total row', () => {
    const out = summarizeResults([]).map(cells);
    assert.equal(out.find(c => c[0] === 'All')![out[0]!.indexOf('total')], '0');
  });
});

describe('onlyLine', () => {
  it('lists mismatch and silent slugs, sorted, comma-separated', () => {
    assert.equal(
      onlyLine(fixture),
      'pnpm --filter @workspace/curriculum run english-audio -- --only chair,i-am-ten',
    );
  });
  it('sorts regardless of input order and leaves out close, match, missing and error', () => {
    const rs = [
      r(mk('zeta'), 'x', 'mismatch'),
      r(mk('alpha'), '', 'silent'),
      r(mk('mid'), 'x', 'close'),
      r(mk('ok'), 'ok', 'match'),
      r(mk('gone'), '', 'missing'),
      r(mk('boom'), '', 'error', 'x'),
    ];
    assert.equal(onlyLine(rs), 'pnpm --filter @workspace/curriculum run english-audio -- --only alpha,zeta');
  });
  it('is empty when there is nothing to re-voice', () => {
    assert.equal(onlyLine([]), '');
    assert.equal(onlyLine([r(mk('a'), 'a', 'match'), r(mk('b'), 'b', 'close')]), '');
  });
});

describe('renderReportMarkdown', () => {
  const md = renderReportMarkdown(fixture, { model: 'gpt-4o-transcribe', date: '2026-10-24' });
  it('says a mismatch means a person should listen', () => {
    assert.ok(md.includes('A mismatch means a person should listen'));
  });
  it('names the model and the date', () => {
    assert.ok(md.includes('gpt-4o-transcribe'));
    assert.ok(md.includes('2026-10-24'));
  });
  it('has a table of expected / heard / slug for mismatches and silents', () => {
    assert.match(md, /\|\s*Expected\s*\|\s*Heard\s*\|\s*Slug\s*\|/);
    assert.ok(md.includes('chair'));
    assert.ok(md.includes('Share.'));
    assert.ok(md.includes('i-am-ten'));
    assert.ok(md.includes('I am ten.'));
  });
  it('does not list matches as problems, and lists a close only in its own table', () => {
    const lines = md.split('\n');
    const problems = lines.filter(l => /\|/.test(l) && l.includes('Share.'));
    assert.equal(problems.length, 1);
    assert.ok(!lines.some(l => l.startsWith('|') && l.includes('Cat.')));
    const closeAt = lines.findIndex(l => l.startsWith('## Close: worth a glance'));
    const listenAt = lines.findIndex(l => l.startsWith('## To listen to'));
    assert.ok(listenAt >= 0 && closeAt > listenAt, 'the close table follows the mismatch table');
    const withFirefighters = lines.map((l, i) => [l, i] as const).filter(([l]) => l.startsWith('|') && l.includes('firefighters'));
    assert.equal(withFirefighters.length, 1);
    assert.ok(withFirefighters[0]![1] > closeAt);
    const row = withFirefighters[0]![0];
    assert.ok(row.includes('firefighter'));
    assert.ok(row.includes('| 1, 2 |'));
    // the table has the same expected / heard / slug columns
    assert.match(lines.slice(closeAt).join('\n'), /\|\s*Expected\s*\|\s*Heard\s*\|\s*Slug\s*\|/);
  });
  it('the --only line does not include a close', () => {
    assert.ok(!md.includes('--only chair,firefighter'));
    assert.ok(!md.includes('firefighter,'));
  });
  it('leaves the close table out when there is no close', () => {
    const out = renderReportMarkdown([r(mk('a'), 'a', 'match'), r(mk('b'), 'x', 'mismatch')], { model: 'm', date: 'd' });
    assert.ok(!out.includes('Close: worth a glance'));
  });
  it('includes the summary table and the --only line', () => {
    assert.ok(md.includes('| All'));
    assert.ok(md.includes('run english-audio -- --only chair,i-am-ten'));
  });
  it('lists missing clips', () => {
    assert.ok(md.includes('zebra'));
  });
  it('lists errors with their detail', () => {
    const out = renderReportMarkdown([r(mk('boom'), '', 'error', 'socket hang up')], { model: 'm', date: 'd' });
    assert.ok(out.includes('boom'));
    assert.ok(out.includes('socket hang up'));
  });
  it('escapes pipes and newlines in transcripts so a row cannot break the table', () => {
    const out = renderReportMarkdown([r(mk('p', 'a | b'), 'x | y\nz', 'mismatch')], { model: 'm', date: 'd' });
    const row = out.split('\n').find(l => l.includes('| p'))!;
    assert.ok(row, 'row present');
    assert.ok(row.includes('a \\| b'));
    assert.ok(row.includes('x \\| y z'));
  });
  it('says plainly when nothing needs a listen', () => {
    const out = renderReportMarkdown([r(mk('a'), 'a', 'match')], { model: 'm', date: 'd' });
    assert.ok(/nothing/i.test(out));
    assert.ok(!out.includes('--only'));
  });
  it('states what the check cannot hear', () => {
    assert.match(md, /accent|stress/i);
  });
  it('never carries a key or the key placeholder', () => {
    assert.ok(!md.includes('sk-'));
    assert.ok(!md.includes('OPENAI_API_KEY'));
  });
});
