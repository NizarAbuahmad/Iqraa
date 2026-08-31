/**
 * The two questions this decides are the ones the whole caching design rests
 * on: does this teacher get an artifact somebody already paid for, and does a
 * regenerate ever hand back what they are already looking at.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { decideServe, type DecideArgs } from "../variantPolicy.ts";
import type { PooledArtifact } from "../artifactCache.ts";

const variant = (id: string, variantIndex: number, timesServed = 0): PooledArtifact => ({
  id, variantIndex, timesServed, content: { title: `variant ${variantIndex}` },
});

const args = (over: Partial<DecideArgs> = {}): DecideArgs => ({
  variants: [],
  nextVariantIndex: 0,
  readable: true,
  seenIds: new Set<string>(),
  regenerate: false,
  shareable: true,
  poolMax: 5,
  ...over,
});

describe("decideServe — first request for a lesson", () => {
  it("generates variant 0 and stores it for everyone after", () => {
    const d = decideServe(args());
    assert.deepEqual(d, { action: "generate", variantIndex: 0, store: true });
  });

  it("stores nothing when the pool could not be read", () => {
    // The slot number would be a guess and the unique index would reject it.
    // Generating uncached is the old behaviour; pretending to store is not.
    const d = decideServe(args({ readable: false }));
    assert.equal(d.action === "generate" && d.store, false);
  });
});

describe("decideServe — a second teacher asking the same question", () => {
  it("is served the existing variant, for nothing", () => {
    const d = decideServe(args({ variants: [variant("a", 0)], nextVariantIndex: 1 }));
    assert.equal(d.action, "serve");
    assert.equal(d.action === "serve" && d.artifact.id, "a");
  });

  it("takes the least-served variant, so a pool spreads across classes", () => {
    // Ordered least-served-first by readPool; the policy must not reorder it.
    const d = decideServe(args({
      variants: [variant("b", 1, 2), variant("a", 0, 9)],
      nextVariantIndex: 2,
    }));
    assert.equal(d.action === "serve" && d.artifact.id, "b");
  });
});

describe("decideServe — regenerate", () => {
  it("hands over a variant this teacher has not seen, at no cost", () => {
    const d = decideServe(args({
      variants: [variant("a", 0), variant("b", 1)],
      nextVariantIndex: 2,
      seenIds: new Set(["a"]),
      regenerate: true,
    }));
    assert.equal(d.action === "serve" && d.artifact.id, "b");
  });

  it("never returns the artifact the teacher is looking at", () => {
    const d = decideServe(args({
      variants: [variant("a", 0)],
      nextVariantIndex: 1,
      seenIds: new Set(["a"]),
      regenerate: true,
    }));
    assert.equal(d.action, "generate");
  });

  it("never generates into slot 0, even with no pool to count from", () => {
    // Slot 0 carries the neutral profile — the prompt that produced the
    // artifact being rejected. Steering a regeneration by nothing is how this
    // returned the same paper reworded in the first place.
    const d = decideServe(args({ readable: false, regenerate: true }));
    assert.equal(d.action === "generate" && d.variantIndex, 1);
  });

  it("keeps producing something new past the pool cap, and stops storing it", () => {
    const full = Array.from({ length: 5 }, (_, i) => variant(`v${i}`, i));
    const d = decideServe(args({
      variants: full,
      nextVariantIndex: 5,
      seenIds: new Set(full.map((v) => v.id)),
      regenerate: true,
      poolMax: 5,
    }));
    // The teacher is never told "no more variations"; the pool just stops growing.
    assert.equal(d.action, "generate");
    assert.equal(d.action === "generate" && d.store, false);
  });
});

describe("decideServe — a plain generate with nothing unseen left", () => {
  it("serves a seen variant rather than paying again", () => {
    // Asking the same question twice is not a complaint about the answer.
    const d = decideServe(args({
      variants: [variant("a", 0)],
      nextVariantIndex: 1,
      seenIds: new Set(["a"]),
      regenerate: false,
    }));
    assert.equal(d.action === "serve" && d.artifact.id, "a");
  });
});

describe("decideServe — teacher-supplied context", () => {
  it("is never served from the pool and never written to it", () => {
    // Serving teacher A's document-derived worksheet to teacher B is a content
    // leak, not a cache hit — so an unshareable request ignores a pool that
    // would otherwise have answered it.
    const d = decideServe(args({
      variants: [variant("a", 0)],
      nextVariantIndex: 1,
      shareable: false,
    }));
    assert.deepEqual(d, { action: "generate", variantIndex: 0, store: false });
  });

  it("still varies on regenerate, steered by the prompt alone", () => {
    const d = decideServe(args({ shareable: false, regenerate: true }));
    assert.equal(d.action === "generate" && d.variantIndex, 1);
    assert.equal(d.action === "generate" && d.store, false);
  });
});
