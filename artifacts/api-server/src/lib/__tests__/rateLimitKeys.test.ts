/**
 * What this guards: the per-address rate limit is only a limit if every
 * spelling of one address lands in the same bucket. Without the normalisation,
 * holding the shift key would buy a fresh allowance — and nothing would fail,
 * the limit would just quietly stop limiting.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { emailKey } from "../rateLimitKeys.ts";

describe("emailKey", () => {
  it("folds case and surrounding whitespace into one bucket", () => {
    const expected = "teacher@school.jo";
    for (const email of [
      "teacher@school.jo",
      "Teacher@School.jo",
      "TEACHER@SCHOOL.JO",
      "  teacher@school.jo  ",
      "\tTeacher@School.jo\n",
    ]) {
      assert.equal(emailKey({ body: { email } }), expected, email);
    }
  });

  it("keeps different addresses in different buckets", () => {
    assert.notEqual(
      emailKey({ body: { email: "a@school.jo" } }),
      emailKey({ body: { email: "b@school.jo" } }),
    );
  });

  it("gives everything unusable one shared bucket", () => {
    // A body these routes would reject anyway — the bucket only has to be
    // stable, so malformed traffic cannot mint a new one per request.
    for (const body of [
      undefined,
      {},
      { email: "" },
      { email: "   " },
      { email: 42 },
      { email: null },
      { email: { address: "a@b.jo" } },
      { email: ["a@b.jo"] },
    ]) {
      assert.equal(emailKey({ body }), "no-email", JSON.stringify(body));
    }
  });
});
