// Pins the geometry of the tour overlay: the hole in the dim layer, where the
// card goes, and the line between them. Pure numbers, so no screen is needed.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HOLE_PAD, centerCard, connectorFor, holeFor, holeRadius, placeCard, scrimPath } from '../tourPlacement.ts';

const screen = { width: 400, height: 800 };
const card = { width: 320, height: 160 };

test('the hole is the target grown by the padding', () => {
  assert.deepEqual(holeFor({ x: 100, y: 300, width: 80, height: 50 }, screen), {
    x: 100 - HOLE_PAD,
    y: 300 - HOLE_PAD,
    width: 80 + 2 * HOLE_PAD,
    height: 50 + 2 * HOLE_PAD,
  });
});

test('the hole never leaves the screen: a target at an edge is trimmed, not pushed off', () => {
  const h = holeFor({ x: 0, y: 0, width: 400, height: 84 }, screen);
  assert.deepEqual(h, { x: 0, y: 0, width: 400, height: 84 + HOLE_PAD });
  const bottom = holeFor({ x: 10, y: 730, width: 380, height: 70 }, screen);
  assert.equal(bottom.y + bottom.height, 800);
});

test('the corner radius is rounded but never more than half the hole', () => {
  assert.equal(holeRadius({ x: 0, y: 0, width: 200, height: 100 }), 16);
  assert.equal(holeRadius({ x: 0, y: 0, width: 24, height: 24 }), 12);
});

test('the scrim is the whole screen with the hole cut out: one path, drawn even-odd', () => {
  const d = scrimPath(screen, { x: 100, y: 200, width: 80, height: 60 }, 16);
  assert.ok(d.startsWith('M0 0H400V800H0Z'), d);
  assert.ok(d.includes('M116 200'), 'hole starts after its left corner radius');
  assert.equal((d.match(/Z/g) ?? []).length, 2, 'outer rectangle and hole');
});

test('the card goes below a target in the top half, and above one near the bottom', () => {
  const top = placeCard({ x: 20, y: 100, width: 100, height: 60 }, screen, card);
  assert.equal(top.side, 'below');
  assert.equal(top.top, 100 + 60 + 16);

  const bottom = placeCard({ x: 20, y: 700, width: 100, height: 60 }, screen, card);
  assert.equal(bottom.side, 'above');
  assert.equal(bottom.top, 700 - 16 - card.height);
});

test('the card stays inside the screen horizontally, centred on the target when there is room', () => {
  const mid = placeCard({ x: 150, y: 100, width: 100, height: 60 }, screen, card);
  assert.equal(mid.left, 200 - card.width / 2);
  const left = placeCard({ x: 0, y: 100, width: 40, height: 60 }, screen, card);
  assert.equal(left.left, 16);
  const right = placeCard({ x: 360, y: 100, width: 40, height: 60 }, screen, card);
  assert.equal(right.left, 400 - 16 - card.width);
});

test('a target too tall to fit the card above or below docks the card at the far edge', () => {
  const tall = { x: 16, y: 100, width: 368, height: 560 };
  const upper = placeCard(tall, screen, card);
  assert.equal(upper.side, 'dock');
  assert.equal(upper.top, 800 - 16 - card.height, 'hole is centred high, so the card docks at the bottom');
  const low = placeCard({ x: 16, y: 160, width: 368, height: 620 }, screen, card);
  assert.equal(low.side, 'dock');
  assert.equal(low.top, 16, 'hole sits low, so the card docks at the top');
});

test('a narrow target at a side edge (a desktop sidebar row) gets the card beside it, not over the rows below', () => {
  const wide = { width: 1280, height: 720 };
  const big = { width: 360, height: 250 };
  const left = placeCard({ x: 4, y: 122, width: 231, height: 64 }, wide, big);
  assert.equal(left.side, 'right');
  assert.equal(left.left, 4 + 231 + 16);
  assert.equal(left.top, 122 + 32 - 125, 'centred on the row');

  // The same row on the right edge (RTL): there is no room on its right, so the card goes to its left.
  const rtl = placeCard({ x: 1045, y: 122, width: 231, height: 64 }, wide, big);
  assert.equal(rtl.side, 'left');
  assert.equal(rtl.left, 1045 - 16 - 360);
  assert.equal(rtl.top, 29);
});

