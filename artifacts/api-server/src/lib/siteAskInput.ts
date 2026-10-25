/**
 * Validation for POST /site/ask, kept pure so it can be tested without a DB.
 *
 * The route is public and a browser posts to it directly, so nothing in the
 * body is trusted. The caps are small on purpose: a question about a product is
 * a sentence, and every forwarded turn is re-sent as paid input.
 *
 * Over a cap is an error, not a truncation: cutting a question short would
 * answer something the visitor did not ask. `system` is never accepted from the
 * client — history comes from the browser, and a forged system or assistant
 * turn is the easy way to talk a model out of its rules (the prompt also ends
 * with a reminder for that reason; see siteAsk.ts).
 *
 * The bot's own earlier reply may be longer than a visitor's turn because the
 * widget sends those replies back as history.
 */
export const SITE_ASK_MESSAGE_MAX_CHARS = 300;
export const SITE_ASK_REPLY_MAX_CHARS = 1200;
export const SITE_ASK_HISTORY_MAX_TURNS = 4;

export type SiteAskTurn = { role: "user" | "assistant"; content: string };
export type SiteAskInput = { message: string; history: SiteAskTurn[] };

const clean = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

export function parseSiteAsk(
  body: unknown,
): { ok: true; value: SiteAskInput } | { ok: false; error: string } {
  const b = (body && typeof body === "object" && !Array.isArray(body) ? body : {}) as Record<string, unknown>;

  const message = clean(b.message);
  if (!message) return { ok: false, error: "message is required" };
  if (message.length > SITE_ASK_MESSAGE_MAX_CHARS) {
    return { ok: false, error: `message is over ${SITE_ASK_MESSAGE_MAX_CHARS} characters` };
  }

  const raw = b.history ?? [];
  if (!Array.isArray(raw)) return { ok: false, error: "history must be an array" };
  if (raw.length > SITE_ASK_HISTORY_MAX_TURNS) {
    return { ok: false, error: `history is over ${SITE_ASK_HISTORY_MAX_TURNS} turns` };
  }

  const history: SiteAskTurn[] = [];
  for (const item of raw) {
    const turn = (item && typeof item === "object" ? item : {}) as Record<string, unknown>;
    const role = turn.role;
    if (role !== "user" && role !== "assistant") {
      return { ok: false, error: "each history turn needs a role of 'user' or 'assistant'" };
    }
    const content = clean(turn.content);
    if (!content) return { ok: false, error: "each history turn needs content" };
    const max = role === "user" ? SITE_ASK_MESSAGE_MAX_CHARS : SITE_ASK_REPLY_MAX_CHARS;
    if (content.length > max) return { ok: false, error: "a history turn is too long" };
    history.push({ role, content });
  }

  return { ok: true, value: { message, history } };
}
