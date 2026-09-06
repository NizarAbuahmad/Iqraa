/**
 * What this guards: which Google OAuth client IDs are accepted as an ID
 * token's audience.
 *
 * Both directions fail badly and quietly. Too few and every token from a
 * client that is not listed is rejected as invalid — which, during the move of
 * Google sign-in into the Firebase project, means signing out every existing
 * web user with a 401 that reads exactly like a mistyped password. Too many
 * and this server accepts tokens minted for an application that is not ours.
 *
 * The fallback matters as much as the parse: a deployment that has never heard
 * of `GOOGLE_CLIENT_IDS` must keep behaving exactly as it did.
 */
import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";

import { googleClientIds, parseGoogleClientIds } from "../googleClients.ts";

const WEB = "613126375862-0c87bf77b1gv5bh92ibrt1ret09irtlu.apps.googleusercontent.com";
const ANDROID = "784063967007-androidexample.apps.googleusercontent.com";

const originals = {
  many: process.env.GOOGLE_CLIENT_IDS,
  one: process.env.GOOGLE_CLIENT_ID,
};

afterEach(() => {
  for (const [key, value] of [
    ["GOOGLE_CLIENT_IDS", originals.many],
    ["GOOGLE_CLIENT_ID", originals.one],
  ] as const) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

describe("parseGoogleClientIds", () => {
  it("accepts several, in order", () => {
    assert.deepEqual(parseGoogleClientIds(`${WEB},${ANDROID}`, undefined), [WEB, ANDROID]);
  });

  it("accepts one", () => {
    assert.deepEqual(parseGoogleClientIds(WEB, undefined), [WEB]);
  });

  it("tolerates the whitespace a human pastes into a console", () => {
    assert.deepEqual(parseGoogleClientIds(`  ${WEB} ,  ${ANDROID}  `, undefined), [WEB, ANDROID]);
  });

  it("drops empties rather than accepting an empty audience", () => {
    // A trailing comma is the most likely typo, and an empty string in the
    // audience array is not a harmless no-op to google-auth-library.
    assert.deepEqual(parseGoogleClientIds(`${WEB},,`, undefined), [WEB]);
    assert.deepEqual(parseGoogleClientIds(",", undefined), []);
  });

  it("de-duplicates, so listing the same id twice is not a different audience", () => {
    assert.deepEqual(parseGoogleClientIds(`${WEB},${WEB}`, undefined), [WEB]);
  });

  it("falls back to GOOGLE_CLIENT_ID when the list is unset or empty", () => {
    // The whole point: an existing deployment that never sets the new variable
    // must behave exactly as it did before.
    assert.deepEqual(parseGoogleClientIds(undefined, WEB), [WEB]);
    assert.deepEqual(parseGoogleClientIds("", WEB), [WEB]);
    assert.deepEqual(parseGoogleClientIds("  ", WEB), [WEB]);
  });

  it("prefers the list over the single value when both are set", () => {
    assert.deepEqual(parseGoogleClientIds(`${WEB},${ANDROID}`, "ignored"), [WEB, ANDROID]);
  });

  it("reports nothing configured when neither is set", () => {
    // Empty is what makes /auth/google answer 503 rather than 401.
    assert.deepEqual(parseGoogleClientIds(undefined, undefined), []);
    assert.deepEqual(parseGoogleClientIds("", ""), []);
  });
});

describe("googleClientIds", () => {
  it("reads the environment at call time", () => {
    delete process.env.GOOGLE_CLIENT_IDS;
    delete process.env.GOOGLE_CLIENT_ID;
    assert.deepEqual(googleClientIds(), []);

    process.env.GOOGLE_CLIENT_ID = WEB;
    assert.deepEqual(googleClientIds(), [WEB]);

    process.env.GOOGLE_CLIENT_IDS = `${WEB},${ANDROID}`;
    assert.deepEqual(googleClientIds(), [WEB, ANDROID]);
  });
});
