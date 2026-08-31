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

  it('leaves a board-only room the materials the generator wrote it', () => {
    // Board is what these activities were authored for, so "no screen" must
    // never quietly drop something the teacher is about to need. Nothing in
    // this list is about a projector, so nothing moves.
    assert.deepEqual(applyClassroomSetup(boardActivity, 'board', true), boardActivity);
  });

  it('does not hand a board-only room a projector', () => {
    // quick-check's own materials name «شاشة عرض» because the activity was
    // written screen-first. A teacher who just answered «سبورة فقط» and is
    // then told to bring a projector has been shown a setting that did
    // nothing — which is what board mode did before this.
    const quick = {
      activityType: 'quick-check',
      materials: ['شاشة عرض', 'ألواح صغيرة (اختياري)'],
      teacherPreparation: 'اعرض السؤال، شغّل المؤقت.',
    };
    const out = applyClassroomSetup(quick, 'board', true);
    assert.ok(!out.materials.some(m => m.includes('شاشة')), 'the projector line goes');
    assert.ok(out.materials.some(m => m.includes('السبورة')), 'the board takes its place');
    // The student mini-whiteboards are not a projector and must survive.
    assert.ok(out.materials.some(m => m.includes('ألواح صغيرة')));
  });

  it('keeps a mini-whiteboard line that happens to name a screen', () => {
    const withMini = {
      activityType: 'quick-check',
      materials: ['Projector', 'Mini whiteboards (screen optional)'],
      teacherPreparation: '',
    };
    const out = applyClassroomSetup(withMini, 'board', false);
    assert.ok(out.materials.some(m => m.startsWith('Mini whiteboards')));
    assert.ok(!out.materials.includes('Projector'));
    // Mini whiteboards are what students hold up, not the class board, so the
    // class board still has to be named.
    assert.ok(out.materials.some(m => m === 'Whiteboard'));
  });

  it('stops telling a board-only class to watch the screen', () => {
    const deck = {
      activityType: 'escape-challenge',
      materials: ['السبورة'],
      teacherPreparation: '',
      slides: [
        { type: 'intro', content: 'لكل تحدٍّ وقت محدّد يظهر على الشاشة.' },
        { type: 'challenge', content: 'حلّ المعادلة على الشاشة' },
      ],
    };
    const out = applyClassroomSetup(deck, 'board', true);
    assert.ok(!out.slides[0].content.includes('الشاشة'));
    assert.ok(out.slides[0].content.includes('يعلنه معلّمك'));
    // Only intro slides are restaged. A challenge slide carries the maths,
    // and rewriting that would be editing content, not staging.
    assert.equal(out.slides[1].content, deck.slides[1].content);
  });

  it('leaves a projector deck\'s slides alone', () => {
    const deck = {
      activityType: 'escape-challenge',
      materials: [],
      teacherPreparation: '',
      slides: [{ type: 'intro', content: 'وقت محدّد يظهر على الشاشة.' }],
    };
    assert.equal(
      applyClassroomSetup(deck, 'screen', true).slides[0].content,
      deck.slides[0].content,
    );
  });

  it('stops asking a projector room to print what the slides already show', () => {
    const out = applyClassroomSetup(boardActivity, 'screen', true);
    assert.ok(!out.materials.some(m => m.includes('المطبوعة')));
    assert.ok(out.materials.some(m => m.includes('بروجكتر')));
    assert.ok(!out.teacherPreparation.startsWith('اطبع'));
  });

  it('adds the projector to an activity it has no override for', () => {
    // gallery-walk is the deliberate case: five sheets taped to the walls are
    // the activity, and a projector replaces none of them.
    const gallery = {
      activityType: 'gallery-walk',
      materials: ['5 أوراق كبيرة مثبّتة على الجدران', 'أقلام ملونة'],
      teacherPreparation: 'اكتب مسألة مختلفة على كل ورقة كبيرة.',
    };
    const out = applyClassroomSetup(gallery, 'screen', true);
    assert.ok(out.materials.some(m => m.includes('أوراق كبيرة')));
    assert.equal(out.materials.length, 3);
    assert.equal(out.teacherPreparation, gallery.teacherPreparation);
  });

  it('keeps the artifact each student writes on, and drops the rest', () => {
    // The trap this table exists to avoid: "strip anything printed" would
    // take the bingo card each student marks and the slip each student hands
    // in at the door, neither of which a projector replaces.
    const bingo = applyClassroomSetup(
      { activityType: 'bingo', materials: ['x'], teacherPreparation: 'اطبع' },
      'screen', true,
    );
    assert.ok(bingo.materials.some(m => m.includes('بينجو')), 'the card stays');
    assert.ok(!bingo.materials.some(m => m.includes('مؤقت')), 'the deck runs the timer');

    const exit = applyClassroomSetup(
      { activityType: 'exit-ticket', materials: ['x'], teacherPreparation: 'اطبع' },
      'screen', true,
    );
    assert.ok(exit.materials.some(m => m.includes('ورقة صغيرة')), 'the slip stays');
    assert.ok(!exit.materials.some(m => m.includes('مطبوعة')), 'nothing to print');

    const relay = applyClassroomSetup(
      { activityType: 'relay', materials: ['x'], teacherPreparation: 'اطبع' },
      'screen', true,
    );
    assert.ok(relay.materials.some(m => m.includes('ورقة تتابع')), 'the relay sheet stays');
    assert.ok(!relay.materials.some(m => m.includes('السبورة')));
  });

  it('gives every screen override a projector line and both languages', () => {
    for (const type of ['escape-challenge', 'error-detective', 'bingo', 'relay', 'exit-ticket']) {
      for (const isAr of [true, false]) {
        const out = applyClassroomSetup(
          { activityType: type, materials: [], teacherPreparation: '' },
          'screen', isAr,
        );
        assert.ok(out.materials.length > 0, `${type} ${isAr} has materials`);
        assert.ok(
          out.materials.some(m => /بروجكتر|Projector/.test(m)),
          `${type} ${isAr} names the projector`,
        );
        assert.ok(out.teacherPreparation.length > 0, `${type} ${isAr} has prep`);
      }
    }
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
