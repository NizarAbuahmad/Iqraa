/**
 * Regenerate must hand back something different offline too.
 *
 * `MockAIService.generateActivity` never read `regenerate`. The maths and
 * chemistry banks draw their items at random, so those subjects varied by
 * accident; every other subject — Arabic, English, Islamic, history, biology,
 * a topic the book does not hold — has no bank, the blueprints contain no
 * randomness, and «إعادة التوليد» returned a byte-identical activity. With
 * `DEMO_MODE` on, that is the only path.
 *
 * Without a bank the variation has to come from the slots a blueprint fills
 * from the lesson: which key concepts lead, which wording the retrieval prompt,
 * the claim, the game questions and the jigsaw parts use. A first generation is
 * unchanged (variant 0 is today's text, to the character); each Regenerate for
 * the same lesson and format moves to the next variant.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { aiService, buildOfflineActivity, nextActivityVariant } from '@/services/ai/generators.ts';
import { buildActivityBlueprint, type ActivityBlueprintContext } from '@/services/ai/activityBlueprints.ts';
import type { ActivityOutput, AIRequest } from '@/services/ai/AIService.ts';

const TYPES = ['individual', 'group', 'discussion', 'hands-on', 'game'] as const;

/** Subjects with no bank, grounded and not, in both languages. */
const CASES: Array<{ label: string; req: Partial<AIRequest> }> = [
  { label: 'english lesson, grounded (ar)', req: { topic: 'الكتابة: تدوينة', subject: 'English', language: 'arabic', lessonId: 'kbl-eng-s1-nccd-u2_l7' } },
  { label: 'biology lesson, grounded (ar)', req: { topic: 'تطور الكائنات الحية', subject: 'Biology', language: 'arabic', lessonId: 'kbl-biology-s1-nccd-u1_l1' } },
  { label: 'arabic lesson with no concepts (ar)', req: { topic: 'الجملة الاسمية', subject: 'Arabic', language: 'arabic' } },
  { label: 'a topic the book does not hold (en)', req: { topic: 'Persuasive writing', subject: 'English', language: 'english' } },
];

const request = (c: typeof CASES[number], type: string, extra: Partial<AIRequest> = {}) =>
  ({ grade: 'الصف العاشر', duration: 30, activityType: type, ...c.req, ...extra }) as AIRequest;
const json = (a: ActivityOutput) => JSON.stringify(a);

describe('the offline builder: a variant is a different activity, variant 0 is the first', () => {
  for (const c of CASES) {
    for (const type of [...TYPES, 'warmup'] as const) {
      it(`${c.label} / ${type}: every variant differs from the one before it`, () => {
        const extra = type === 'warmup' ? { activityVariant: 'warmup' as const, duration: 8 } : {};
        const req = request(c, type === 'warmup' ? 'group' : type, extra);
        for (let v = 0; v < 12; v++) {
          assert.notEqual(
            json(buildOfflineActivity(req, v)), json(buildOfflineActivity(req, v + 1)),
            `variant ${v + 1} repeats variant ${v}`,
          );
        }
      });
    }

    it(`${c.label}: variant 0 is what a first generation always was`, () => {
      for (const type of TYPES) {
        assert.equal(json(buildOfflineActivity(request(c, type))), json(buildOfflineActivity(request(c, type), 0)), type);
      }
    });

    it(`${c.label}: every variant is still a sound activity`, () => {
      for (const type of TYPES) {
        for (let v = 0; v < 10; v++) {
          const a = buildOfflineActivity(request(c, type), v);
          assert.equal(a.steps.reduce((s, x) => s + x.durationMin, 0), a.totalDuration, `${type} v${v}`);
          assert.ok(!json(a).includes('**'), `${type} v${v} has markdown`);
          assert.equal(a.activityType, type);
          if (type === 'group') {
            const tasks = a.steps[0]!.description.split('\n').filter(l => /^[1-4]\. \S/.test(l));
            assert.equal(tasks.length, 4, `jigsaw v${v}`);
          }
        }
      }
    });
  }
});

