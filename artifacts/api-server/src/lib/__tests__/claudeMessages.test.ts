/**
 * OpenAI-shaped messages in, a Claude request out.
 *
 * Run:
 *   node --experimental-strip-types --test \
 *     artifacts/api-server/src/lib/__tests__/claudeMessages.test.ts
 *
 * Why it exists: chat, exams and the photo-marking routes build their prompts in
 * OpenAI's chat shape (a `system` message, `image_url` parts). When OpenAI
 * refuses the account, the same prompt is sent to Claude, whose API keeps the
 * system text outside `messages` and takes images as `source` blocks. A wrong
 * conversion would not throw — it would send a different prompt — so it is
 * pinned here.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { toClaudeRequest, UnsupportedImageError, type AiMessage } from "../claudeMessages.ts";

describe("toClaudeRequest — system text", () => {
  it("moves system messages out of the list, in order, joined by a blank line", () => {
    const out = toClaudeRequest([
      { role: "system", content: "You are a tutor." },
      { role: "user", content: "مرحبا" },
      { role: "system", content: "Answer in Arabic." },
    ]);
    assert.equal(out.system, "You are a tutor.\n\nAnswer in Arabic.");
    assert.deepEqual(out.messages, [{ role: "user", content: "مرحبا" }]);
  });

  it("gives an empty system string when there is none", () => {
    const out = toClaudeRequest([{ role: "user", content: "hi" }]);
    assert.equal(out.system, "");
  });
});

describe("toClaudeRequest — history", () => {
  it("keeps user and assistant turns, in order", () => {
    const history: AiMessage[] = [
      { role: "system", content: "S" },
      { role: "user", content: "q1" },
      { role: "assistant", content: "a1" },
      { role: "user", content: "q2" },
    ];
    assert.deepEqual(toClaudeRequest(history).messages, [
      { role: "user", content: "q1" },
      { role: "assistant", content: "a1" },
      { role: "user", content: "q2" },
    ]);
  });

  it("drops an empty message: Claude rejects an empty text block, OpenAI did not mind", () => {
    const out = toClaudeRequest([
      { role: "user", content: "q1" },
      { role: "assistant", content: "" },
      { role: "user", content: [{ type: "text", text: "" }] },
      { role: "user", content: "q2" },
    ]);
    assert.deepEqual(out.messages, [
      { role: "user", content: "q1" },
      { role: "user", content: "q2" },
    ]);
  });
});

describe("toClaudeRequest — photos", () => {
  const PNG = "data:image/png;base64,iVBORw0KGgo=";

  it("turns a data URL into a base64 image block, text part kept", () => {
    const out = toClaudeRequest([
      {
        role: "user",
        content: [
          { type: "text", text: "Read the marks." },
          { type: "image_url", image_url: { url: PNG } },
        ],
      },
    ]);
    assert.deepEqual(out.messages, [
      {
        role: "user",
        content: [
          { type: "text", text: "Read the marks." },
          { type: "image", source: { type: "base64", media_type: "image/png", data: "iVBORw0KGgo=" } },
        ],
      },
    ]);
  });

  it("accepts jpeg, gif and webp as well, and reads the type case-insensitively", () => {
    for (const [url, type] of [
      ["data:image/jpeg;base64,AAAA", "image/jpeg"],
      ["data:image/gif;base64,AAAA", "image/gif"],
      ["data:image/webp;base64,AAAA", "image/webp"],
      ["data:IMAGE/JPEG;base64,AAAA", "image/jpeg"],
    ] as const) {
      const block = (toClaudeRequest([{ role: "user", content: [{ type: "image_url", image_url: { url } }] }])
        .messages[0]!.content as any[])[0];
      assert.equal(block.source.media_type, type, url);
    }
  });

  it("sends an https URL as a url source", () => {
    const out = toClaudeRequest([
      { role: "user", content: [{ type: "image_url", image_url: { url: "https://example.com/a.png" } }] },
    ]);
    assert.deepEqual((out.messages[0]!.content as any[])[0], {
      type: "image",
      source: { type: "url", url: "https://example.com/a.png" },
    });
  });

  it("refuses an image Claude cannot read, naming it, rather than sending a broken request", () => {
    for (const url of ["data:image/heic;base64,AAAA", "data:image/svg+xml;base64,AAAA", "file:///etc/passwd", "not a url"]) {
      assert.throws(
        () => toClaudeRequest([{ role: "user", content: [{ type: "image_url", image_url: { url } }] }]),
        UnsupportedImageError,
        url,
      );
    }
  });

  it("refuses a data URL that is not base64", () => {
    assert.throws(
      () => toClaudeRequest([{ role: "user", content: [{ type: "image_url", image_url: { url: "data:image/png,rawbytes" } }] }]),
      UnsupportedImageError,
    );
  });
});
