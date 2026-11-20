/**
 * The new-evaluation picker offers a Grade 1 book only the types a six-year-old
 * can answer (swept 2026-11-13: it offered all eight, with short answer ticked).
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { selectionForGrade, typesOffered } from '../evaluationTypes.ts';
import type { QuestionType } from '../evaluations.ts';

const ALL: QuestionType[] = ['multiple_choice', 'true_false', 'matching', 'fill_blank', 'short_answer', 'open_ended', 'problem_solving', 'practical_task'];

describe('the evaluation types offered by grade', () => {
  it('Grade 1 is offered no written-answer type; other grades everything', () => {
    assert.deepEqual(typesOffered('grade-1', ALL), ['multiple_choice', 'true_false', 'matching', 'fill_blank', 'practical_task']);
    assert.deepEqual(typesOffered('grade-2', ALL), ALL);
    assert.deepEqual(typesOffered(undefined, ALL), ALL);
  });

  it('the default ticks (choice + short answer) become choice alone for Grade 1, and an all-written pick the Grade 1 default', () => {
    assert.deepEqual([...selectionForGrade('grade-1', new Set<QuestionType>(['multiple_choice', 'short_answer']))], ['multiple_choice']);
    assert.deepEqual([...selectionForGrade('grade-1', new Set<QuestionType>(['open_ended']))], ['multiple_choice', 'true_false']);
    assert.deepEqual([...selectionForGrade('grade-10', new Set<QuestionType>(['open_ended']))], ['open_ended']);
  });

  it('the screen lists and ticks through these functions', () => {
    const here = path.dirname(fileURLToPath(import.meta.url));
    const screen = readFileSync(path.join(here, '../../app/evaluations/new.tsx'), 'utf8');
    assert.match(screen, /typesOffered\(bookGradeId, ALL_TYPES\)\.map\(type =>/);
    assert.match(screen, /setSelectedTypes\(prev => selectionForGrade\(bookGradeId, prev\)\)/);
    assert.doesNotMatch(screen, /\{ALL_TYPES\.map\(/, 'the full list is never rendered directly');
  });
});
