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
  buildBuilderRoute,
  resolveActivityType,
} from '../classroomRouting.ts';

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
