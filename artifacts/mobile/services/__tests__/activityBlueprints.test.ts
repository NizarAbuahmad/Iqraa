/**
 * Pins that the activity formats stay genuinely different.
 *
 * They were not. `generateActivity` built one template and interpolated the
 * group-size noun into it, so all five types returned byte-identical
 * `objective`, `materials`, `steps`, `teacherTips`, `differentiation` and
 * `assessment` — a measured 1 distinct body across 5 types — and the lesson
 * flow's warm-up was the main activity again with the same three problems.
 * These tests fail if that collapses back.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { aiService } from '@/services/ai/generators.ts';
import {
  ACTIVITY_BLUEPRINT_IDS,
  distributeMinutes,
} from '@/services/ai/activityBlueprints.ts';
import type { ActivityOutput, AIRequest } from '@/services/ai/AIService.ts';

const TYPES = ['individual', 'group', 'discussion', 'hands-on', 'game'] as const;

/** Lessons chosen to cover both generator paths: the concrete math bank, and
 *  the concept path a chemistry lesson takes. */
const CASES = [
  { label: 'math / ar', topic: 'قانون الجيوب', subject: 'الرياضيات', language: 'arabic' as const },
  { label: 'chem / ar', topic: 'الروابط الأيونية', subject: 'الكيمياء', language: 'arabic' as const },
  { label: 'math / en', topic: 'Law of Sines', subject: 'Mathematics', language: 'english' as const },
];

const BASE = { grade: 'الصف العاشر', duration: 30 };

async function generateAll(c: typeof CASES[number]): Promise<Record<string, ActivityOutput>> {
  const out: Record<string, ActivityOutput> = {};
  for (const type of TYPES) {
    out[type] = await aiService.generateActivity({
      ...BASE, topic: c.topic, subject: c.subject, language: c.language, activityType: type,
    } as AIRequest);
  }
  return out;
}

describe('activity formats are distinct', () => {
  // The fields that were identical across all five types before this existed.
  const FIELDS = [
    'objective', 'groupSize', 'materials', 'steps',
    'teacherTips', 'differentiation', 'assessment',
  ] as const;

  for (const c of CASES) {
    it(`${c.label}: every type differs from every other on every field`, async () => {
      const out = await generateAll(c);
      for (const field of FIELDS) {
        const values = TYPES.map(t => JSON.stringify((out[t] as any)[field]));
        assert.equal(
          new Set(values).size, TYPES.length,
          `"${field}" is shared between activity types — ${new Set(values).size} distinct values across ${TYPES.length} types`,
        );
      }
    });

    it(`${c.label}: titles name the format, not one shared label`, async () => {
      const out = await generateAll(c);
      const titles = TYPES.map(t => out[t].title);
      assert.equal(new Set(titles).size, TYPES.length, `duplicate titles: ${titles.join(' | ')}`);
    });
  }

  it('reports the requested type verbatim, including one the picker never offered', async () => {
    const out = await aiService.generateActivity({
      ...BASE, topic: 'قانون الجيوب', subject: 'الرياضيات', language: 'arabic',
      activityType: 'station-rotation' as any,
    } as AIRequest);
    // Falls back to the `group` blueprint for structure but must not relabel
    // itself as a group activity — activityTypeLabel() shows the raw value.
    assert.equal(out.activityType, 'station-rotation');
    assert.ok(out.steps.length > 0);
  });
});

