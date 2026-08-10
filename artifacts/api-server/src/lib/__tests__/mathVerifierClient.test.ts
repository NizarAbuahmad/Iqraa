/**
 * What these guard: the scheme chosen for MATH_VERIFIER_URL.
 *
 * Render's blueprint wires this with `fromService ... property: hostport`,
 * which yields an internal address like `iqraa-verifier:10000`. Render's
 * private network serves plain HTTP there. The original rule — "localhost is
 * http, anything else is https" — upgraded that to https, opened a TLS
 * handshake against a non-TLS port, and failed immediately with
 * `client_error:fetch failed`.
 *
 * From the app's side that is indistinguishable from the verifier not being
 * deployed, which is what everyone concluded for three days while the service
 * sat healthy and idle. A wrong scheme must never be able to masquerade as a
 * missing service again.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { normaliseVerifierUrl } from "../mathVerifierClient.ts";

describe("normaliseVerifierUrl", () => {
  it("uses http for a Render internal host:port", () => {
    // The exact value the blueprint produces. This is the regression.
    assert.equal(normaliseVerifierUrl("iqraa-verifier:10000"), "http://iqraa-verifier:10000");
  });

  it("uses http for an internal name with no port", () => {
    assert.equal(normaliseVerifierUrl("iqraa-verifier"), "http://iqraa-verifier");
  });

  it("uses https for a public hostname", () => {
    // A dot means public DNS, which on Render means TLS.
    assert.equal(
      normaliseVerifierUrl("iqraa-verifier.onrender.com"),
      "https://iqraa-verifier.onrender.com",
    );
  });

  it("leaves an explicit scheme alone, in either direction", () => {
    // An operator who typed a scheme meant it. Overriding it would make the
    // dashboard lie about what the service is doing.
    assert.equal(
      normaliseVerifierUrl("https://iqraa-verifier.onrender.com"),
      "https://iqraa-verifier.onrender.com",
    );
    assert.equal(normaliseVerifierUrl("http://verifier.internal:9000"), "http://verifier.internal:9000");
  });

  it("keeps loopback on http", () => {
    assert.equal(normaliseVerifierUrl("localhost:8090"), "http://localhost:8090");
    assert.equal(normaliseVerifierUrl("127.0.0.1:8090"), "http://127.0.0.1:8090");
  });

  it("falls back to local dev when unset or blank", () => {
    assert.equal(normaliseVerifierUrl(undefined), "http://127.0.0.1:8090");
    assert.equal(normaliseVerifierUrl("   "), "http://127.0.0.1:8090");
  });

  it("strips trailing slashes so paths do not double up", () => {
    // The caller appends "/verify/derivative"; a trailing slash here yields
    // "//verify/derivative", which some routers 404.
    assert.equal(
      normaliseVerifierUrl("https://iqraa-verifier.onrender.com/"),
      "https://iqraa-verifier.onrender.com",
    );
    assert.equal(normaliseVerifierUrl("iqraa-verifier:10000//"), "http://iqraa-verifier:10000");
  });
});
