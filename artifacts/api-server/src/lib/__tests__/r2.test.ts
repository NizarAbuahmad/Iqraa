import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { newAvatarKey, publicUrl } from "../r2.ts";

const ORIGINAL_BASE_URL = process.env.R2_PUBLIC_BASE_URL;

beforeEach(() => {
  delete process.env.R2_PUBLIC_BASE_URL;
});

afterEach(() => {
  if (ORIGINAL_BASE_URL === undefined) delete process.env.R2_PUBLIC_BASE_URL;
  else process.env.R2_PUBLIC_BASE_URL = ORIGINAL_BASE_URL;
});

test("publicUrl composes the base URL and key", () => {
  process.env.R2_PUBLIC_BASE_URL = "https://pub-abc123.r2.dev";
  assert.equal(publicUrl("avatars/foo.jpg"), "https://pub-abc123.r2.dev/avatars/foo.jpg");
});

test("publicUrl strips a trailing slash from the base URL before joining", () => {
  process.env.R2_PUBLIC_BASE_URL = "https://pub-abc123.r2.dev/";
  assert.equal(publicUrl("avatars/foo.jpg"), "https://pub-abc123.r2.dev/avatars/foo.jpg");
});

test("publicUrl returns null when R2_PUBLIC_BASE_URL isn't set", () => {
  assert.equal(publicUrl("avatars/foo.jpg"), null);
});

test("newAvatarKey is namespaced under avatars/ and keeps the given extension", () => {
  const key = newAvatarKey(".jpg");
  assert.ok(key.startsWith("avatars/"));
  assert.ok(key.endsWith(".jpg"));
});
