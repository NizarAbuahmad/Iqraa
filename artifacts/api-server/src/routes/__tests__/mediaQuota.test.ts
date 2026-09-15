/**
 * Reading the reason out of a failed YouTube search.
 *
 * Why this is worth a test at all: the route it serves answers `{ video: null }`
 * for every failure, and the deck skips its video slide either way. So an
 * exhausted daily quota, a disabled key and a topic with no embeddable results
 * are indistinguishable to every caller — the log line is the only place the
 * difference survives, and `reason` is the only field in it that separates
 * "wait until midnight Pacific" from "someone has to fix the key".
 *
 * Everything below is a way of not throwing. This runs on the error path of a
 * route whose contract is that a missing video is never an error, so turning
 * "no video today" into a 500 because the explanation would not parse is worse
 * than not logging at all.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { youtubeFailureReason } from "../media.ts";

/** Just the one method the helper touches. */
const body = (value: unknown): Pick<Response, "json"> =>
  ({ json: async () => value }) as Pick<Response, "json">;

const throws = (err: unknown): Pick<Response, "json"> =>
  ({ json: async () => { throw err; } }) as Pick<Response, "json">;

describe("youtubeFailureReason", () => {
  it("names a spent quota, which is the whole point of reading the body", async () => {
    assert.equal(
      await youtubeFailureReason(
        body({ error: { errors: [{ reason: "quotaExceeded" }] } }),
      ),
      "quotaExceeded",
    );
  });

  it("distinguishes a broken key from a spent quota — both arrive as 403", async () => {
    // Nothing resets for this one; the status code alone cannot say so.
    assert.equal(
      await youtubeFailureReason(
        body({ error: { errors: [{ reason: "keyInvalid" }] } }),
      ),
      "keyInvalid",
    );
  });

  it("survives a body that is not the shape the docs promise", async () => {
    assert.equal(await youtubeFailureReason(body({})), undefined);
    assert.equal(await youtubeFailureReason(body({ error: {} })), undefined);
    assert.equal(await youtubeFailureReason(body({ error: { errors: [] } })), undefined);
    assert.equal(await youtubeFailureReason(body({ error: { errors: [{}] } })), undefined);
    assert.equal(await youtubeFailureReason(body(null)), undefined);
  });

  it("returns undefined rather than a non-string reason", async () => {
    // Guards the log line's own shape: `reason` is compared against a string
    // literal and printed, and a nested object there would be neither.
    assert.equal(
      await youtubeFailureReason(body({ error: { errors: [{ reason: { code: 403 } }] } })),
      undefined,
    );
  });

  it("does not throw when the body is not JSON at all", async () => {
    // A proxy or an edge outage answers 403 with HTML. This is the case that
    // would otherwise turn a skipped video slide into a 500.
    assert.equal(
      await youtubeFailureReason(throws(new SyntaxError("Unexpected token < in JSON"))),
      undefined,
    );
  });
});