describe('each format carries the structure that defines it', () => {
  const req = { ...BASE, topic: 'قانون الجيوب', subject: 'الرياضيات', language: 'arabic' as const };
  const blob = (a: ActivityOutput) =>
    JSON.stringify([a.objective, a.groupSize, a.materials, a.steps, a.teacherTips, a.differentiation, a.assessment]);

  it('individual: no group work anywhere in it', async () => {
    const a = await aiService.generateActivity({ ...req, activityType: 'individual' } as AIRequest);
    const text = blob(a);
    // The exact wording the old template produced: «قسّم الطلاب حسب فردي».
    assert.ok(!/قسّم الطلاب/.test(text), 'an individual activity must not tell the teacher to split the class into groups');
    assert.ok(!/كل مجموعة/.test(text), 'an individual activity must not address groups');
    assert.ok(/استرجاع|الذاكرة/.test(text), 'expected a retrieval step');
    assert.ok(/محلول/.test(text), 'expected a worked example');
  });

  it('group: a jigsaw with different parts and random accountability', async () => {
    const a = await aiService.generateActivity({ ...req, activityType: 'group' } as AIRequest);
    const text = blob(a);
    assert.ok(/خبراء/.test(text), 'expected expert groups');
    assert.ok(/عشوائي/.test(text), 'expected random individual accountability');
    assert.ok(/مختلفة/.test(text), 'expected each member to hold a different part');
  });

  it('discussion: a claim, a vote and a re-vote — not group work', async () => {
    const a = await aiService.generateActivity({ ...req, activityType: 'discussion' } as AIRequest);
    const text = blob(a);
    assert.ok(/ادعاء/.test(text), 'expected a contestable claim');
    assert.ok(/تصويت/.test(text), 'expected a vote');
    assert.ok(/أوافق/.test(text), 'expected agree/disagree cards');
  });

  it('hands-on: physical materials and a measured-vs-computed comparison', async () => {
    const a = await aiService.generateActivity({ ...req, activityType: 'hands-on' } as AIRequest);
    const text = blob(a);
    assert.ok(/مسطرة|منقلة/.test(a.materials.join(' ')), `expected real equipment, got: ${a.materials.join(', ')}`);
    assert.ok(/قِس|قياس/.test(text), 'expected a measuring step');
    assert.ok(/الفرق/.test(text), 'expected students to reconcile measurement with the rule');
  });

  it('game: rules, rounds, scoring and a win condition', async () => {
    const a = await aiService.generateActivity({ ...req, activityType: 'game' } as AIRequest);
    const text = blob(a);
    assert.ok(/القواعد/.test(text), 'a game needs rules');
    assert.ok(/الجولة الأولى/.test(text) && /الجولة الثانية/.test(text), 'a game needs more than one round');
    assert.ok(/لوحة النتائج|النقاط/.test(text), 'a game needs scoring');
    assert.ok(/الفائز|فوز/.test(text), 'a game needs a win condition');
  });
});

describe('warm-up is not the lesson activity again', () => {
  const req = { grade: 'الصف العاشر', topic: 'قانون الجيوب', subject: 'الرياضيات', language: 'arabic' as const };

  it('has its own steps, materials and assessment', async () => {
    const warmup = await aiService.generateActivity({ ...req, duration: 8, activityVariant: 'warmup' } as AIRequest);
    const activity = await aiService.generateActivity({
      ...req, duration: 30, activityType: 'group', activityVariant: 'main', continueMathPractice: true,
    } as AIRequest);

    assert.notDeepEqual(warmup.steps.map(s => s.title), activity.steps.map(s => s.title));
    assert.notDeepEqual(warmup.materials, activity.materials);
    assert.notEqual(warmup.assessment, activity.assessment);
    assert.notEqual(warmup.teacherTips.join(), activity.teacherTips.join());
  });

  it('does not pose the same problems the activity then poses', async () => {
    const warmup = await aiService.generateActivity({ ...req, duration: 8, activityVariant: 'warmup' } as AIRequest);
    const activity = await aiService.generateActivity({
      ...req, duration: 30, activityType: 'group', activityVariant: 'main', continueMathPractice: true,
    } as AIRequest);

    const stems = (a: ActivityOutput) => a.steps.map(s => s.description).join('\n');
    // Every numeric problem the warm-up puts on the board should be gone by
    // the time the activity runs. Compare on the equations, not the prose.
    const nums = (text: string) => (text.match(/[a-z]\s*=\s*-?\d+(\.\d+)?/gi) ?? []);
    const warmNums = new Set(nums(stems(warmup)));
    const overlap = nums(stems(activity)).filter(n => warmNums.has(n));
    assert.equal(
      overlap.length, 0,
      `the activity re-posed the warm-up's problem values: ${[...new Set(overlap)].join(', ')}`,
    );
  });

  it('is short and its steps add up to its stated duration', async () => {
    const warmup = await aiService.generateActivity({ ...req, duration: 8, activityVariant: 'warmup' } as AIRequest);
    assert.equal(warmup.steps.length, 3, 'a warm-up is three steps, not a four-step lesson activity');
    assert.equal(warmup.totalDuration, 8);
  });
});

