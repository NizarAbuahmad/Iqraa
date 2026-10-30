import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";

import { s3Env, startS3Stub, type S3Stub } from "../s3Stub.ts";

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4, 5, 6, 7, 8]);

describe("the S3 stub, driven by the real r2.ts", () => {
  let stub: S3Stub;
  let r2: typeof import("../../lib/r2.ts");

  before(async () => {
    stub = await startS3Stub();
    // r2.ts caches its client on first use, so the env must be in place before the first call.
    Object.assign(process.env, s3Env(stub));
    r2 = await import("../../lib/r2.ts");
  });
  after(async () => {
    await stub.close();
  });

  it("builds an unguessable key under the homework-submissions prefix", () => {
    const key = r2.newHomeworkSubmissionKey("11111111-1111-4111-8111-111111111111", "22222222-2222-4222-8222-222222222222", ".png");
    assert.match(
      key,
      /^homework-submissions\/11111111-1111-4111-8111-111111111111\/22222222-2222-4222-8222-222222222222\/[0-9a-f-]{36}\.png$/,
    );
    assert.notEqual(key, r2.newHomeworkSubmissionKey("11111111-1111-4111-8111-111111111111", "22222222-2222-4222-8222-222222222222", ".png"));
  });

  it("stores exactly the bytes it was given, signs a readable URL, and deletes", async () => {
    assert.equal(r2.isR2Configured(), true);
    await r2.putObject("homework-submissions/t/s/a.png", PNG, "image/png");
    assert.deepEqual(stub.keys(), ["homework-submissions/t/s/a.png"]);
    assert.ok(stub.body("homework-submissions/t/s/a.png")!.equals(PNG), "stored bytes must equal the upload");

    const url = await r2.presignedGetUrl("homework-submissions/t/s/a.png", 600);
    assert.ok(url, "a signed URL");
    assert.match(url!, /X-Amz-Expires=600/);
    const res = await fetch(url!);
    assert.equal(res.status, 200);
    assert.ok(Buffer.from(await res.arrayBuffer()).equals(PNG));

    await r2.deleteObject("homework-submissions/t/s/a.png");
    assert.deepEqual(stub.keys(), []);
  });
});
