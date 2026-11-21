import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { resolveGeneratorGrounding, unitThemeLine } from '../kbContext.ts';
import { resolveScopeGrounding } from '../scopeGrounding.ts';
import { getLessonsForUnit, getUnitsForSubjectGrade } from '../knowledgeBase.ts';

// A teacher reported a Grade 5 English quiz for «هيا نستكشف!» (Let's Explore!)
// as not matching the lesson: the model got only the title and a grammar point
// and wrote about explorers and compasses. The unit is about SPACE.
const unit = getUnitsForSubjectGrade('english', 'grade-5').find(u => u.titleEn === "Let's Explore!")!;

describe("a unit's theme reaches the prompt", () => {
  it('the unit carries the book\'s own theme', () => {
    assert.match(unit.generalIdea ?? '', /space/i);
  });

  it('a unit-wide digest says the unit is about space and lists its words', () => {
    const g = resolveScopeGrounding({ kind: 'unit', gradeId: 'grade-5', subjectId: 'english', unitId: unit.id } as never, 'en');
    assert.match(g.context, /Unit theme[^\n]*space/i);
    assert.match(g.context, /solar system/);
  });

  it('a single lesson of the unit says it too', () => {
    const lesson = getLessonsForUnit(unit.id)[0]!;
    const g = resolveGeneratorGrounding(lesson.titleEn, 'en', { lessonId: lesson.id });
    assert.match(g.context, /Unit theme[^\n]*space/i);
  });

  it('a unit with no printed theme adds no line', () => {
    assert.equal(unitThemeLine(undefined, true), '');
    assert.equal(unitThemeLine('  ', false), '');
  });
});
