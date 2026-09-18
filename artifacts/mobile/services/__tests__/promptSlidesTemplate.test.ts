/**
 * The deterministic Free-mode / offline-fallback deck builder.
 *
 * Run:
 *   node --experimental-strip-types --test \
 *     artifacts/mobile/services/__tests__/promptSlidesTemplate.test.ts
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { buildPromptSlidesTemplate } from '../promptSlidesTemplate.ts';
import type { PromptSlidesRequest } from '../ai/AIService.ts';

const baseReq: PromptSlidesRequest = {
  prompt: '6 slides on photosynthesis for grade 6, fun tone, 2 quiz questions',
  grade: 'Grade 6',
  subject: 'Science',
  language: 'english',
  mode: 'free',
};

describe('buildPromptSlidesTemplate — shape', () => {
  it('produces every field REQUIRED_FIELDS["prompt-slides"] needs on the server', () => {
    const deck = buildPromptSlidesTemplate(baseReq);
    assert.ok(deck.activityName.trim().length > 0);
    assert.ok(deck.slides.length > 0);
  });

  it('slide numbers are consecutive starting at 1', () => {
    const deck = buildPromptSlidesTemplate(baseReq);
    deck.slides.forEach((s, i) => assert.equal(s.slideNumber, i + 1));
  });

  it('opens with an intro slide and closes with a summary slide', () => {
    const deck = buildPromptSlidesTemplate(baseReq);
    assert.equal(deck.slides[0]!.type, 'intro');
    assert.equal(deck.slides[deck.slides.length - 1]!.type, 'summary');
  });

  it('never emits a slide type outside what presentation.tsx can render generically', () => {
    const deck = buildPromptSlidesTemplate(baseReq);
    const allowed = new Set(['intro', 'divider', 'challenge', 'question', 'summary', 'media']);
    for (const s of deck.slides) assert.ok(allowed.has(s.type), `unexpected slide type "${s.type}"`);
  });
});

describe('buildPromptSlidesTemplate — slide count', () => {
  it('honours a requested slide count within the min/max clamp', () => {
    const deck = buildPromptSlidesTemplate({ ...baseReq, slideCount: 8 });
    assert.equal(deck.slides.length, 8);
  });

  it('falls back to a sensible default when no count is given', () => {
    const deck = buildPromptSlidesTemplate({ ...baseReq, slideCount: undefined });
    assert.ok(deck.slides.length >= 3 && deck.slides.length <= 20);
  });

  it('clamps an out-of-range request into [3, 20]', () => {
    const tooFew = buildPromptSlidesTemplate({ ...baseReq, slideCount: 1 });
    assert.ok(tooFew.slides.length >= 3);
    const tooMany = buildPromptSlidesTemplate({ ...baseReq, slideCount: 500 });
    assert.ok(tooMany.slides.length <= 20);
  });
});

describe('buildPromptSlidesTemplate — question slides', () => {
  it('adds a valid question slide when the prompt asks for one', () => {
    const deck = buildPromptSlidesTemplate({ ...baseReq, prompt: 'a deck with a quiz question at the end' });
    const q = deck.slides.find(s => s.type === 'question');
    assert.ok(q, 'expected a question slide');
    assert.equal(q!.options?.length, 4);
    assert.ok(q!.correctIndex !== undefined && q!.correctIndex >= 0 && q!.correctIndex < 4);
  });

  it('adds no question slide when the prompt does not ask for one', () => {
    const deck = buildPromptSlidesTemplate({ ...baseReq, prompt: 'a simple deck about clouds' });
    assert.ok(!deck.slides.some(s => s.type === 'question'));
  });
});

describe('buildPromptSlidesTemplate — language', () => {
  it('renders Arabic text for an Arabic request', () => {
    const deck = buildPromptSlidesTemplate({ ...baseReq, language: 'arabic', grade: 'السادس', subject: 'العلوم' });
    assert.match(deck.slides[0]!.content, /[؀-ۿ]/);
  });
});
