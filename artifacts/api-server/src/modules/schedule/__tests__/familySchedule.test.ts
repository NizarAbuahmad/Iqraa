/**
 * What this guards: a family sees a week grid built from teachers' own
 * timetables. The traps are all "looks right, is wrong": two teachers define
 * "period 1" at different times, a multi-subject class that never said which
 * subject a period is, and a slot for a class the family is not in.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  buildFamilySchedule,
  type PeriodRow,
  type ScheduleInput,
  type SlotRow,
} from "../familySchedule.ts";

function slot(over: Partial<SlotRow> = {}): SlotRow {
  return {
    teacherId: "t1",
    schoolName: "",
    dayOfWeek: 0,
    periodNumber: 1,
    classGroupId: "c1",
    subjectId: "",
    ...over,
  };
}

function period(over: Partial<PeriodRow> = {}): PeriodRow {
  return { teacherId: "t1", schoolName: "", periodNumber: 1, startTime: "08:00", durationMinutes: 45, ...over };
}

function input(over: Partial<ScheduleInput> = {}): ScheduleInput {
  return {
    slots: [],
    periods: [],
    classes: [{ id: "c1", subjectId: "mathematics", subjectIds: ["mathematics"] }],
    teachers: [{ id: "t1", firstName: "Omar", lastName: "Haddad" }],
    ...over,
  };
}

describe("buildFamilySchedule", () => {
  it("is empty when no teacher has entered a slot — never an empty-looking free week", () => {
    assert.deepEqual(buildFamilySchedule(input()), { days: [] });
  });

  it("groups by day, ascending from Sunday, and only lists days that have a period", () => {
    const s = buildFamilySchedule(
      input({
        slots: [slot({ dayOfWeek: 3 }), slot({ dayOfWeek: 0 })],
        periods: [period()],
      }),
    );
    assert.deepEqual(s.days.map(d => d.dayOfWeek), [0, 3]);
  });

  it("orders a day by the clock, not by period number", () => {
    const s = buildFamilySchedule(
      input({
        slots: [
          slot({ teacherId: "t1", periodNumber: 1 }),
          slot({ teacherId: "t2", periodNumber: 2 }),
        ],
        // t2's period 2 starts before t1's period 1.
        periods: [
          period({ teacherId: "t1", periodNumber: 1, startTime: "09:00" }),
          period({ teacherId: "t2", periodNumber: 2, startTime: "08:00" }),
        ],
        teachers: [
          { id: "t1", firstName: "Omar", lastName: "Haddad" },
          { id: "t2", firstName: "Lina", lastName: "Saleh" },
        ],
      }),
    );
    assert.deepEqual(s.days[0].periods.map(p => p.teacherName), ["Lina Saleh", "Omar Haddad"]);
  });

  it("takes each period's time from its own teacher — two teachers' 'period 1' are unrelated", () => {
    const s = buildFamilySchedule(
      input({
        slots: [slot({ teacherId: "t1", dayOfWeek: 0 }), slot({ teacherId: "t2", dayOfWeek: 1 })],
        periods: [
          period({ teacherId: "t1", startTime: "08:00" }),
          period({ teacherId: "t2", startTime: "10:30", durationMinutes: 50 }),
        ],
        teachers: [
          { id: "t1", firstName: "Omar", lastName: "Haddad" },
          { id: "t2", firstName: "Lina", lastName: "Saleh" },
        ],
      }),
    );
    assert.equal(s.days[0].periods[0].startTime, "08:00");
    assert.equal(s.days[1].periods[0].startTime, "10:30");
    assert.equal(s.days[1].periods[0].durationMinutes, 50);
  });

  it("matches a period to the slot's school — the same number means different times in two schools", () => {
    const s = buildFamilySchedule(
      input({
        // Same teacher, same period number, different days, so the two slots
        // do not collide on the DB's unique index.
        slots: [
          slot({ schoolName: "", dayOfWeek: 0 }),
          slot({ schoolName: "B", dayOfWeek: 1 }),
        ],
        // "B" is listed last on purpose: a school-blind key would let its row win.
        periods: [
          period({ schoolName: "", startTime: "08:00" }),
          period({ schoolName: "B", startTime: "13:00" }),
        ],
      }),
    );
    assert.equal(s.days[0].periods[0].startTime, "08:00");
    assert.equal(s.days[1].periods[0].startTime, "13:00");
  });

  it("keeps a period whose time is unknown, last, with null times", () => {
    const s = buildFamilySchedule(
      input({
        slots: [slot({ periodNumber: 1 }), slot({ periodNumber: 2 })],
        periods: [period({ periodNumber: 2, startTime: "09:00" })],
      }),
    );
    const [first, second] = s.days[0].periods;
    assert.equal(first.periodNumber, 2);
    assert.equal(second.periodNumber, 1);
    assert.equal(second.startTime, null);
    assert.equal(second.durationMinutes, null);
  });

  it("uses the slot's subject when it names one", () => {
    const s = buildFamilySchedule(
      input({
        slots: [slot({ subjectId: "physics" })],
        classes: [{ id: "c1", subjectId: "mathematics", subjectIds: ["mathematics", "physics"] }],
      }),
    );
    assert.equal(s.days[0].periods[0].subjectId, "physics");
  });

  it("fills the subject from a one-subject class that did not say", () => {
    const s = buildFamilySchedule(input({ slots: [slot()] }));
    assert.equal(s.days[0].periods[0].subjectId, "mathematics");
  });

  it("leaves the subject empty for a multi-subject class that did not say — guessing would mislabel it", () => {
    const s = buildFamilySchedule(
      input({
        slots: [slot()],
        classes: [{ id: "c1", subjectId: "mathematics", subjectIds: ["mathematics", "physics"] }],
      }),
    );
    assert.equal(s.days[0].periods[0].subjectId, "");
  });

  it("falls back to the single legacy subjectId when subjectIds is empty", () => {
    const s = buildFamilySchedule(
      input({ slots: [slot()], classes: [{ id: "c1", subjectId: "chemistry", subjectIds: [] }] }),
    );
    assert.equal(s.days[0].periods[0].subjectId, "chemistry");
  });

  it("drops a slot for a class the family is not in", () => {
    const s = buildFamilySchedule(input({ slots: [slot({ classGroupId: "someone-elses" })] }));
    assert.deepEqual(s, { days: [] });
  });

  it("copes with a teacher row that is missing — name is empty, the period still shows", () => {
    const s = buildFamilySchedule(input({ slots: [slot()], teachers: [] }));
    assert.equal(s.days[0].periods[0].teacherName, "");
  });

  it("never exposes a teacher's private slot note", () => {
    // schedule_slots.notes is a note in the teacher's own timetable and can concern
    // individual children. Even if a row somehow carries one, it must not reach a family.
    const note = "غياب سارة متكرر";
    const withNote = { ...slot(), notes: note } as SlotRow;
    const result = buildFamilySchedule(input({ slots: [withNote], periods: [period()] }));
    const p = result.days[0].periods[0];
    assert.equal("notes" in p, false);
    assert.ok(!Object.keys(p).includes("notes"));
    assert.ok(!JSON.stringify(result).includes(note));
  });
});
