/**
 * Flags that decide what exists in a given deployment.
 *
 * Read at call time, not at module load: an env var captured into a const at
 * import time cannot be changed without a restart, and every test that wants
 * the other branch has to reach into the module registry to get it.
 */

/**
 * Whether parents and students may hold accounts at all.
 *
 * **Off unless explicitly enabled**, and that default is the decision, not a
 * placeholder. A student account is an account for a minor, and the consent
 * story around one is a legal posture rather than a feature: it needs a
 * lawyer's read of Jordan's Personal Data Protection Law and a store
 * declaration that matches. Version 1 ships teacher-only so the first
 * submission does not have to answer any of that.
 *
 * Turning it on is one environment variable, `STUDENT_ACCOUNTS=true`, because
 * the code is written and tested — see `routes/messaging.ts`, the claim flow
 * in `lib/rosterClaim.ts`, and the moderation queue that exists for exactly
 * the user-to-user content this gate currently prevents.
 *
 * Note what switching it off also switches off: with no parent or student
 * accounts, no chat thread can be created at all — `createDirectThread`
 * requires a teacher on one side and a parent or student on the other, and a
 * class group needs members. Messaging is inert in v1 rather than merely
 * hidden, which is the honest thing to be able to tell App Review when asked
 * whether the app carries user-generated content.
 */
export function studentAccountsEnabled(): boolean {
  return process.env.STUDENT_ACCOUNTS === "true";
}

/**
 * Whether a student account may talk to the AI assistant (`POST /chat`).
 *
 * **Off unless explicitly enabled** — owner decision, 2026-10-05: no AI chat
 * for students for now. A student is a minor, and a free-text model that
 * answers a child is its own review (what it may say, what is logged, whose
 * allowance pays), not a side effect of having a student account.
 *
 * The app never offered it — the iQra tab is hidden from students — but the
 * route used to answer any signed-in role, so a student's client (or a
 * hand-built request) could reach it, and `mode: "student"` in the body even
 * had a prompt waiting. This is the server saying no, which a hidden tab is
 * not. Turning it back on is `STUDENT_CHAT=true`; the student prompt, the
 * `AI_STUDENT_BUDGET_USD` allowance and the usage kind are all still there.
 */
export function studentChatEnabled(): boolean {
  return process.env.STUDENT_CHAT === "true";
}

/** Whether this signed-in role may use `/chat` at all. Only students are gated. */
export function chatAllowedFor(role: string | undefined): boolean {
  return role === "student" ? studentChatEnabled() : true;
}
