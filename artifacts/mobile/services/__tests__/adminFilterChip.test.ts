/**
 * The admin filter chips («اليوم», «هذا الشهر», «تطبيق»…) keep their label on one line.
 *
 * Android measured «هذا الشهر» as one line and drew it wrapped, so the chip's one-line
 * height cut «الشهر» off. It was "fixed" once with greedy line breaking alone and was
 * still clipped on a phone, so this pins the part that cannot wrap: `numberOfLines={1}`,
 * with `clip` rather than an ellipsis. The runner cannot render React Native, so it
 * reads the source, as generatorScreens.test.ts does.
 *
 * Run:
 *   node --import ./scripts/registerTestAlias.mjs --experimental-strip-types --test \
 *     services/__tests__/adminFilterChip.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

const src = readFileSync(join(import.meta.dirname, '..', '..', 'components', 'admin', 'widgets.tsx'), 'utf8');

describe('FilterChip label', () => {
  const body = src.slice(src.indexOf('export function FilterChip'), src.indexOf('export function DayBars'));

  it('is found', () => {
    assert.ok(body.length > 0 && body.includes('{label}'), 'FilterChip moved or was renamed — update this test');
  });

  it('cannot wrap: one line, clipped not ellipsised', () => {
    const text = body.match(/<Text\b[^>]*>\{label\}<\/Text>/)?.[0] ?? '';
    assert.match(text, /numberOfLines=\{1\}/);
    assert.match(text, /ellipsizeMode="clip"/);
  });
});
