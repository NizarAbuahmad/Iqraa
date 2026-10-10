/**
 * Reactions on a chat message — the pure half, split out of messaging.ts for the
 * reason messageMerge.ts documents: messaging.ts imports `expo-image-picker`, so
 * nothing in it can be loaded by bare `node --test`. No RN or expo imports here.
 *
 * `REACTION_EMOJI` is mirrored from artifacts/api-server/src/lib/messageReactions.ts.
 * Keep the declaration on ONE line, identical in content (quote style aside):
 * reactionEmojiParity.test.ts reads both files and fails if they drift.
 */
export const REACTION_EMOJI = ['👍', '❤️', '😂', '😮', '👏', '🙏'] as const;

export interface ChatReaction {
  emoji: string;
  count: number;
  /** The signed-in viewer's own reaction is in this chip. */
  mine: boolean;
  /** Teacher-role viewers only: who. */
  userIds?: string[];
}

const rank = (emoji: string): number => {
  const i = (REACTION_EMOJI as readonly string[]).indexOf(emoji);
  return i === -1 ? REACTION_EMOJI.length : i;
};

/** The emoji the viewer has put on this message, if any. */
export function myReaction(reactions: readonly ChatReaction[] | undefined): string | null {
  return reactions?.find(r => r.mine)?.emoji ?? null;
}

/**
 * What the chips will look like after the viewer taps `emoji` — applied at once,
 * then replaced by the server's answer. Same rule as the server: one reaction per
 * person, so tapping your own removes it and tapping another moves it.
 * `viewerId` keeps a teacher's `userIds` in step; without it they are left as they
 * were (the server's reply corrects them). Never mutates `current`.
 */
export function toggleReaction(current: readonly ChatReaction[], emoji: string, viewerId?: string): ChatReaction[] {
  const had = myReaction(current);
  const withoutMine: ChatReaction[] = current
    .map(r =>
      r.mine
        ? { ...r, count: r.count - 1, mine: false, ...(r.userIds ? { userIds: r.userIds.filter(id => id !== viewerId) } : {}) }
        : { ...r, ...(r.userIds ? { userIds: [...r.userIds] } : {}) },
    )
    .filter(r => r.count > 0);

  if (had !== emoji) {
    const target = withoutMine.find(r => r.emoji === emoji);
    if (target) {
      target.count += 1;
      target.mine = true;
      if (target.userIds && viewerId) target.userIds = [...target.userIds, viewerId].sort();
    } else {
      withoutMine.push({ emoji, count: 1, mine: true, ...(viewerId ? { userIds: [viewerId] } : {}) });
    }
  }
  return withoutMine.sort((a, b) => rank(a.emoji) - rank(b.emoji));
}
