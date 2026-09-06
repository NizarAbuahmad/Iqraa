/** Fields that only mean something when a verifier or a reviewed bank supplied them. */
const UNEARNED_VERIFICATION_FIELDS = ["verified", "verifiedBy", "computedAnswer"] as const;

/**
 * Forces every self-check answer on a live explainer to say it was generated.
 *
 * `SelfCheckItem.answerSource` records HOW an answer was established:
 * `'bank'` means it came from the hand-authored concrete bank,
 * `'curriculum'` means it was quoted from the lesson's own key terms, and
 * `'generated'` means a model wrote it and nothing checked it. Only the
 * offline generator can honestly claim the first two — it draws from those
 * sources directly. A live model has no access to either, but a model handed a
 * JSON shape with an `answerSource` field will cheerfully fill in `"bank"`,
 * because the shape invites it. The reader then sees an answer that claims a
 * provenance it does not have.
 *
 * Applied on the way OUT, to pooled and fresh artifacts alike, for the same
 * reason `stripUnearnedVerification` is: what gets stored in `ai_artifacts` is
 * the model's own output, so a claim left in place is re-served to every
 * teacher who asks for that lesson, forever. Stamping at write time only would
 * miss everything already in the pool.
 *
 * Same immutable-copy shape as `stripUnearnedVerification` in
 * `classroomPrompts.ts`.
 */
export function stampGeneratedAnswerSource(content: unknown): unknown {
  if (content === null || typeof content !== "object" || Array.isArray(content)) {
    return content;
  }
  const artifact = content as Record<string, unknown>;
  const checks = artifact.checks;
  if (!Array.isArray(checks)) return content;

  const out = checks.map((raw) => {
    if (raw === null || typeof raw !== "object" || Array.isArray(raw)) return raw;
    const check = { ...(raw as Record<string, unknown>) };
    for (const field of UNEARNED_VERIFICATION_FIELDS) delete check[field];
    // Only an answer can carry a provenance. An open question with no answer
    // gets no label rather than a label saying a model generated nothing.
    if (typeof check.answer === "string" && check.answer.trim() !== "") {
      check.answerSource = "generated";
    } else {
      delete check.answerSource;
    }
    return check;
  });

  return { ...artifact, checks: out };
}
