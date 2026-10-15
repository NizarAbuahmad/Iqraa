/**
 * Question allocation across competencies.
 *
 * The rule these guard: allocation is done in **marks**, not question counts.
 * They are different once questions carry different weights, and the level is
 * computed marks-weighted — so a count-based split silently under-serves the
 * cheap competencies. That is not hypothetical: allocating by count put
 * knowledge at 3 questions and 9% of marks, under the 10% floor, which the
 * scoring rules then drop from the result as insufficient evidence. The teacher
 * sees a blank bar and no explanation.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  allocateQuestions,
  COMPETENCY_KEYS,
  COMPETENCY_TARGETS,
  MARKS_BY_COMPETENCY,
  remainingQuota,
  type CompetencyKey,
  type Difficulty,
} from "../competency.ts";

const DIFFICULTIES: Difficulty[] = ["basic", "standard", "advanced"];

function marksOf(counts: Record<string, number>): number {
  return COMPETENCY_KEYS.reduce(
    (sum, k) => sum + counts[k]! * MARKS_BY_COMPETENCY[k],
    0,
  );
}

describe("allocateQuestions", () => {
  for (const difficulty of DIFFICULTIES) {
    it(`assigns exactly the requested number of questions (${difficulty})`, () => {
      for (const total of [1, 3, 8, 10, 15, 20, 33]) {
        const counts = allocateQuestions(total, difficulty);
        const sum = COMPETENCY_KEYS.reduce((s, k) => s + counts[k]!, 0);
        assert.equal(sum, total, `${difficulty}/${total} produced ${sum}`);
      }
    });

    it(`gives every competency enough to be scoreable (${difficulty})`, () => {
      // Two questions AND 10% of marks is what the scoring rules require before
      // a competency is reported at all.
      const counts = allocateQuestions(15, difficulty);
      const total = marksOf(counts);
      for (const key of COMPETENCY_KEYS) {
        assert.ok(counts[key]! >= 2, `${key} got ${counts[key]} questions`);
        const share = (counts[key]! * MARKS_BY_COMPETENCY[key]) / total;
        assert.ok(
          share >= 0.1,
          `${key} holds ${(share * 100).toFixed(1)}% of marks, under the 10% floor`,
        );
      }
    });

    it(`lands near the target marks share once the floor stops binding (${difficulty})`, () => {
      // At 20 questions a 10% target cannot be met alongside two seeded
      // 4-mark critical-thinking questions, and the floor deliberately wins.
      // By 40 the constraint is slack and the greedy split should track the
      // targets closely.
      const counts = allocateQuestions(40, difficulty);
      const total = marksOf(counts);
      for (const key of COMPETENCY_KEYS) {
        const share = (counts[key]! * MARKS_BY_COMPETENCY[key]) / total;
        const target = COMPETENCY_TARGETS[difficulty][key];
        assert.ok(
          Math.abs(share - target) <= 0.05,
          `${key}: ${(share * 100).toFixed(0)}% vs target ${(target * 100).toFixed(0)}%`,
        );
      }
    });

    it(`keeps the minimum-evidence floor even where it overshoots (${difficulty})`, () => {
      // The floor is the non-negotiable part: under two questions, scoring
      // reports no value for the competency at all.
      const counts = allocateQuestions(20, difficulty);
      for (const key of COMPETENCY_KEYS) {
        assert.ok(counts[key]! >= 2, `${key} got ${counts[key]}`);
      }
    });
  }

  it("shifts weight upward as difficulty rises", () => {
    // Measured at a size where the seeding floor is not the binding constraint;
    // below that, the floor lifts critical thinking on every difficulty alike.
    const share = (d: Difficulty) => {
      const c = allocateQuestions(40, d);
      return (c.critical_thinking * MARKS_BY_COMPETENCY.critical_thinking) / marksOf(c);
    };
    assert.ok(share("advanced") > share("standard"), "advanced should out-weigh standard");
    assert.ok(share("standard") > share("basic"), "standard should out-weigh basic");
  });

  it("handles counts too small to seed every competency", () => {
    // Below the seeding threshold it must still return exactly `total`, even
    // though a spread is impossible — the caller reports the shortfall.
    for (const total of [1, 2, 5, 7]) {
      const counts = allocateQuestions(total, "standard");
      assert.equal(COMPETENCY_KEYS.reduce((s, k) => s + counts[k]!, 0), total);
    }
  });

  it("returns all zeros for a zero request rather than throwing", () => {
    const counts = allocateQuestions(0, "standard");
    assert.equal(marksOf(counts), 0);
  });
});

/**
 * Pin: with no `supplied` argument the result is exactly what the function
 * returned before it learned about supplied questions.
 *
 * Provenance: generated once, on 2026-10-12, by running the UNMODIFIED
 * `allocateQuestions` (commit 314f07f2) for every total 0..40 and every
 * difficulty, and pasted here as literals. Each row is
 * [knowledge, understanding, application, critical_thinking] for total = the
 * trailing comment. Do not regenerate these from the current code — that would
 * pin the new behaviour to itself.
 */
