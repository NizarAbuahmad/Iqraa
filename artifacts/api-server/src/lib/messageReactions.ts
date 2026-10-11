/**
 * Reactions on person-to-person chat messages (routes/messaging.ts) — the pure
 * half. No imports, so `node --test` can load it without `db` or an OpenAI key.
 *
 * Three decisions live here so they can be tested without a database:
 *
 * - which emoji exist (six, fixed — a minor can type nothing into this feature);
 * - what a viewer is shown for a message's reactions (counts for everyone, who
 *   only to teachers, nothing from accounts the viewer has blocked);
 * - who may react at all. Deliberately NOT gated by `studentPostingEnabled`: a
 *   reaction is an acknowledgement, not a post, and an announcement-only group
 *   is exactly where a student has no other way to say "understood".
 *
 * `REACTION_EMOJI` is mirrored in artifacts/mobile/services/messageReactions.ts
 * — keep that declaration line identical. A parity test reads both files.
 */
export const REACTION_EMOJI = ["👍", "❤️", "😂", "😮", "👏", "🙏"] as const;
export type ReactionEmoji = (typeof REACTION_EMOJI)[number];

/** Exact match on purpose: a bare U+2764 is not the heart in the set, and is refused rather than normalised. */
export function isAllowedReaction(v: unknown): v is ReactionEmoji {
  return typeof v === "string" && (REACTION_EMOJI as readonly string[]).includes(v);
}

export interface ReactionRow {
  messageId: string;
  userId: string;
  emoji: string;
}

export interface ReactionSummary {
  emoji: string;
  count: number;
  mine: boolean;
  /** Teacher-role viewers only. Sorted, so a poll that sees the same people never looks like a change. */
  userIds?: string[];
}

/**
 * messageId → chips, in `REACTION_EMOJI` order. A message with nothing to show
 * has no entry. Rows from `hiddenUserIds` (the viewer's blocks — empty for a
 * teacher, who never filters) are dropped before anything is counted, and so
 * are stored emoji outside the current set.
 */
export function summarizeReactions(
  rows: readonly ReactionRow[],
  viewerId: string,
  opts: { viewerIsTeacher: boolean; hiddenUserIds: ReadonlySet<string> },
): Map<string, ReactionSummary[]> {
  const byMessage = new Map<string, Map<string, string[]>>();
  for (const r of rows) {
    if (opts.hiddenUserIds.has(r.userId)) continue;
    let perEmoji = byMessage.get(r.messageId);
    if (!perEmoji) {
      perEmoji = new Map();
      byMessage.set(r.messageId, perEmoji);
    }
    const users = perEmoji.get(r.emoji);
    if (users) users.push(r.userId);
    else perEmoji.set(r.emoji, [r.userId]);
  }

  const out = new Map<string, ReactionSummary[]>();
  for (const [messageId, perEmoji] of byMessage) {
    const chips: ReactionSummary[] = [];
    for (const emoji of REACTION_EMOJI) {
      const users = perEmoji.get(emoji);
      if (!users) continue;
      const chip: ReactionSummary = { emoji, count: users.length, mine: users.includes(viewerId) };
      if (opts.viewerIsTeacher) chip.userIds = [...users].sort();
      chips.push(chip);
    }
    if (chips.length > 0) out.set(messageId, chips);
  }
  return out;
}

export interface ReactionAccessInput {
  isParticipant: boolean;
  messageInThread: boolean;
  messageArchived: boolean;
  viewerIsTeacher: boolean;
  viewerBlocksSender: boolean;
  /** Carried only so the tests can state the rule: neither of these two ever changes the answer. */
  threadType: "direct" | "class_group" | "custom_group";
  studentPostingEnabled: boolean;
}

/**
 * One answer for every reason a reaction is refused — the route never says
 * which condition failed, so a non-member learns nothing about the thread.
 */
export function reactionAccess(i: ReactionAccessInput): "ok" | "not_found" {
  if (!i.isParticipant) return "not_found";
  if (!i.messageInThread || i.messageArchived) return "not_found";
  // A non-teacher cannot see a blocked sender's messages (the list filters them),
  // so they cannot react to one. Teachers never filter.
  if (!i.viewerIsTeacher && i.viewerBlocksSender) return "not_found";
  return "ok";
}
