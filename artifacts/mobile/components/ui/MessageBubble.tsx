/**
 * A person-to-person chat bubble — teacher/parent/student messaging.
 *
 * Not the AI-assistant's bubble (app/(tabs)/iqra.tsx's inline MessageBubble):
 * that one renders markdown/math and per-message AI actions (copy, export,
 * save). This one only ever shows plain text from another person, with their
 * avatar, and never needs those.
 *
 * Own messages sit on the trailing edge regardless of RTL — same reasoning as
 * the AI bubble: WhatsApp/ChatGPT convention, not a layout mirror.
 */
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Avatar } from './Avatar';
import { AR_LATIN } from '@/services/dateLabels';
import type { ChatReaction } from '@/services/messageReactions';
import { TYPE } from '@/constants/theme';

interface Colors {
  primary: string;
  primaryForeground: string;
  card: string;
  cardForeground: string;
  border: string;
  mutedForeground: string;
  secondary: string;
}

interface Props {
  body: string;
  createdAt: string;
  isOwn: boolean;
  isRTL: boolean;
  colors: Colors;
  /** Only needed for someone else's message — an own bubble never shows an avatar. */
  senderFirstName?: string;
  senderLastName?: string;
  /** Only rendered for attachmentKind='image' — audio/document attachments have no chat UI yet (see services/messaging.ts). */
  attachmentUrl?: string | null;
  attachmentKind?: 'image' | 'audio' | 'document' | null;
  /** Own bubble only: «شوهدت», shown once the other side's screen has displayed it. */
  seenLabel?: string;
  /**
   * Group threads: who sent this, printed above the message. A direct chat
   * leaves it unset — its header already says who the other person is — and so
   * does the second and later message of one person's run.
   */
  senderName?: string;
  /** Beside `senderName`: «معلم», «طالب/ة» … so «DA» is not the only clue. */
  senderRoleLabel?: string;
  /** Chips under the bubble. Tapping one toggles the viewer's own reaction (the screen decides what that means). */
  reactions?: ChatReaction[];
  onReactionPress?: (emoji: string) => void;
  /** Spoken label for a chip — passed in so this component needs no translation hook. */
  reactionLabel?: (r: ChatReaction) => string;
}

function ReactionChips({
  reactions, colors, isRTL, onPress, label,
}: {
  reactions: ChatReaction[];
  colors: Colors;
  isRTL: boolean;
  onPress?: (emoji: string) => void;
  label?: (r: ChatReaction) => string;
}) {
  if (reactions.length === 0) return null;
  return (
    <View style={styles.chips}>
      {reactions.map(r => (
        <Pressable
          key={r.emoji}
          onPress={() => onPress?.(r.emoji)}
          accessibilityRole="button"
          accessibilityLabel={label?.(r)}
          hitSlop={6}
          style={[
            styles.chip,
            {
              backgroundColor: r.mine ? colors.secondary : colors.card,
              borderColor: r.mine ? colors.primary : colors.border,
            },
          ]}
        >
          <Text style={styles.chipEmoji}>{r.emoji}</Text>
          <Text style={[styles.chipCount, { color: r.mine ? colors.primary : colors.mutedForeground }]}>
            {r.count.toLocaleString(isRTL ? AR_LATIN : undefined)}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

export function MessageBubble({
  body, createdAt, isOwn, isRTL, colors, senderFirstName, senderLastName, attachmentUrl, attachmentKind, seenLabel,
  senderName, senderRoleLabel, reactions, onReactionPress, reactionLabel,
}: Props) {
  const timeLabel = new Date(createdAt).toLocaleTimeString(isRTL ? AR_LATIN : undefined, { hour: '2-digit', minute: '2-digit' });
  const image = attachmentKind === 'image' && attachmentUrl ? (
    <Image source={{ uri: attachmentUrl }} style={styles.attachment} resizeMode="cover" />
  ) : null;

  if (isOwn) {
    return (
      <View style={styles.rowOwn}>
        <View style={[styles.column, { alignItems: 'flex-end' }]}>
          <View style={[styles.bubble, { backgroundColor: colors.primary, borderRadius: 18 }]}>
            {image}
            {body ? (
              <Text style={[styles.text, { color: colors.primaryForeground, textAlign: isRTL ? 'right' : 'left', writingDirection: isRTL ? 'rtl' : 'ltr' }]}>
                {body}
              </Text>
            ) : null}
            <Text style={[styles.timestamp, { color: 'rgba(255,255,255,0.95)', textAlign: isRTL ? 'left' : 'right' }]}>
              {seenLabel ? `${timeLabel} · ${seenLabel}` : timeLabel}
            </Text>
          </View>
          <ReactionChips reactions={reactions ?? []} colors={colors} isRTL={isRTL} onPress={onReactionPress} label={reactionLabel} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.rowOther}>
      <Avatar firstName={senderFirstName ?? '?'} lastName={senderLastName} size={30} colors={colors} />
      <View style={[styles.column, { alignItems: 'flex-start' }]}>
        <View style={[styles.bubble, { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, borderRadius: 18 }]}>
          {senderName ? (
            <Text
              numberOfLines={1}
              style={[styles.senderLine, { color: colors.primary, textAlign: isRTL ? 'right' : 'left', writingDirection: isRTL ? 'rtl' : 'ltr' }]}
            >
              {senderName}
              {senderRoleLabel ? <Text style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular' }}>{`  ·  ${senderRoleLabel}`}</Text> : null}
            </Text>
          ) : null}
          {image}
          {body ? (
            <Text style={[styles.text, { color: colors.cardForeground, textAlign: isRTL ? 'right' : 'left', writingDirection: isRTL ? 'rtl' : 'ltr' }]}>
              {body}
            </Text>
          ) : null}
          <Text style={[styles.timestamp, { color: colors.mutedForeground, textAlign: isRTL ? 'left' : 'right' }]}>
            {timeLabel}
          </Text>
        </View>
        <ReactionChips reactions={reactions ?? []} colors={colors} isRTL={isRTL} onPress={onReactionPress} label={reactionLabel} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  rowOwn: { width: '100%', flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 8 },
  rowOther: { width: '100%', flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginBottom: 8 },
  column: { maxWidth: '78%' },
  bubble: { padding: 12, paddingHorizontal: 16 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 4 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderRadius: 12, paddingHorizontal: 8, paddingVertical: 2 },
  chipEmoji: { fontSize: 14, lineHeight: 20 },
  chipCount: { fontSize: 12, lineHeight: 18, fontFamily: 'Almarai_400Regular' },
  senderLine: { fontSize: TYPE.caption, lineHeight: 18, marginBottom: 4, fontFamily: 'ReadexPro_600SemiBold' },
  attachment: { width: 200, height: 200, borderRadius: 12, marginBottom: 6 },
  text: { fontSize: 15, lineHeight: 24, fontFamily: 'Almarai_400Regular' },
  timestamp: { fontSize: 10, lineHeight: 16, marginTop: 6, fontFamily: 'Almarai_400Regular' },
});