const PINNED: Record<Difficulty, number[][]> = {
  basic: [
    [0, 0, 0, 0], // 0
    [1, 0, 0, 0], // 1
    [1, 1, 0, 0], // 2
    [1, 1, 1, 0], // 3
    [2, 1, 1, 0], // 4
    [2, 1, 1, 1], // 5
    [3, 1, 1, 1], // 6
    [3, 2, 1, 1], // 7
    [2, 2, 2, 2], // 8
    [3, 2, 2, 2], // 9
    [4, 2, 2, 2], // 10
    [5, 2, 2, 2], // 11
    [5, 3, 2, 2], // 12
    [6, 3, 2, 2], // 13
    [7, 3, 2, 2], // 14
    [7, 4, 2, 2], // 15
    [8, 4, 2, 2], // 16
    [9, 4, 2, 2], // 17
    [9, 5, 2, 2], // 18
    [10, 5, 2, 2], // 19
    [11, 5, 2, 2], // 20
    [11, 6, 2, 2], // 21
    [12, 6, 2, 2], // 22
    [12, 6, 3, 2], // 23
    [13, 6, 3, 2], // 24
    [13, 7, 3, 2], // 25
    [14, 7, 3, 2], // 26
    [15, 7, 3, 2], // 27
    [15, 8, 3, 2], // 28
    [16, 8, 3, 2], // 29
    [17, 8, 3, 2], // 30
    [17, 9, 3, 2], // 31
    [17, 9, 4, 2], // 32
    [18, 9, 4, 2], // 33
    [19, 9, 4, 2], // 34
    [19, 10, 4, 2], // 35
    [20, 10, 4, 2], // 36
    [21, 10, 4, 2], // 37
    [21, 11, 4, 2], // 38
    [22, 11, 4, 2], // 39
    [22, 11, 5, 2], // 40
  ],
  standard: [
    [0, 0, 0, 0], // 0
    [0, 1, 0, 0], // 1
    [0, 1, 1, 0], // 2
    [1, 1, 1, 0], // 3
    [1, 1, 1, 1], // 4
    [2, 1, 1, 1], // 5
    [2, 2, 1, 1], // 6
    [2, 2, 2, 1], // 7
    [2, 2, 2, 2], // 8
    [3, 2, 2, 2], // 9
    [3, 3, 2, 2], // 10
    [4, 3, 2, 2], // 11
    [4, 4, 2, 2], // 12
    [4, 4, 3, 2], // 13
    [5, 4, 3, 2], // 14
    [6, 4, 3, 2], // 15
    [6, 5, 3, 2], // 16
    [6, 5, 4, 2], // 17
    [7, 5, 4, 2], // 18
    [7, 6, 4, 2], // 19
    [8, 6, 4, 2], // 20
    [9, 6, 4, 2], // 21
    [9, 7, 4, 2], // 22
    [9, 7, 5, 2], // 23
    [9, 7, 5, 3], // 24
    [10, 7, 5, 3], // 25
    [10, 8, 5, 3], // 26
    [10, 8, 6, 3], // 27
    [11, 8, 6, 3], // 28
    [11, 9, 6, 3], // 29
    [12, 9, 6, 3], // 30
    [13, 9, 6, 3], // 31
    [13, 10, 6, 3], // 32
    [13, 10, 7, 3], // 33
    [13, 10, 7, 4], // 34
    [14, 10, 7, 4], // 35
    [14, 11, 7, 4], // 36
    [14, 11, 8, 4], // 37
    [15, 11, 8, 4], // 38
    [15, 12, 8, 4], // 39
    [16, 12, 8, 4], // 40
  ],
  advanced: [
    [0, 0, 0, 0], // 0
    [0, 0, 1, 0], // 1
    [0, 0, 1, 1], // 2
    [0, 1, 1, 1], // 3
    [1, 1, 1, 1], // 4
    [1, 1, 2, 1], // 5
    [1, 2, 2, 1], // 6
    [1, 2, 2, 2], // 7
    [2, 2, 2, 2], // 8
    [2, 2, 3, 2], // 9
    [2, 3, 3, 2], // 10
    [2, 3, 3, 3], // 11
    [2, 3, 4, 3], // 12
    [3, 3, 4, 3], // 13
    [3, 4, 4, 3], // 14
    [4, 4, 4, 3], // 15
    [4, 4, 5, 3], // 16
    [4, 4, 5, 4], // 17
    [4, 5, 5, 4], // 18
    [4, 5, 6, 4], // 19
    [5, 5, 6, 4], // 20
    [5, 5, 6, 5], // 21
    [5, 6, 6, 5], // 22
    [5, 6, 7, 5], // 23
    [6, 6, 7, 5], // 24
    [6, 6, 7, 6], // 25
    [6, 6, 8, 6], // 26
    [6, 7, 8, 6], // 27
    [7, 7, 8, 6], // 28
    [7, 7, 9, 6], // 29
    [7, 7, 9, 7], // 30
    [7, 8, 9, 7], // 31
    [8, 8, 9, 7], // 32
    [8, 8, 10, 7], // 33
    [8, 8, 10, 8], // 34
    [8, 9, 10, 8], // 35
    [9, 9, 10, 8], // 36
    [9, 9, 11, 8], // 37
    [9, 10, 11, 8], // 38
    [9, 10, 11, 9], // 39
    [9, 10, 12, 9], // 40
  ],
};