describe('nextActivityVariant — which version a request gets', () => {
  const c = CASES[2]!;
  const plain = (type = 'game') => request(c, type);
  const again = (type = 'game') => request(c, type, { regenerate: true });

  it('a plain request is the first version', () => {
    assert.equal(nextActivityVariant(plain()), 0);
    assert.equal(nextActivityVariant(plain()), 0);
  });

  it('each Regenerate for the same lesson and format moves one on', () => {
    nextActivityVariant(plain());
    assert.deepEqual([1, 2, 3, 4].map(() => nextActivityVariant(again())), [1, 2, 3, 4]);
  });

  it('a plain request after a regeneration starts over', () => {
    nextActivityVariant(again());
    nextActivityVariant(again());
    assert.equal(nextActivityVariant(plain()), 0);
    assert.equal(nextActivityVariant(again()), 1);
  });

  it('another format, another lesson and another language each keep their own count', () => {
    nextActivityVariant(plain('game'));
    nextActivityVariant(again('game'));
    nextActivityVariant(again('game'));
    assert.equal(nextActivityVariant(again('group')), 1);
    assert.equal(nextActivityVariant(again('hands-on')), 1);
    assert.equal(nextActivityVariant(request(CASES[3]!, 'game', { regenerate: true })), 1);
    assert.equal(nextActivityVariant(again('game')), 3);
  });

  it('the warm-up counts separately from the main activity of the same type', () => {
    nextActivityVariant(again('group'));
    assert.equal(nextActivityVariant(request(c, 'group', { activityVariant: 'warmup', regenerate: true })), 1);
  });

  it('the lesson id, not just the title, tells two lessons apart', () => {
    const a = { topic: 'مقدمة', subject: 'Arabic', language: 'arabic', activityType: 'game', lessonId: 'lesson-a' } as AIRequest;
    const b = { ...a, lessonId: 'lesson-b' } as AIRequest;
    nextActivityVariant(a); nextActivityVariant(b);
    nextActivityVariant({ ...a, regenerate: true });
    assert.equal(nextActivityVariant({ ...b, regenerate: true }), 1);
  });
});

describe('through the service — a pressed Regenerate really returns something else', () => {
  it('a subject with no bank: first, regenerated, regenerated again, then back to the first on a plain request', async () => {
    const c = CASES[2]!;
    const req = request(c, 'game');
    const first = await aiService.generateActivity(req);
    const second = await aiService.generateActivity({ ...req, regenerate: true });
    const third = await aiService.generateActivity({ ...req, regenerate: true });
    assert.notEqual(json(second), json(first));
    assert.notEqual(json(third), json(second));
    assert.equal(json(await aiService.generateActivity(req)), json(first));
  });
});

describe('the blueprint takes a variant', () => {
  const ctx = (variant: number | undefined, over: Partial<ActivityBlueprintContext> = {}): ActivityBlueprintContext => ({
    topic: 'الموضوع', lang: 'ar', math: false, practice: [], kb: null, duration: 30, variant, ...over,
  });

  it('variant 0 and an absent variant are the same activity', () => {
    for (const lang of ['ar', 'en'] as const) {
      for (const type of ['individual', 'group', 'discussion', 'hands-on', 'game', 'warmup']) {
        assert.deepEqual(
          buildActivityBlueprint(type, ctx(0, { lang })),
          buildActivityBlueprint(type, ctx(undefined, { lang })),
          `${lang} ${type}`,
        );
      }
    }
  });

  it('adjacent variants differ for every format, in both languages, with no lesson at all', () => {
    for (const lang of ['ar', 'en'] as const) {
      for (const type of ['individual', 'group', 'discussion', 'hands-on', 'game', 'warmup']) {
        for (let v = 0; v < 8; v++) {
          assert.notDeepEqual(
            buildActivityBlueprint(type, ctx(v, { lang })),
            buildActivityBlueprint(type, ctx(v + 1, { lang })),
            `${lang} ${type}: variant ${v} and ${v + 1} are the same`,
          );
        }
      }
    }
  });
});
