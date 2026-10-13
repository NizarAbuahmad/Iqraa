import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { groupObjectivesByLesson } from '../objectiveLessons.ts';

describe('groupObjectivesByLesson', () => {
  // The picker is a flat list of a whole book's objectives. A teacher cannot
  // tell which lesson a quiz is for unless the lesson is shown, and the lesson
  // is what the mastery gate unlocks.
  const o = (id: string, lessonId: string, unitId: string) => ({
    id,
    lessonId,
    lessonTitle: `lesson ${lessonId}`,
    lessonTitleAr: `درس ${lessonId}`,
    unitId,
    unitName: `unit ${unitId}`,
    unitNameAr: `وحدة ${unitId}`,
  });

  it('puts the objectives of one lesson in one group, in catalog order', () => {
    const groups = groupObjectivesByLesson([o('a', 'l1', 'u1'), o('b', 'l1', 'u1'), o('c', 'l2', 'u1')]);
    assert.deepEqual(groups.map(g => g.lessonId), ['l1', 'l2']);
    assert.deepEqual(groups[0]!.objectives.map(x => x.id), ['a', 'b']);
    assert.deepEqual(groups[1]!.objectives.map(x => x.id), ['c']);
  });

  it('lists every objective exactly once, even if a lesson reappears later in the list', () => {
    const groups = groupObjectivesByLesson([o('a', 'l1', 'u1'), o('b', 'l2', 'u1'), o('c', 'l1', 'u1')]);
    assert.equal(groups.length, 2);
    assert.deepEqual(groups[0]!.objectives.map(x => x.id), ['a', 'c']);
    assert.equal(groups.flatMap(g => g.objectives).length, 3);
  });

  it('carries the unit and lesson names, so the heading needs no second lookup', () => {
    const [g] = groupObjectivesByLesson([o('a', 'l1', 'u1')]);
    assert.equal(g!.unitName, 'unit u1');
    assert.equal(g!.unitNameAr, 'وحدة u1');
    assert.equal(g!.lessonTitle, 'lesson l1');
    assert.equal(g!.lessonTitleAr, 'درس l1');
  });

  it('keeps lessons of different units apart and in order', () => {
    const groups = groupObjectivesByLesson([o('a', 'l1', 'u1'), o('b', 'l9', 'u2')]);
    assert.deepEqual(groups.map(g => g.unitId), ['u1', 'u2']);
  });

  it('answers an empty list with no groups', () => {
    assert.deepEqual(groupObjectivesByLesson([]), []);
  });
});