describe("allocateQuestions with no supplied questions", () => {
  for (const difficulty of DIFFICULTIES) {
    it(`equals the pre-supplied behaviour for every total 0..40 (${difficulty})`, () => {
      PINNED[difficulty].forEach((row, total) => {
        const expected = Object.fromEntries(
          COMPETENCY_KEYS.map((k, i) => [k, row[i]]),
        );
        assert.deepEqual(allocateQuestions(total, difficulty), expected, `${difficulty}/${total}`);
        assert.deepEqual(allocateQuestions(total, difficulty, {}), expected, `${difficulty}/${total} {}`);
        assert.deepEqual(
          allocateQuestions(total, difficulty, {
            knowledge: 0,
            understanding: 0,
            application: 0,
            critical_thinking: 0,
          }),
          expected,
          `${difficulty}/${total} zeros`,
        );
      });
    });
  }
});

describe("allocateQuestions with supplied questions", () => {
  const sum = (c: Record<CompetencyKey, number>) => COMPETENCY_KEYS.reduce((s, k) => s + c[k], 0);
  const fill = (p: Partial<Record<CompetencyKey, number>>) =>
    Object.fromEntries(COMPETENCY_KEYS.map(k => [k, p[k] ?? 0])) as Record<CompetencyKey, number>;
  /** L1 distance between a paper's marks shares and the difficulty's targets. */
  const distance = (counts: Record<CompetencyKey, number>, difficulty: Difficulty) => {
    const total = marksOf(counts);
    return COMPETENCY_KEYS.reduce(
      (d, k) =>
        d + Math.abs((counts[k] * MARKS_BY_COMPETENCY[k]) / total - COMPETENCY_TARGETS[difficulty][k]),
      0,
    );
  };

  it("(b) returns only the new questions and steers the WHOLE paper to the targets", () => {
    const supplied = { application: 5, understanding: 1 };
    const fresh = allocateQuestions(10, "basic", supplied);
    assert.equal(sum(fresh), 4);

    const whole = fill({});
    const naiveWhole = fill({});
    const naive = allocateQuestions(4, "basic");
    for (const k of COMPETENCY_KEYS) {
      whole[k] = fresh[k] + (supplied[k as keyof typeof supplied] ?? 0);
      naiveWhole[k] = naive[k] + (supplied[k as keyof typeof supplied] ?? 0);
    }
    assert.ok(
      distance(whole, "basic") < distance(naiveWhole, "basic"),
      `aware ${distance(whole, "basic").toFixed(3)} should beat naive ${distance(naiveWhole, "basic").toFixed(3)}`,
    );
    // Application is already over-supplied for a basic paper: the new questions
    // must not add more of it.
    assert.equal(fresh.application, 0);
  });

  for (const difficulty of DIFFICULTIES) {
    it(`(b) new counts sum to total minus supplied (${difficulty})`, () => {
      for (const total of [0, 3, 6, 10, 15, 20, 40]) {
        const supplied = { knowledge: 1, application: 3 };
        const fresh = allocateQuestions(total, difficulty, supplied);
        assert.equal(sum(fresh), Math.max(0, total - 4), `${difficulty}/${total}`);
      }
    });
  }

  it("(c) supplied larger than (or equal to) total gives all zeros", () => {
    const zeros = fill({});
    assert.deepEqual(allocateQuestions(5, "standard", { application: 9 }), zeros);
    assert.deepEqual(allocateQuestions(5, "standard", { application: 5 }), zeros);
    assert.deepEqual(allocateQuestions(0, "advanced", { knowledge: 2 }), zeros);
  });

  it("(d) never returns a negative count", () => {
    for (const difficulty of DIFFICULTIES) {
      for (let total = 0; total <= 30; total++) {
        for (const supplied of [
          { application: 12 },
          { knowledge: 7, critical_thinking: 9 },
          { understanding: 2, application: 2, knowledge: 2, critical_thinking: 2 },
          { knowledge: 30 },
        ]) {
          const fresh = allocateQuestions(total, difficulty, supplied);
          for (const k of COMPETENCY_KEYS) {
            assert.ok(fresh[k] >= 0, `${difficulty}/${total}/${JSON.stringify(supplied)}: ${k}=${fresh[k]}`);
          }
        }
      }
    }
  });

  it("(e) the two-per-competency floor counts supplied questions", () => {
    // 8 questions in all, 2 already understanding: the 6 new ones are exactly
    // the seeds the other three competencies still need. Understanding is
    // already at two, so it gets none.
    assert.deepEqual(
      allocateQuestions(8, "standard", { understanding: 2 }),
      fill({ knowledge: 2, application: 2, critical_thinking: 2 }),
    );
    // One supplied critical-thinking question needs just one more seed.
    assert.deepEqual(
      allocateQuestions(8, "advanced", { critical_thinking: 1, understanding: 1 }),
      fill({ knowledge: 2, understanding: 1, application: 2, critical_thinking: 1 }),
    );
  });

  it("(e) seeds nothing when the budget cannot cover every seed (all-or-nothing)", () => {
    // Seeds needed: 2 + 0 + 2 + 2 = 6, only 5 new questions to give: greedy only.
    const fresh = allocateQuestions(7, "standard", { understanding: 2 });
    assert.equal(sum(fresh), 5);
    assert.ok(
      COMPETENCY_KEYS.some(k => k !== "understanding" && fresh[k] < 2),
      `expected no seeding, got ${JSON.stringify(fresh)}`,
    );
  });
});

