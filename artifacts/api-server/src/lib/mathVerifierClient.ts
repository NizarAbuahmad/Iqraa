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
const VERIFY_TIMEOUT_MS = 2_500;

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
