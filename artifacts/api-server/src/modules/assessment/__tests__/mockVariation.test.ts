/**
 * Regenerating an exam must not hand back the identical paper.
 *
 * The mock generator was fully deterministic — same request, same eight
 * questions, word for word — which reads as broken to the teacher pressing
 * "regenerate". Variation now comes from a seeded PRNG: phrasing variants per
 * competency and a shuffled objective order. The seed makes it honest both
 * ways: different by default, and exactly reproducible when the seed is
 * replayed (it is stored in `generationParams` for that).
 *
 * Nothing here may loosen the generator's contract: only mockable types, only
 * the requested objectives, the same competency allocation, no invented
 * subject content — the variants restate the objective, never extend it.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { getObjectivesForUnit } from "@workspace/curriculum";
import { generateMockEvaluation, type GenerationRequest } from "../mockGenerator.ts";
import { validateGenerated } from "../validator.ts";

const UNIT = "kbu-math-s1-nccd-u2";

function request(overrides: Partial<GenerationRequest> = {}): GenerationRequest {
  return {
    objectives: getObjectivesForUnit(UNIT).slice(0, 3),
    assessmentTypes: ["short_answer", "open_ended", "problem_solving"],
    count: 8,
    difficulty: "standard",
    ...overrides,
  };
}

/** The parts of a paper a teacher would compare: order, wording, keys. */
function fingerprint(result: ReturnType<typeof generateMockEvaluation>): string {
  return JSON.stringify(
    result.questions.map(q => [q.objectiveId, q.body["prompt"], q.expectedAnswer["modelAnswer"]]),
  );
}

describe("mock generation varies between runs", () => {
  it("two seeds produce two different papers", () => {
    const a = generateMockEvaluation(request({ seed: 1 }));
    const b = generateMockEvaluation(request({ seed: 2 }));
    assert.notEqual(fingerprint(a), fingerprint(b));
  });

  it("the same seed replays the exact paper — reproducibility is kept", () => {
    const a = generateMockEvaluation(request({ seed: 42 }));
    const b = generateMockEvaluation(request({ seed: 42 }));
    assert.equal(fingerprint(a), fingerprint(b));
  });

  it("an unseeded run draws its own seed and reports it", () => {
    const result = generateMockEvaluation(request());
    assert.ok(Number.isInteger(result.seed));
    const replay = generateMockEvaluation(request({ seed: result.seed }));
    assert.equal(fingerprint(result), fingerprint(replay));
  });

  it("reports the seed even when it declines to generate", () => {
    // The seed rides on generationParams; a refusal must not lose it.
    const declined = generateMockEvaluation(
      request({ assessmentTypes: ["multiple_choice"], seed: 7 }),
    );
    assert.equal(declined.questions.length, 0);
    assert.equal(declined.seed, 7);
    const empty = generateMockEvaluation(request({ objectives: [], seed: 7 }));
    assert.equal(empty.seed, 7);
  });
});

describe("variation does not loosen the contract", () => {
  const seeds = [0, 1, 2, 3, 99, 12345];

  it("keeps count, types, objectives and marks identical across seeds", () => {
    const reference = generateMockEvaluation(request({ seed: seeds[0] }));
    const shape = (r: typeof reference) =>
      JSON.stringify({
        count: r.questions.length,
        types: r.questions.map(q => q.type),
        competencies: r.questions.map(q => q.competencyKey),
        marks: r.questions.map(q => q.marks),
      });
    for (const seed of seeds) {
      const run = generateMockEvaluation(request({ seed }));
      assert.equal(shape(run), shape(reference), `seed ${seed} changed the paper's structure`);
      for (const q of run.questions) {
        assert.ok(
          request().objectives.some(o => o.id === q.objectiveId),
          `seed ${seed} produced a question outside the requested objectives`,
        );
      }
    }
  });

  it("still covers every requested objective when the count allows", () => {
    for (const seed of seeds) {
      const run = generateMockEvaluation(request({ seed }));
      const covered = new Set(run.questions.map(q => q.objectiveId));
      assert.equal(covered.size, request().objectives.length, `seed ${seed} skipped an objective`);
    }
  });

  it("every paper passes the same validation gate the route applies", () => {
    const req = request();
    for (const seed of seeds) {
      const run = generateMockEvaluation({ ...req, seed });
      const validation = validateGenerated(run.questions, {
        allowedObjectiveIds: req.objectives.map(o => o.id),
        allowedTypes: req.assessmentTypes,
      });
      assert.equal(
        validation.accepted.length,
        run.questions.length,
        `seed ${seed} produced a rejected question: ${JSON.stringify(validation.rejected)}`,
      );
    }
  });

  it("never repeats a stem word-for-word within one paper", () => {
    for (const seed of seeds) {
      const run = generateMockEvaluation(request({ seed }));
      const prompts = run.questions.map(q => q.body["prompt"]);
      assert.equal(new Set(prompts).size, prompts.length, `seed ${seed} duplicated a stem`);
    }
  });
});
