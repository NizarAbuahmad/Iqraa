import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  SUPPORT_GROUPS_SHOWN, filterToAudience, groupCheckAction, groupDraftAction, groupSizeLabel,
  groupWorksheetAction, membersBelowLabel, outcomeKey, parseStudentIds, visibleGroups,
  type SupportGroup,
} from '../supportGroups.ts';
import { lessonPickerParams } from '../lessonPrep.ts';

const CHEM = 'kbl-chem-s1-nccd-u1_l1';
const MATH = 'kbl-math-s1-nccd-u1_l1';

function group(over: Partial<SupportGroup>): SupportGroup {
  return {
    objectiveId: 'o1', titleAr: 'هدف', lessonId: CHEM, lessonTitleAr: 'درس', classPercent: 40,
    members: [{ studentId: 's1', displayName: 'أحمد', percent: 30 }, { studentId: 's2', displayName: 'ليلى', percent: 50 }],
    latestCheck: null, draftCheck: null, ...over,
  };
}

describe('visibleGroups', () => {
  it('shows the first three until asked for all', () => {
    const groups = [1, 2, 3, 4, 5].map(i => group({ objectiveId: `o${i}` }));
    assert.equal(SUPPORT_GROUPS_SHOWN, 3);
    assert.equal(visibleGroups(groups, false).length, 3);
    assert.equal(visibleGroups(groups, true).length, 5);
  });
});

describe('card actions', () => {
  it('sends the group check to the quick check with the members', () => {
    assert.deepEqual(groupCheckAction('c1', group({})), {
      pathname: '/evaluations/mini', params: { classId: 'c1', objectiveId: 'o1', studentIds: 's1,s2' },
    });
  });
  it('opens an unfinished draft instead of a new check', () => {
    assert.equal(groupDraftAction(group({})), null);
    assert.deepEqual(groupDraftAction(group({ draftCheck: { evaluationId: 'e9' } })), {
      pathname: '/evaluations/[id]', params: { id: 'e9' },
    });
  });
  it("opens the worksheet on the lesson's own subject, and hides it without a lesson", () => {
    const chem = groupWorksheetAction(group({}))!;
    const math = groupWorksheetAction(group({ lessonId: MATH }))!;
    assert.equal(chem.params.subjectIdx, lessonPickerParams(CHEM, 'ar')!.subjectIdx);
    assert.notEqual(chem.params.subjectIdx, math.params.subjectIdx);
    assert.equal(groupWorksheetAction(group({ lessonId: null })), null);
  });
});

describe('parseStudentIds', () => {
  it('splits, trims, dedupes and drops empties', () => {
    assert.deepEqual(parseStudentIds(' s1, s2,,s1 '), ['s1', 's2']);
    assert.deepEqual(parseStudentIds(['s1,s2', 's3']), ['s1', 's2', 's3']);
    assert.deepEqual(parseStudentIds(undefined), []);
  });
});

describe('filterToAudience', () => {
  const rows = [{ id: 's1' }, { id: 's2' }, { id: 's3' }];
  it('keeps everyone for a class exam and only the group for a group check', () => {
    assert.equal(filterToAudience(rows, null).length, 3);
    assert.deepEqual(filterToAudience(rows, ['s3', 's1']).map(r => r.id), ['s1', 's3']);
  });
});

describe('labels', () => {
  it('names each outcome', () => {
    assert.equal(outcomeKey('passed'), 'supportOutcomePassed');
    assert.equal(outcomeKey('still_weak'), 'supportOutcomeStillWeak');
    assert.equal(outcomeKey('not_yet'), 'supportOutcomeNotYet');
  });
  it('counts students in Arabic and English', () => {
    assert.equal(groupSizeLabel(1, 'ar'), 'للمجموعة: طالب واحد');
    assert.equal(groupSizeLabel(2, 'ar'), 'للمجموعة: طالبان');
    assert.equal(groupSizeLabel(5, 'ar'), 'للمجموعة: 5 طلبة');
    assert.equal(groupSizeLabel(1, 'en'), 'For the group: 1 student');
    assert.equal(membersBelowLabel(3, 'ar'), '3 طلبة دون 60%');
    assert.equal(membersBelowLabel(12, 'ar'), '12 طالبًا دون 60%');
    assert.equal(membersBelowLabel(2, 'en'), '2 students below 60%');
  });
});