describe("allocateQuestions on a small paper, with the book's lone questions", () => {
  const fill = (p: Partial<Record<CompetencyKey, number>>) =>
    Object.fromEntries(COMPETENCY_KEYS.map(k => [k, p[k] ?? 0])) as Record<CompetencyKey, number>;
  const whole = (fresh: Record<CompetencyKey, number>, sup: Partial<Record<CompetencyKey, number>>) =>
    COMPETENCY_KEYS.map(k => fresh[k] + (sup[k] ?? 0));
  const atLeastTwo = (w: number[]) => w.filter(n => n >= 2).length;
  const exactlyOne = (w: number[]) => w.filter(n => n === 1).length;

  // The motivating plan: u1_l1 + u6_l2 supplies one understanding and four
  // application questions. At 7 and 8 questions the budget cannot seed all four
  // competencies, and the old code spent it scattering singletons.
  const PLAN = { understanding: 1, application: 4 };

  it("pairs the book's single question first: understanding 1 becomes 2", () => {
    assert.deepEqual(allocateQuestions(7, "standard", PLAN), fill({ understanding: 2 }));
    // 3 questions, application supplied once: the pair comes first, and the one
    // left over joins a competency the paper already has rather than starting a lone one.
    assert.deepEqual(allocateQuestions(3, "standard", { application: 1 }), fill({ application: 2 }));
    assert.deepEqual(allocateQuestions(2, "standard", { understanding: 1 }), fill({ understanding: 1 }));
  });

  it("a competency it has to start from nothing gets two questions, not one", () => {
    // 8 = 5 supplied + 3: one pairs understanding, the other two start knowledge as a pair.
    assert.deepEqual(allocateQuestions(8, "standard", PLAN), fill({ knowledge: 2, understanding: 1 }));
    assert.deepEqual(allocateQuestions(10, "standard", PLAN), fill({ knowledge: 2, understanding: 1, critical_thinking: 2 }));
    assert.deepEqual(allocateQuestions(4, "standard", { application: 1 }), fill({ understanding: 2, application: 1 }));
  });

  it("pairs singles in competency order, as far as the budget goes", () => {
    // Knowledge and understanding are both single; one question to give: knowledge's.
    assert.deepEqual(allocateQuestions(3, "standard", { knowledge: 1, understanding: 1 }), fill({ knowledge: 1 }));
  });

  it("pairing needs something supplied, and a supplied two is not a single", () => {
    // Nothing supplied: exactly the unaware allocation (also pinned for every total above).
    assert.deepEqual(allocateQuestions(5, "standard", {}), allocateQuestions(5, "standard"));
    // Understanding already has its two: nothing to pair, it gets none of the 5
    // new questions, and the paper has no lone competency.
    const fresh = allocateQuestions(7, "standard", { understanding: 2 });
    assert.equal(fresh.understanding, 0);
    assert.equal(exactlyOne(whole(fresh, { understanding: 2 })), 0);
  });

  it("is never worse than the unaware split on the whole paper (competencies with >= 2, and with exactly 1)", () => {
    const mixes: Array<Partial<Record<CompetencyKey, number>>> = [
      PLAN, { application: 1 }, { understanding: 1 }, { understanding: 1, application: 1 },
    ];
    let compared = 0;
    let strictlyBetter = 0;
    for (const difficulty of DIFFICULTIES) {
      for (const sup of mixes) {
        const sigma = Object.values(sup).reduce((a, b) => a + (b ?? 0), 0);
        for (const total of [3, 4, 5, 6, 7, 8, 10, 20]) {
          if (total <= sigma) continue;
          const where = `${difficulty} ${JSON.stringify(sup)} x${total}`;
          const aware = whole(allocateQuestions(total, difficulty, sup), sup);
          const unaware = whole(allocateQuestions(total - sigma, difficulty), sup);
          assert.ok(atLeastTwo(aware) >= atLeastTwo(unaware), `${where}: >=2 ${aware} vs ${unaware}`);
          assert.ok(exactlyOne(aware) <= exactlyOne(unaware), `${where}: =1 ${aware} vs ${unaware}`);
          compared += 1;
          if (atLeastTwo(aware) > atLeastTwo(unaware) || exactlyOne(aware) < exactlyOne(unaware)) strictlyBetter += 1;
        }
      }
    }
    assert.ok(compared >= 80);
    assert.ok(strictlyBetter >= 30, `the rule must actually improve small papers (${strictlyBetter})`);
  });
});

