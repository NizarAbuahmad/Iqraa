/**
 * What the verification endpoints answer, given whether the code email went out.
 *
 * Signup used to say "check your email" whether or not one was sent: a missing
 * RESEND_API_KEY, an unverified sender domain or a provider refusal reached only
 * the log, and the teacher waited on a code screen for a message that never
 * existed. The account is still created (the teacher can resend the code or fix
 * the address), so these stay 2xx and carry `emailSent` — except resend, where
 * the send is the whole request and its failure is a 503.
 *
 * Kept free of the database and the mail client so the decisions are testable.
 */

export interface RegisterBody {
  email: string;
  emailSent: boolean;
  message: string;
}

export function registerResponse(email: string, emailSent: boolean): RegisterBody {
  return {
    email,
    emailSent,
    message: emailSent
      ? "Account created. Check your email for a 6-digit verification code."
      : "Account created, but we could not send the verification email. Try resending the code, or check the address.",
  };
}

export interface ChangeEmailBody {
  email: string;
  emailSent: boolean;
  message: string;
}

export function changeEmailResponse(email: string, emailSent: boolean): ChangeEmailBody {
  return {
    email,
    emailSent,
    message: emailSent
      ? "A new code was sent to that address."
      : "The address was changed, but we could not send a code to it. Try resending the code.",
  };
}

export interface ResendResponse {
  status: number;
  body: Record<string, unknown>;
}

/**
 * `needsCode` is whether the address belongs to an unverified account — the only
 * case where a send is attempted. Every other case (unknown address, already
 * verified) answers the same 200 as a successful send, so the endpoint still
 * cannot be used to probe which addresses are registered. A failed send is only
 * ever reported for an account that exists, and `register` already says as much
 * with its 409 email_taken, so this adds no new way to learn that.
 */
export function resendResponse(needsCode: boolean, emailSent: boolean): ResendResponse {
  if (needsCode && !emailSent) {
    return {
      status: 503,
      body: { error: "We could not send the email right now. Try again shortly.", code: "email_unavailable" },
    };
  }
  return {
    status: 200,
    body: { ok: true, message: "If that email needs verifying, a new code was sent." },
  };
}
