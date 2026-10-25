import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { guardianSignup, type GuardianSignupInput } from "../guardianSignup.ts";
import { GUARDIAN_LIMITS } from "../guardianConsent.ts";

const TICKED = new Date("2026-10-24T10:00:00Z");

function input(over: Partial<GuardianSignupInput> & { count?: number } = {}): GuardianSignupInput & { asked: string[]; ageCalls: number } {
  const state = { asked: [] as string[], ageCalls: 0 };
  return {
    flagOn: true,
    role: "student",
    body: { parentEmail: "Mum@Example.test" },
    studentEmail: "kid@example.test",
    countForParent: async e => {
      state.asked.push(e);
      return over.count ?? 0;
    },
    ageConfirmation: (body, role) => {
      state.ageCalls += 1;
      if (role !== "student") return { ok: true, guardianConfirmedAt: null };
      if ((body as { ageConfirmed?: unknown })?.ageConfirmed !== true) {
        return { ok: false, status: 400, code: "age_confirmation_required", error: "tick" };
      }
      return { ok: true, guardianConfirmedAt: TICKED };
    },
    ...over,
    get asked() {
      return state.asked;
    },
    get ageCalls() {
      return state.ageCalls;
    },
  } as GuardianSignupInput & { asked: string[]; ageCalls: number };
}

describe("guardianSignup", () => {
  it("flag off: ignores a parent email, asks for the tick, records it", async () => {
    const noTick = input({ flagOn: false });
    const refused = await guardianSignup(noTick);
    assert.deepEqual(refused, { ok: false, status: 400, body: { error: "tick", code: "age_confirmation_required" } });
    assert.deepEqual(noTick.asked, [], "no parent lookup with the flag off");

    const ticked = await guardianSignup(input({ flagOn: false, body: { ageConfirmed: true, parentEmail: "x@example.test" } }));
    assert.deepEqual(ticked, { ok: true, parentEmail: null, guardianConfirmedAt: TICKED });
  });

  it("flag on, student: a parent email is required (400)", async () => {
    for (const body of [{}, null, undefined, { parentEmail: "" }, { ageConfirmed: true }]) {
      const r = await guardianSignup(input({ body }));
      assert.equal(r.ok, false);
      if (!r.ok) {
        assert.equal(r.status, 400);
        assert.equal(r.body.code, "parent_email_required");
      }
    }
  });

  it("flag on, student: the parent email must be valid and not the student's own", async () => {
    const bad = await guardianSignup(input({ body: { parentEmail: "nope" } }));
    assert.equal(!bad.ok && bad.body.code, "parent_email_invalid");
    const own = await guardianSignup(input({ body: { parentEmail: " KID@example.test " } }));
    assert.equal(own.ok, false);
    if (!own.ok) {
      assert.equal(own.status, 400);
      assert.equal(own.body.code, "parent_email_is_own");
    }
  });

  it("flag on, student: returns the lower-cased parent address, records no tick, and never asks for one", async () => {
    const i = input({ body: { parentEmail: "  Mum@Example.test ", ageConfirmed: true } });
    const r = await guardianSignup(i);
    assert.deepEqual(r, { ok: true, parentEmail: "mum@example.test", guardianConfirmedAt: null });
    assert.deepEqual(i.asked, ["mum@example.test"], "the count is asked of the normalised address");
    assert.equal(i.ageCalls, 0);
  });

  it("flag on, student: the per-address cap is exact (one below the limit passes, the limit is refused)", async () => {
    const max = GUARDIAN_LIMITS.perParentPerDay;
    assert.equal((await guardianSignup(input({ count: max - 1 }))).ok, true);
    const over = await guardianSignup(input({ count: max }));
    assert.deepEqual(over, {
      ok: false,
      status: 429,
      body: { error: "Too many requests for that address. Try again tomorrow.", code: "guardian_rate_limited" },
    });
    assert.equal((await guardianSignup(input({ count: max + 3 }))).ok, false);
  });

  it("flag on, teacher or parent: never needs a parent email, and is not counted", async () => {
    for (const role of ["teacher", "parent"]) {
      const i = input({ role, body: {} });
      assert.deepEqual(await guardianSignup(i), { ok: true, parentEmail: null, guardianConfirmedAt: null });
      assert.deepEqual(i.asked, []);
    }
  });
});