describe("remainingQuota", () => {
  const quota = (o: Partial<Record<CompetencyKey, number>>) =>
    Object.fromEntries(COMPETENCY_KEYS.map(k => [k, o[k] ?? 0])) as Record<CompetencyKey, number>;
  const wrote = (...keys: CompetencyKey[]) => keys.map(competencyKey => ({ competencyKey }));
  const total = (c: Record<CompetencyKey, number>) => COMPETENCY_KEYS.reduce((s, k) => s + c[k], 0);

  it("is unchanged when nothing was written and missing is the original total", () => {
    const q = quota({ knowledge: 1, understanding: 2, application: 3, critical_thinking: 2 });
    assert.deepEqual(remainingQuota(q, [], 8), q);
  });

  it("subtracts what the model already wrote, per competency", () => {
    const q = quota({ knowledge: 2, understanding: 3, application: 3, critical_thinking: 2 });
    // 10 asked, 4 written (2 knowledge, 1 understanding, 1 application): 6 missing.
    assert.deepEqual(
      remainingQuota(q, wrote("knowledge", "knowledge", "understanding", "application"), 6),
      quota({ understanding: 2, application: 2, critical_thinking: 2 }),
    );
  });

  it("floors at zero when the model wrote more of a competency than its quota, and still sums to missing", () => {
    const q = quota({ knowledge: 1, understanding: 3, application: 3, critical_thinking: 1 });
    // Three knowledge written against a quota of 1: two over, floored at zero.
    const out = remainingQuota(q, wrote("knowledge", "knowledge", "knowledge"), 5);
    assert.equal(out.knowledge, 0);
    assert.equal(total(out), 5);
    assert.ok(COMPETENCY_KEYS.every(k => out[k] >= 0));
  });

  it("reduces the largest entries one at a time when the remainder is over missing", () => {
    const q = quota({ knowledge: 1, understanding: 4, application: 4, critical_thinking: 1 });
    // Nothing written but only 7 missing (e.g. the first batch was trimmed): drop 3 from the biggest.
    const out = remainingQuota(q, [], 7);
    assert.equal(total(out), 7);
    assert.deepEqual(out, quota({ knowledge: 1, understanding: 2, application: 3, critical_thinking: 1 }));
  });

  it("adds to the largest remaining entry, ties by competency order, when under missing", () => {
    const q = quota({ understanding: 2, application: 2 });
    const out = remainingQuota(q, [], 5);
    assert.equal(total(out), 5);
    assert.deepEqual(out, quota({ understanding: 3, application: 2 }));
    // Nothing left anywhere: the first competency in order takes it.
    assert.deepEqual(remainingQuota(quota({}), [], 2), quota({ knowledge: 2 }));
  });

  it("gives all zeros when nothing is missing", () => {
    const q = quota({ knowledge: 2, understanding: 2 });
    assert.deepEqual(remainingQuota(q, wrote("knowledge"), 0), quota({}));
    assert.deepEqual(remainingQuota(q, [], 0), quota({}));
  });

  it("always sums to missing and is never negative (exhaustive over small cases)", () => {
    const base = quota({ knowledge: 2, understanding: 3, application: 3, critical_thinking: 2 });
    const n = total(base);
    for (let writtenCount = 0; writtenCount <= n; writtenCount += 1) {
      for (let seed = 0; seed < 12; seed += 1) {
        const written = Array.from({ length: writtenCount }, (_, i) => ({
          competencyKey: COMPETENCY_KEYS[(i * (seed + 1) + seed) % COMPETENCY_KEYS.length]!,
        }));
        const missing = n - writtenCount;
        const out = remainingQuota(base, written, missing);
        assert.equal(total(out), missing, `written=${writtenCount} seed=${seed}`);
        assert.ok(COMPETENCY_KEYS.every(k => out[k] >= 0 && Number.isInteger(out[k])));
      }
    }
  });

  it("does not mutate its input", () => {
    const q = quota({ knowledge: 2, understanding: 2 });
    const copy = { ...q };
    remainingQuota(q, wrote("knowledge"), 3);
    assert.deepEqual(q, copy);
  });
});
