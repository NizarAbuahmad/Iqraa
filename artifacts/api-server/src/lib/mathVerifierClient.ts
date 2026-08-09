/**
 * Client for the SymPy math-verifier microservice.
 * Latin x only — never send Arabic notation.
 */

/**
 * Render's `fromService` injects a bare "host:port" with no scheme, so the
 * env value is normalised here rather than assuming a well-formed URL.
 * Localhost defaults to http; anything else to https.
 */
function normaliseVerifierUrl(raw: string | undefined): string {
  const value = (raw ?? "").trim();
  if (!value) return "http://127.0.0.1:8090";
  if (/^https?:\/\//i.test(value)) return value.replace(/\/+$/, "");
  const isLocal = /^(localhost|127\.0\.0\.1)(:|$)/i.test(value);
  return `${isLocal ? "http" : "https"}://${value.replace(/\/+$/, "")}`;
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
