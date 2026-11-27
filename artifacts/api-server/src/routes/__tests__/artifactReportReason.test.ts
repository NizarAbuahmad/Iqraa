/**
 * The optional reason on a content report has to travel the whole way: the
 * request body -> the stored row -> the admin's email -> the admin's list.
 * A break anywhere keeps compiling (every link is optional) and just makes the
 * reason quietly vanish, which is exactly how it was missing before. The
 * routes cannot be imported under `node --test` (they load `@workspace/db` at
 * module scope), so this is a source scan: it proves the wiring is written,
 * not that Postgres stores it.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => readFileSync(path.resolve(here, rel), "utf8");

/** The text of the `/generate/variants/:id/retire` handler. */
function retireHandler(): string {
  const source = read("../generate.ts");
  const start = source.indexOf('generateRouter.post("/generate/variants/:id/retire"');
  assert.ok(start >= 0, "retire route not found");
  return source.slice(start);
}

describe("a report's reason reaches the admin", () => {
  it("the teacher route reads it from the body, normalised, and stores it", () => {
    const h = retireHandler();
    assert.match(h, /normalizeReportReason\(/);
    assert.match(h, /reportVariant\(\{[^}]*\breason\b[^}]*\}\)/);
  });

  it("the teacher route puts it in the admin notification", () => {
    assert.match(retireHandler(), /notifyAdminsOfArtifactReport\(\{[^}]*\breason\b[^}]*\}\)/);
  });

  it("the notification hands it to the email", () => {
    const source = read("../../lib/adminNotify.ts");
    assert.match(source, /sendArtifactReportedEmail\(a\.email, args\)/);
    assert.match(source, /reason\?: string/);
  });

  it("the store writes it into the row", () => {
    assert.match(read("../../lib/artifactCache.ts"), /reason: args\.reason \?\? ""/);
  });

  it("the admin list returns it", () => {
    const source = read("../moderation.ts");
    const list = source.slice(source.indexOf('"/moderation/artifact-reports"'));
    assert.match(list, /reason: aiArtifactReports\.reason/);
  });
});
