import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ScopeDrawer } from '../ai/scopeDraw.ts';

class Spent extends Error {}
const opts = { isSpent: (e: unknown) => e instanceof Spent, error: () => new Spent('all spent') };
const L = (id: string) => ({ id });
const all = [L('a'), L('b'), L('c')];

describe('ScopeDrawer', () => {
  it('draws from the lesson its slot names', () => {
    const d = new ScopeDrawer([all[1]!, all[2]!, all[0]!], all, opts);
    assert.equal(d.draw(0, 'mc', l => l.id).lesson.id, 'b');
    assert.equal(d.draw(1, 'mc', l => l.id).lesson.id, 'c');
    assert.equal(d.draw(2, 'mc', l => l.id).lesson.id, 'a');
  });

  it('slots wrap round when there are more questions than slots', () => {
    const d = new ScopeDrawer([all[0]!, all[1]!], all, opts);
    assert.equal(d.lessonAt(2).id, 'a');
    assert.equal(d.lessonAt(5).id, 'b');
  });

  it('hands a spent lesson\'s question to the next lesson, and remembers it', () => {
    const calls: string[] = [];
    const d = new ScopeDrawer([all[0]!], all, opts);
    const make = (l: { id: string }) => {
      calls.push(l.id);
      if (l.id === 'a') throw new Spent('a is out of mc');
      return l.id;
    };
    assert.equal(d.draw(0, 'mc', make).lesson.id, 'b');
    calls.length = 0;
    // 'a' is spent for mc now, so it is not even tried again.
    assert.equal(d.draw(0, 'mc', make).lesson.id, 'b');
    assert.deepEqual(calls, ['b']);
  });

  it('spent is per bank key: a lesson out of mc can still write true/false', () => {
    const d = new ScopeDrawer([all[0]!], all, opts);
    d.draw(0, 'mc', l => { if (l.id === 'a') throw new Spent(); return 1; });
    assert.equal(d.draw(0, 'tf', l => l.id).lesson.id, 'a');
  });

  it('throws the spent error when every lesson is out, and rethrows anything else', () => {
    const d = new ScopeDrawer([all[0]!], all, opts);
    assert.throws(() => d.draw(0, 'mc', () => { throw new Spent(); }), Spent);
    // all three are now spent for mc: still the spent error, with no further calls
    let called = 0;
    assert.throws(() => d.draw(0, 'mc', () => { called++; return 1; }), Spent);
    assert.equal(called, 0);
    const e = new ScopeDrawer([all[0]!], all, opts);
    assert.throws(() => e.draw(0, 'mc', () => { throw new TypeError('boom'); }), TypeError);
  });

  it('refuses to be built with no slots', () => {
    assert.throws(() => new ScopeDrawer([], all, opts));
  });
});
