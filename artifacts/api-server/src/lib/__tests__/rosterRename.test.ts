/**
 * What this guards: renaming a roster row must not leave the linked account
 * wearing the old name, and must never overwrite a name its owner chose.
 *
 * A code-only account (a login code, no password and no Google id) is named from the roster row once, at sign-up
 * (`namesForNewAccount`). The teacher's chat list shows that account name, so a
 * rename that stopped at the roster row left «خالد التبس» in every thread. But
 * a person may also have edited their own name, so the account is rewritten
 * only while it still equals what the OLD roster name would have produced.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { nameKey, nameTakenBy, renamedAccountNames } from "../rosterRename.ts";

describe("nameKey / nameTakenBy", () => {
  it("collapses whitespace and case, nothing more", () => {
    assert.equal(nameKey("  Khaled   AL  Tais "), "khaled al tais");
  });

  it("does not fold Arabic orthography — two different names stay different", () => {
    assert.notEqual(nameKey("أحمد"), nameKey("احمد"));
  });

  it("finds a peer with the same name regardless of spacing", () => {
    assert.equal(nameTakenBy("خالد   التيس", ["سارة", "خالد التيس"]), true);
  });

  it("is false when no peer shares the name", () => {
    assert.equal(nameTakenBy("خالد التيس", ["سارة", "آدم"]), false);
    assert.equal(nameTakenBy("خالد التيس", []), false);
  });
});

describe("renamedAccountNames", () => {
  it("re-derives a student account that still carries the old roster name", () => {
    assert.deepEqual(
      renamedAccountNames({
        relation: "self",
        oldRosterName: "خالد التبس",
        newRosterName: "خالد التيس",
        current: { firstName: "خالد", lastName: "التبس" },
      }),
      { firstName: "خالد", lastName: "التيس" },
    );
  });

  it("re-derives a parent account, which is «ولي أمر» plus the child's name", () => {
    assert.deepEqual(
      renamedAccountNames({
        relation: "guardian",
        oldRosterName: "خالد التبس",
        newRosterName: "خالد التيس",
        current: { firstName: "ولي أمر", lastName: "خالد التبس" },
      }),
      { firstName: "ولي أمر", lastName: "خالد التيس" },
    );
  });

  it("leaves a name its owner changed alone", () => {
    assert.equal(
      renamedAccountNames({
        relation: "self",
        oldRosterName: "خالد التبس",
        newRosterName: "خالد التيس",
        current: { firstName: "خوخو", lastName: "" },
      }),
      null,
    );
  });

  it("returns null when the rename changes nothing about the derived name", () => {
    assert.equal(
      renamedAccountNames({
        relation: "self",
        oldRosterName: "خالد التيس",
        newRosterName: "خالد   التيس",
        current: { firstName: "خالد", lastName: "التيس" },
      }),
      null,
    );
  });
});
