/**
 * Empty-topic guard tests
 * Confirms validateTopic blocks generation for blank/whitespace-only topics
 * and allows it for any topic with real content.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { validateTopic } from '../validation.ts';

describe('validateTopic — empty topic guard', () => {
  // ── should block generation ──────────────────────────────────────────
  it('returns false for an empty string', () => {
    assert.equal(validateTopic(''), false);
  });

  it('returns false for a string of only spaces', () => {
    assert.equal(validateTopic('   '), false);
  });

  it('returns false for a string of only tabs and newlines', () => {
    assert.equal(validateTopic('\t\n\r'), false);
  });

  it('returns false for a non-breaking space (\\u00A0)', () => {
    assert.equal(validateTopic('\u00A0'), false);
  });

  // ── should allow generation ──────────────────────────────────────────
  it('returns true for a plain English topic', () => {
    assert.equal(validateTopic('Quadratic Equations'), true);
  });

  it('returns true for an Arabic topic', () => {
    assert.equal(validateTopic('المعادلات التربيعية'), true);
  });

  it('returns true when topic has leading/trailing whitespace', () => {
    assert.equal(validateTopic('  Mole Concept  '), true);
  });

  it('returns true for a single non-whitespace character', () => {
    assert.equal(validateTopic('x'), true);
  });
});