test('beside placement stays inside the screen vertically', () => {
  const wide = { width: 1280, height: 720 };
  const big = { width: 360, height: 250 };
  const nearTop = placeCard({ x: 4, y: 20, width: 231, height: 64 }, wide, big);
  assert.equal(nearTop.side, 'right');
  assert.equal(nearTop.top, 16);
  const nearBottom = placeCard({ x: 4, y: 560, width: 231, height: 64 }, wide, big);
  assert.equal(nearBottom.side, 'right');
  assert.equal(nearBottom.top, 720 - 16 - 250);
});

test('beside placement is only for narrow targets at a side edge, never a bottom tab or a wide band', () => {
  const wide = { width: 1280, height: 720 };
  const big = { width: 360, height: 250 };
  // A tab at the bottom-left of a wide window: above it, as on a phone.
  assert.equal(placeCard({ x: 0, y: 620, width: 100, height: 100 }, wide, big).side, 'above');
  // A wide header band: below it.
  assert.equal(placeCard({ x: 256, y: 6, width: 1008, height: 169 }, wide, big).side, 'below');
  // A narrow target in the middle of the screen, away from both edges: above or below, as before.
  assert.equal(placeCard({ x: 600, y: 100, width: 100, height: 60 }, wide, big).side, 'below');
});

test('a phone never gets a beside placement: the card is as wide as the screen', () => {
  const p = placeCard({ x: 0, y: 100, width: 100, height: 60 }, screen, card);
  assert.equal(p.side, 'below');
});

test('the connector for a beside placement is a horizontal line to the card’s edge', () => {
  const wide = { width: 1280, height: 720 };
  const big = { width: 360, height: 250 };
  const hole = { x: 4, y: 122, width: 231, height: 64 };
  const p = placeCard(hole, wide, big);
  assert.deepEqual(connectorFor(hole, p, big), { x1: 235, y1: 154, x2: p.left, y2: 154 });

  const rtlHole = { x: 1045, y: 122, width: 231, height: 64 };
  const q = placeCard(rtlHole, wide, big);
  assert.deepEqual(connectorFor(rtlHole, q, big), { x1: 1045, y1: 154, x2: q.left + big.width, y2: 154 });
});

test('the welcome card is centred on the screen', () => {
  assert.deepEqual(centerCard(screen, card), { top: 320, left: 40 });
});

test('a card taller or wider than the screen is pinned to the margin, never placed off-screen', () => {
  // Large accessibility text can make the card outgrow a small phone; a negative
  // top would put its Skip button above the screen with no way to reach it.
  const tall = { width: 320, height: 900 };
  assert.deepEqual(centerCard(screen, tall), { top: 16, left: 40 });
  assert.deepEqual(centerCard(screen, { width: 500, height: 100 }), { top: 350, left: 16 });
  const docked = placeCard({ x: 16, y: 100, width: 368, height: 560 }, screen, tall);
  assert.equal(docked.side, 'dock');
  assert.equal(docked.top, 16);
});

test('a target wholly off the screen has no hole, rather than a negative one', () => {
  const off = holeFor({ x: 500, y: 100, width: 50, height: 50 }, screen);
  assert.equal(off.width, 0);
  assert.ok(off.height > 0);
  const below = holeFor({ x: 10, y: 900, width: 50, height: 50 }, screen);
  assert.equal(below.height, 0);
  assert.ok(off.width >= 0 && below.width >= 0);
});

test('the connector joins the hole to the card edge that faces it', () => {
  const hole = { x: 140, y: 100, width: 120, height: 60 };
  const below = placeCard(hole, screen, card);
  assert.deepEqual(connectorFor(hole, below, card), { x1: 200, y1: 160, x2: 200, y2: below.top });

  const bottomHole = { x: 140, y: 700, width: 120, height: 60 };
  const above = placeCard(bottomHole, screen, card);
  assert.deepEqual(connectorFor(bottomHole, above, card), { x1: 200, y1: 700, x2: 200, y2: above.top + card.height });
});

test('the connector lands on the card even when the target is far to one side', () => {
  const hole = { x: 0, y: 100, width: 40, height: 60 };
  const p = placeCard(hole, screen, card);
  const c = connectorFor(hole, p, card)!;
  assert.ok(c.x2 >= p.left && c.x2 <= p.left + card.width);
});

test('a docked card has no connector — it overlaps the hole', () => {
  const hole = { x: 16, y: 120, width: 368, height: 560 };
  assert.equal(connectorFor(hole, placeCard(hole, screen, card), card), null);
});
