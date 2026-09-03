/**
 * Client for the SymPy math-verifier microservice.
 * Latin x only — never send Arabic notation.
 */

/**
 * Render's `fromService ... property: hostport` injects a bare "host:port" with
 * no scheme, so the env value is normalised here rather than assuming a
 * well-formed URL.
 *
 * The scheme is chosen by whether the host is a public name or an internal one.
 * This distinction is the whole point: `fromService` yields Render's *internal*
 * address — `iqraa-verifier:10000` — and Render's private network serves plain
 * HTTP on that port. The previous rule was "localhost is http, everything else
 * is https", which sent a TLS handshake to a non-TLS port and failed instantly
 * with `client_error:fetch failed`. That is indistinguishable, from the app's
 * side, from the verifier not existing — and it cost three days of believing
 * exactly that.
 *
 * A hostname with no dot in it cannot be public DNS, so it is an internal
 * Render (or Docker/Kubernetes) service name and speaks http.
 */
export function normaliseVerifierUrl(raw: string | undefined): string {
  const value = (raw ?? "").trim();
  if (!value) return "http://127.0.0.1:8090";
  if (/^https?:\/\//i.test(value)) return value.replace(/\/+$/, "");

  const trimmed = value.replace(/\/+$/, "");
  const host = trimmed.split("/")[0]!.split(":")[0]!;
  const isLoopback = /^(localhost|127\.0\.0\.1|\[::1\])$/i.test(host);
  // No dot ⇒ not a public domain ⇒ an internal service name.
  const isInternal = isLoopback || !host.includes(".");
  return `${isInternal ? "http" : "https"}://${trimmed}`;
}

const DEFAULT_URL = normaliseVerifierUrl(process.env.MATH_VERIFIER_URL);
/**
 * Budget for one API→verifier call, sized to survive a cold start.
 *
 * Measured 2026-09-03 against the Cloud Run verifier after ~45 min idle:
 * **4.59s cold, 0.60s warm.** At the old 2.5s every first request after an
 * idle period aborted before the container finished booting — the keys came
 * back unchecked and the badges silently showed nothing, which is exactly
 * the failure this value exists to prevent.
 *
 * 8s is that 4.59 plus room, not a guess. It is deliberately not higher:
 * `verifyAnswerKeys` blocks evaluation generation, so this is time a teacher
 * waits. The cost is bounded — the first unreachable result sets
 * `verifierDown` and every remaining question short-circuits, so a paper pays
 * this once, never per question.
 *
 * On Render (51s cold) 8s still cannot win; it only fails slower. That is
 * accepted: the number is sized for where the service is going, and the
 * short-circuit keeps the regression to one call.
 */
const VERIFY_TIMEOUT_MS = 8_000;

export type VerifyResult = {
  verified: boolean;
  computed_answer: string | null;
  error?: string | null;
  rejected?: { value: string; reason: string }[] | null;
};

export async function verifyDerivative(
  question: string,
  answer: string,
  topic = "derivative_polynomial",
  distractors?: { value: string; misconception?: string }[],
): Promise<VerifyResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), VERIFY_TIMEOUT_MS);
  try {
    const res = await fetch(`${DEFAULT_URL}/verify/derivative`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question, answer, topic, distractors }),
      signal: controller.signal,
    });
    if (!res.ok) {
      return {
        verified: false,
        computed_answer: null,
        error: `http_${res.status}`,
      };
    }
    return (await res.json()) as VerifyResult;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      verified: false,
      computed_answer: null,
      error: msg.includes("abort") ? "timeout" : `client_error:${msg}`,
    };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * SymPy's verdict on a proposed answer KEY.
 *
 * Three-way on purpose. `verified: boolean` is the right shape for
 * `verifyDerivative`, whose caller asks "may this item claim a badge?" — there,
 * "wrong" and "could not tell" both mean no badge. A key check's caller
 * **deletes a question the teacher was about to get**, so the two must arrive
 * apart: only `distinct` is evidence against the key.
 */
export type KeyRelation =
  | "equivalent"
  | "distinct"
  | "indeterminate"
  | "error"
  | "unsupported_topic";

export type KeyRelationResult = {
  relation: KeyRelation;
  computed_answer: string | null;
  error?: string | null;
};

export async function relateAnswerKey(
  topic: string,
  question: string,
  answer: string,
): Promise<KeyRelationResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), VERIFY_TIMEOUT_MS);
  try {
    const res = await fetch(`${DEFAULT_URL}/verify/answer-key`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topic, question, answer }),
      signal: controller.signal,
    });
    if (!res.ok) {
      return { relation: "error", computed_answer: null, error: `http_${res.status}` };
    }
    return (await res.json()) as KeyRelationResult;
  } catch (err) {
    // Never throws, like verifyDerivative: an unreachable verifier is a state
    // the caller must be able to read, not an exception that aborts a whole
    // generation. `isVerifierUnreachable` reads these same two strings.
    const msg = err instanceof Error ? err.message : String(err);
    return {
      relation: "error",
      computed_answer: null,
      error: msg.includes("abort") ? "timeout" : `client_error:${msg}`,
    };
  } finally {
    clearTimeout(timer);
  }
}
