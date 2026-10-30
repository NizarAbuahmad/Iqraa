import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";

import { s3Env, startS3Stub, type S3Stub } from "../s3Stub.ts";

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4, 5, 6, 7, 8]);

describe("the S3 stub, driven by the real r2.ts", () => {
  let stub: S3Stub;
  let r2: typeof import("../../lib/r2.ts");

  before(async () => {
    // A page size of 3 so a handful of objects is enough to force several list requests.
    stub = await startS3Stub("iqraa-media", { pageSize: 3 });
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

  describe("listObjects", () => {
    const T0 = new Date("2026-01-02T03:04:05.000Z");
    const keyOf = (i: number) => `list-test/p/${String(i).padStart(2, "0")}.png`;

    it("returns only keys under the prefix, in key order, with the lastModified that was set", async () => {
      await stub.putForTest("list-test/other/x.png", PNG, T0);
      for (let i = 0; i < 3; i++) await stub.putForTest(keyOf(i), PNG, new Date(T0.getTime() + i * 1000));
      const { objects, truncated } = await r2.listObjects("list-test/p/");
      assert.equal(truncated, false);
      assert.deepEqual(
        objects.map(o => o.key),
        [keyOf(0), keyOf(1), keyOf(2)],
      );
      assert.deepEqual(
        objects.map(o => o.lastModified.toISOString()),
        [0, 1, 2].map(i => new Date(T0.getTime() + i * 1000).toISOString()),
      );
      assert.equal(stub.lastModified(keyOf(1))?.getTime(), T0.getTime() + 1000);
      assert.deepEqual((await r2.listObjects("list-test/nothing/")).objects, []);
    });

    it("stamps a normal PUT with the current time", async () => {
      const before = Date.now();
      await r2.putObject("list-test/now/a.png", PNG, "image/png");
      const { objects } = await r2.listObjects("list-test/now/");
      assert.equal(objects.length, 1);
      // S3 timestamps carry whole seconds only.
      assert.ok(objects[0]!.lastModified.getTime() >= before - 1000);
      assert.ok(objects[0]!.lastModified.getTime() <= Date.now() + 1000);
    });

    it("pages through every object when the bucket answers a few at a time", async () => {
      for (let i = 3; i < 7; i++) await stub.putForTest(keyOf(i), PNG, T0);
      const requestsBefore = stub.listRequests();
      const { objects, truncated } = await r2.listObjects("list-test/p/");
      assert.equal(truncated, false);
      assert.deepEqual(
        objects.map(o => o.key),
        [0, 1, 2, 3, 4, 5, 6].map(keyOf),
      );
      // 7 objects, 3 per page: pages of 3, 3 and 1.
      assert.equal(stub.listRequests() - requestsBefore, 3);
    });

    it("stops at maxKeys and says it truncated", async () => {
      const { objects, truncated } = await r2.listObjects("list-test/p/", { maxKeys: 5 });
      assert.equal(truncated, true);
      assert.deepEqual(
        objects.map(o => o.key),
        [0, 1, 2, 3, 4].map(keyOf),
      );
    });

    it("does not call it truncated when maxKeys equals what exists", async () => {
      const { objects, truncated } = await r2.listObjects("list-test/p/", { maxKeys: 7 });
      assert.equal(objects.length, 7);
      assert.equal(truncated, false);
    });

    it("refuses an empty prefix, so the whole bucket cannot be listed by accident", async () => {
      const requestsBefore = stub.listRequests();
      await assert.rejects(() => r2.listObjects(""), /listObjects needs a prefix/);
      assert.equal(stub.listRequests(), requestsBefore, "must refuse before asking the bucket");
    });

    it("round-trips keys that need XML escaping", async () => {
      const keys = ["list-test/x/a&b.png", "list-test/x/c<d>.png", 'list-test/x/q"\'.png'];
      for (const k of keys) await stub.putForTest(k, PNG, T0);
      const { objects } = await r2.listObjects("list-test/x/");
      assert.deepEqual(objects.map(o => o.key), [...keys].sort());
    });
  });
});
