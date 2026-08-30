/**
 * Classroom routing tests — index → builder param handoff.
 *
 * Imports the real production helpers from classroomRouting.ts so any
 * regression in the production code will break these tests.
 *
 *   node --experimental-strip-types --test \
 *     services/__tests__/classroomRouting.test.ts
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  ACTIVITY_CARDS,
  applyClassroomSetup,
  buildBuilderRoute,
  resolveActivityType,
} from '../classroomRouting.ts';
import translations, { getT } from '../i18n.ts';

// ─── 1. ACTIVITY_CARDS data integrity ────────────────────────────────────────

describe('ACTIVITY_CARDS — data integrity', () => {
  it('every card has a non-empty id', () => {
    for (const card of ACTIVITY_CARDS) {
      assert.ok(card.id.length > 0, `card.id must be non-empty (got "${card.id}")`);
    }
  });

  it('available cards have non-empty duration, groupType and difficulty', () => {
    for (const card of ACTIVITY_CARDS.filter(c => c.available)) {
      assert.ok(card.duration.length > 0, `${card.id}: duration must be non-empty`);
      assert.ok(card.groupType.length > 0, `${card.id}: groupType must be non-empty`);
      assert.ok(card.difficulty.length > 0, `${card.id}: difficulty must be non-empty`);
    }
  });

  it('escape-challenge is the first available card (default fallback target)', () => {
    const first = ACTIVITY_CARDS[0];
    assert.equal(first.id, 'escape-challenge');
    assert.equal(first.available, true);
  });

  it('exactly one card is featured (the hub renders find(isFeatured) as its single hero card)', () => {
    const featured = ACTIVITY_CARDS.filter(c => c.isFeatured);
    assert.equal(featured.length, 1, `expected exactly one featured card, got ${featured.map(c => c.id)}`);
  });

  it('every card resolves to a non-empty title and description in both languages', () => {
    for (const lang of ['ar', 'en'] as const) {
      const t = getT(lang);
      for (const card of ACTIVITY_CARDS) {
        assert.ok(t(card.titleKey as any).trim().length > 0, `${lang}.${card.id}.titleKey rendered empty`);
        assert.ok(t(card.descKey as any).trim().length > 0, `${lang}.${card.id}.descKey rendered empty`);
      }
    }
  });

  it('every titleKey/descKey is a real translation key in both languages', () => {
    for (const card of ACTIVITY_CARDS) {
      assert.ok(card.titleKey in translations.en, `${card.titleKey} is not an English translation key`);
      assert.ok(card.titleKey in translations.ar, `${card.titleKey} is missing from Arabic`);
      assert.ok(card.descKey in translations.en, `${card.descKey} is not an English translation key`);
      assert.ok(card.descKey in translations.ar, `${card.descKey} is missing from Arabic`);
    }
  });

  // Cross-referenced against src/lib/__tests__/classroomPrompts.test.ts on the
  // api-server side — both lists must carry the same 7 ids so a new format
  // can't be added to one side without the other going stale again.
  it('pins the exact set of card ids (keep in sync with the server prompt builder)', () => {
    const ids = ACTIVITY_CARDS.map(c => c.id).sort();
    assert.deepEqual(ids, [
      'bingo', 'error-detective', 'escape-challenge', 'exit-ticket',
      'gallery-walk', 'quick-check', 'relay',
    ]);
  });
});

// ─── 2. buildBuilderRoute — index → builder navigation ───────────────────────

describe('buildBuilderRoute() — classroom index → builder param handoff', () => {
  it('routes to the correct builder pathname', () => {
    const card = ACTIVITY_CARDS[0];
    const route = buildBuilderRoute(card);
    assert.equal(route.pathname, '/ai-tools/classroom/builder');
  });

  it('sets activityType param equal to the card id for every available card', () => {
    const availableCards = ACTIVITY_CARDS.filter(c => c.available);
    assert.ok(availableCards.length > 0, 'there must be at least one available card');

    for (const card of availableCards) {
      const route = buildBuilderRoute(card);
      assert.equal(
        route.params.activityType,
        card.id,
        `card "${card.id}" → activityType param must equal card.id`,
      );
    }
  });

  it('escape-challenge card produces activityType "escape-challenge"', () => {
    const card = ACTIVITY_CARDS.find(c => c.id === 'escape-challenge')!;
    assert.ok(card, 'escape-challenge card must exist');
    const route = buildBuilderRoute(card);
    assert.equal(route.params.activityType, 'escape-challenge');
  });

  it('bingo card produces activityType "bingo"', () => {
    const card = ACTIVITY_CARDS.find(c => c.id === 'bingo')!;
    assert.ok(card, 'bingo card must exist');
    const route = buildBuilderRoute(card);
    assert.equal(route.params.activityType, 'bingo');
  });

  it('relay card produces activityType "relay"', () => {
    const card = ACTIVITY_CARDS.find(c => c.id === 'relay')!;
    assert.ok(card, 'relay card must exist');
    const route = buildBuilderRoute(card);
    assert.equal(route.params.activityType, 'relay');
  });

  it('route shape contains pathname and params keys only', () => {
    const route = buildBuilderRoute(ACTIVITY_CARDS[0]);
    assert.ok('pathname' in route);
    assert.ok('params' in route);
    assert.ok('activityType' in route.params);
  });
});

// ─── 3. resolveActivityType — builder param → aiService call ─────────────────

describe('resolveActivityType() — builder forwards activityType to AI service', () => {
  it('returns the activityType from route params when present', () => {
    assert.equal(resolveActivityType({ activityType: 'bingo' }), 'bingo');
    assert.equal(resolveActivityType({ activityType: 'relay' }), 'relay');
    assert.equal(resolveActivityType({ activityType: 'escape-challenge' }), 'escape-challenge');
  });

  it('defaults to "escape-challenge" when params.activityType is undefined', () => {
    assert.equal(resolveActivityType({}), 'escape-challenge');
    assert.equal(resolveActivityType({ activityType: undefined }), 'escape-challenge');
  });

  it('round-trips: every available card id survives the full index → builder path', () => {
    // Simulates selecting a card on the index (buildBuilderRoute) and then
    // reading the param in the builder (resolveActivityType).
    for (const card of ACTIVITY_CARDS.filter(c => c.available)) {
      const route = buildBuilderRoute(card);
      const resolved = resolveActivityType(route.params);
      assert.equal(
        resolved,
        card.id,
        `card "${card.id}" must survive index → builder round-trip`,
      );
    }
  });

  it('fallback "escape-challenge" matches the first card id (consistency check)', () => {
    // The default fallback in the builder should match the first card on the index
    // so that a missing param silently produces a valid activity type.
    const fallback = resolveActivityType({});
    const firstAvailable = ACTIVITY_CARDS.find(c => c.available)!;
    assert.equal(fallback, firstAvailable.id);
  });
});

// ─── 4. Screen vs board setup ────────────────────────────────────────────────

describe('applyClassroomSetup', () => {
  const boardActivity = {
    activityType: 'error-detective',
    materials: ['السبورة', 'بطاقات الحلول الخاطئة المطبوعة', 'أقلام تصحيح حمراء'],
    teacherPreparation: 'اطبع 3 حلول خاطئة مسبقًا. اطلب من الطلاب العمل في ثنائيات.',
  };

  it('survives a generation that omitted materials entirely', () => {
    // `materials` is model output, and the server's usability check requires
    // only activityName + slides — so a deck can arrive without it. This used
    // to reach `.some` on undefined and throw, and the builder reports any
    // throw as «تعذر إتمام العملية»: a complete, usable deck thrown away on
    // its way to the projector over a field nobody was going to read.
    const noMaterials = {
      activityType: 'escape-challenge',
      teacherPreparation: 'رتّب الطلاب في مجموعات.',
    } as unknown as typeof boardActivity;

    const out = applyClassroomSetup(noMaterials, 'screen', true);
    assert.ok(Array.isArray(out.materials), 'materials must come back a list');
    assert.ok(out.materials.length > 0, 'the projector line is still added');
  });

  it('leaves a board-only room exactly as the generator wrote it', () => {
    // Board is what these activities were authored for, so "no screen" must
    // never quietly drop something the teacher is about to need.
    assert.deepEqual(applyClassroomSetup(boardActivity, 'board', true), boardActivity);
  });

  it('stops asking a projector room to print what the slides already show', () => {
    const out = applyClassroomSetup(boardActivity, 'screen', true);
    assert.ok(!out.materials.some(m => m.includes('المطبوعة')));
    assert.ok(out.materials.some(m => m.includes('بروجكتر')));
    assert.ok(!out.teacherPreparation.startsWith('اطبع'));
  });

  it('adds the projector to an activity it has no override for', () => {
    const bingo = {
      activityType: 'bingo',
      materials: ['بطاقات بينجو مطبوعة (بطاقة لكل طالب)', 'مؤقت'],
      teacherPreparation: 'اطبع بطاقات بينجو مختلفة لكل طالب.',
    };
    const out = applyClassroomSetup(bingo, 'screen', true);
    // The per-student card is not something a screen replaces — it stays.
    assert.ok(out.materials.some(m => m.includes('بينجو')));
    assert.equal(out.materials.length, 3);
    assert.equal(out.teacherPreparation, bingo.teacherPreparation);
  });

  it('does not add a second projector line to a list that names one', () => {
    const quick = {
      activityType: 'quick-check',
      materials: ['ألواح صغيرة وأقلام', 'شاشة عرض'],
      teacherPreparation: '',
    };
    assert.deepEqual(applyClassroomSetup(quick, 'screen', true).materials, quick.materials);
  });
});
