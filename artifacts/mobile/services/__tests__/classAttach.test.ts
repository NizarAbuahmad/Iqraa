/**
 * The line a teacher reads after attaching a material to classes.
 *
 * Run:
 *   node --experimental-strip-types --test \
 *     artifacts/mobile/services/__tests__/classAttach.test.ts
 *
 * Why this is not one ternary in each save screen any more: with multi-select,
 * "saved" and "failed" cannot describe two of three landing. A teacher told
 * «حُفظت» when one section silently missed out will find that out in front of
 * the class.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { attachAcrossClasses, describeAttachResult } from '../classAttach.ts';

/** Stands in for the screens' translate: renders key + args, so a test can see
 *  which message was chosen and what it was handed. */
const t = (key: any, ...args: any[]): string =>
  args.length ? `${key}(${args.join('|')})` : String(key);

const picks = (...names: string[]) => names.map(name => ({ name }));

describe('describeAttachResult', () => {
  it('names the class when there is exactly one', () => {
    // A count would be a worse message here: «حُفظت في صف واحد» tells the
    // teacher less than the name they just tapped.
    const out = describeAttachResult({ attached: 1, requested: 1 }, picks('صف أ'), t, 'ar');
    assert.equal(out, 'savedToClass(صف أ)');
  });

  it('counts them when there are several, and says they are copies', () => {
    const out = describeAttachResult({ attached: 3, requested: 3 }, picks('أ', 'ب', 'ج'), t, 'ar');
    assert.equal(out, 'savedToClasses(3 صفوف)');
  });

  it('reports a partial attach rather than claiming success', () => {
    const out = describeAttachResult({ attached: 2, requested: 3 }, picks('أ', 'ب', 'ج'), t, 'ar');
    assert.equal(out, 'savedToClassesPartial(صفّان|3 صفوف)');
  });

  it('reports total failure as the failure message', () => {
    const out = describeAttachResult({ attached: 0, requested: 2 }, picks('أ', 'ب'), t, 'ar');
    assert.equal(out, 'saveToClassFailed');
  });

  it('uses English counts for an English teacher', () => {
    assert.equal(
      describeAttachResult({ attached: 3, requested: 3 }, picks('A', 'B', 'C'), t, 'en'),
      'savedToClasses(3 classes)',
    );
    assert.equal(
      describeAttachResult({ attached: 1, requested: 2 }, picks('A', 'B'), t, 'en'),
      'savedToClassesPartial(1 class|2 classes)',
    );
  });

  it('gets Arabic number agreement right at the boundaries', () => {
    // Substituting a digit into one template is wrong in three of Arabic's
    // four cases — the same rule arCountStudents exists for.
    const at = (n: number) =>
      describeAttachResult({ attached: n, requested: n }, picks(...Array(n).fill('x')), t, 'ar');
    assert.equal(at(2), 'savedToClasses(صفّان)');
    assert.equal(at(10), 'savedToClasses(10 صفوف)');
    assert.equal(at(11), 'savedToClasses(11 صفًّا)');
  });

  it('does not crash when the picks list is empty but something attached', () => {
    // Defensive: the sheet never confirms an empty selection, but this module
    // is the one that would throw on picks[0] if it ever did.
    assert.equal(
      describeAttachResult({ attached: 1, requested: 1 }, [], t, 'ar'),
      'savedToClasses(صف واحد)',
    );
  });
});

describe('attachAcrossClasses', () => {
  /** Records what happened so a test can assert ordering, not just counts. */
  const spy = (opts: { updateFails?: string[]; noDuplicate?: boolean } = {}) => {
    const updates: Array<[string, string]> = [];
    let copies = 0;
    return {
      updates,
      get copies() { return copies; },
      effects: {
        update: async (materialId: string, classId: string) => {
          updates.push([materialId, classId]);
          return !opts.updateFails?.includes(classId);
        },
        duplicate: async (_id: string) => {
          if (opts.noDuplicate) return null;
          copies += 1;
          return { id: `copy-${copies}` };
        },
      },
    };
  };

  it('gives the original to the FIRST class, not the last', async () => {
    // The teacher is looking at the material they just made. It should stay
    // the one they are looking at rather than becoming copy number three.
    const s = spy();
    const out = await attachAcrossClasses(s.effects, 'mat-1', ['a', 'b', 'c']);
    assert.deepEqual(out, { attached: 3, requested: 3 });
    assert.deepEqual(s.updates, [['mat-1', 'a'], ['copy-1', 'b'], ['copy-2', 'c']]);
  });

  it('makes one copy per extra class, and none for a single class', async () => {
    const one = spy();
    await attachAcrossClasses(one.effects, 'mat-1', ['a']);
    assert.equal(one.copies, 0, 'a single class must not duplicate anything');

    const three = spy();
    await attachAcrossClasses(three.effects, 'mat-1', ['a', 'b', 'c']);
    assert.equal(three.copies, 2);
  });

  it('ignores a class picked twice rather than making a stray copy', async () => {
    const s = spy();
    const out = await attachAcrossClasses(s.effects, 'mat-1', ['a', 'b', 'a']);
    assert.deepEqual(out, { attached: 2, requested: 2 });
    assert.equal(s.copies, 1);
  });

  it('keeps going when one class fails, and reports the shortfall', async () => {
    const s = spy({ updateFails: ['b'] });
    const out = await attachAcrossClasses(s.effects, 'mat-1', ['a', 'b', 'c']);
    assert.deepEqual(out, { attached: 2, requested: 3 });
    assert.equal(s.updates.length, 3, 'c is still attempted after b failed');
  });

  it('does not count a class whose copy was never made', async () => {
    const s = spy({ noDuplicate: true });
    const out = await attachAcrossClasses(s.effects, 'mat-1', ['a', 'b', 'c']);
    assert.deepEqual(out, { attached: 1, requested: 3 });
  });

  it('does nothing at all for an empty or blank selection', async () => {
    const s = spy();
    assert.deepEqual(await attachAcrossClasses(s.effects, 'mat-1', []), { attached: 0, requested: 0 });
    assert.deepEqual(await attachAcrossClasses(s.effects, 'mat-1', ['']), { attached: 0, requested: 0 });
    assert.equal(s.updates.length, 0);
  });
});
