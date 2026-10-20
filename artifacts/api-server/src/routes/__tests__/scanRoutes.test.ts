/**
 * The two exam-scan routes write nothing, and guard their model call.
 *
 * Route files import the database and the OpenAI client at module scope, which
 * `node --test` cannot load (see the note in studentLessonExplanation.test.ts),
 * so this reads the source. What it proves is textual: the handlers contain no
 * write and check live mode, budget and quota *before* the model is called. How
 * a request actually behaves is covered by the pure-function tests next to the
 * modules (`scanRequest`, `scanPaper`, `studentMatch`) and by mountOrder.test.ts.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const source = readFileSync(path.resolve(here, "../evaluations.ts"), "utf8");

/** From a route's declaration to the next route, helper or EOF. */
function handler(opening: string): string {
  const start = source.indexOf(opening);
  assert.notEqual(start, -1, `${opening} is not declared in routes/evaluations.ts`);
  const rest = source.slice(start + opening.length);
  const next = rest.search(/\nrouter\.(get|post|put|patch|delete)\(|\nasync function |\nfunction /);
  return next === -1 ? rest : rest.slice(0, next);
}

const ROUTES = {
  "POST /evaluations/scan-paper": handler('router.post("/evaluations/scan-paper"'),
  "POST /evaluations/:id/scan-class-paper": handler('"/evaluations/:id/scan-class-paper"'),
};

for (const [name, body] of Object.entries(ROUTES)) {
  describe(name, () => {
    it("writes nothing — no insert, update or delete", () => {
      assert.doesNotMatch(body, /\.(insert|update|delete)\(/);
    });

    it("says in its response that nothing was saved", () => {
      assert.match(body, /saved: false/);
    });

    it("is rate limited", () => {
      assert.match(body, /scanLimiter/);
    });

    it("checks live mode, budget and quota before the model is called", () => {
      const call = body.indexOf("openai.chat.completions.create(");
      assert.notEqual(call, -1, "no model call found");
      for (const guard of ["assertLiveModeEnabled(", "assertBudgetAvailable(", "assertUserQuotaAvailable("]) {
        const at = body.indexOf(guard);
        assert.ok(at !== -1 && at < call, `${guard} must come before the model call`);
      }
    });

    it("records the spend with a prompt version", () => {
      assert.match(body, /recordUsage\(/);
      assert.match(body, /promptVersion: "scan-(paper|class-paper)-1"/);
    });
  });
}

describe("route-specific refusals", () => {
  it("scan-paper validates its body and resolves the objectives against the curriculum", () => {
    const body = ROUTES["POST /evaluations/scan-paper"];
    assert.match(body, /parsePaperScanBody\(/);
    assert.match(body, /resolveObjectiveIds\(/);
  });

  it("scan-class-paper is owner-only, published-only, and checks the photo", () => {
    const body = ROUTES["POST /evaluations/:id/scan-class-paper"];
    assert.match(body, /ownedEvaluation\(/);
    assert.match(body, /classScanGate\(/);
    assert.match(body, /checkScanImage\(/);
  });

  it("scan-class-paper never sends the roster to the model", () => {
    const body = ROUTES["POST /evaluations/:id/scan-class-paper"];
    const call = body.indexOf("openai.chat.completions.create(");
    const model = body.slice(call, body.indexOf("});", call));
    assert.doesNotMatch(model, /roster/);
  });
});