describe('step durations sum to the stated total', () => {
  // The old generator hard-coded 5 / stepDur / stepDur / 5, so a 10-minute
  // warm-up reported 10 while its steps summed to 20.
  for (const duration of [8, 10, 20, 30, 45, 60]) {
    it(`${duration} min: every format's steps sum to exactly ${duration}`, async () => {
      for (const type of [...TYPES, null]) {
        const a = await aiService.generateActivity({
          grade: 'الصف العاشر', topic: 'قانون الجيوب', subject: 'الرياضيات', language: 'arabic',
          duration,
          ...(type ? { activityType: type } : { activityVariant: 'warmup' as const }),
        } as AIRequest);
        const sum = a.steps.reduce((s, x) => s + x.durationMin, 0);
        assert.equal(sum, a.totalDuration, `${type ?? 'warmup'} @ ${duration}min: steps sum to ${sum}`);
        assert.equal(a.totalDuration, duration);
        assert.ok(a.steps.every(s => s.durationMin >= 1), 'no zero-length steps');
      }
    });
  }
});

describe('distributeMinutes', () => {
  it('always sums to the total, with whole minutes of at least 1', () => {
    for (let total = 6; total <= 90; total++) {
      for (const weights of [[1, 1, 1], [1.2, 1.8, 3, 1.3], [1, 2.4, 2.6, 1.2], [2, 2, 1], [1, 9]]) {
        const out = distributeMinutes(total, weights);
        assert.equal(out.length, weights.length);
        assert.equal(out.reduce((s, v) => s + v, 0), total, `total ${total}, weights ${weights}`);
        assert.ok(out.every(v => Number.isInteger(v) && v >= 1), `total ${total}: ${out}`);
      }
    }
  });

  it('never returns a step below one minute, even when the total is too small', () => {
    // Four steps cannot fit in one minute. The floor wins and the sum grows;
    // callers report the sum, so nothing claims a duration it does not have.
    const out = distributeMinutes(1, [1, 1, 1, 1]);
    assert.deepEqual(out, [1, 1, 1, 1]);
    assert.equal(distributeMinutes(2, [1, 2, 3]).reduce((s, v) => s + v, 0), 3);
  });
});

describe('blueprint registry', () => {
  it('covers every id it exports, in both languages', async () => {
    for (const id of ACTIVITY_BLUEPRINT_IDS) {
      for (const language of ['arabic', 'english'] as const) {
        const a = await aiService.generateActivity({
          grade: 'الصف العاشر', topic: 'قانون الجيوب', subject: 'الرياضيات', language,
          ...(id === 'warmup' ? { activityVariant: 'warmup' as const } : { activityType: id as any }),
        } as AIRequest);
        assert.ok(a.steps.length >= 3, `${id}/${language}: too few steps`);
        assert.ok(a.materials.length > 0, `${id}/${language}: no materials`);
        assert.ok(a.teacherTips.length >= 2, `${id}/${language}: too few tips`);
        assert.ok(a.assessment.length > 20, `${id}/${language}: no real assessment`);
      }
    }
  });
});
