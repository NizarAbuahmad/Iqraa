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
import { Image, StyleSheet, Text, View } from 'react-native';
import { Avatar } from './Avatar';

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
}

export function MessageBubble({
  body, createdAt, isOwn, isRTL, colors, senderFirstName, senderLastName, attachmentUrl, attachmentKind,
}: Props) {
  const timeLabel = new Date(createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const image = attachmentKind === 'image' && attachmentUrl ? (
    <Image source={{ uri: attachmentUrl }} style={styles.attachment} resizeMode="cover" />
  ) : null;

  if (isOwn) {
    return (
      <View style={styles.rowOwn}>
        <View style={[styles.bubble, { backgroundColor: colors.primary, borderRadius: 18 }]}>
          {image}
          {body ? (
            <Text style={[styles.text, { color: colors.primaryForeground, textAlign: isRTL ? 'right' : 'left', writingDirection: isRTL ? 'rtl' : 'ltr' }]}>
              {body}
            </Text>
          ) : null}
          <Text style={[styles.timestamp, { color: 'rgba(255,255,255,0.7)', textAlign: isRTL ? 'left' : 'right' }]}>
            {timeLabel}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.rowOther}>
      <Avatar firstName={senderFirstName ?? '?'} lastName={senderLastName} size={30} colors={colors} />
      <View style={[styles.bubble, { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, borderRadius: 18 }]}>
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
    </View>
  );
}

const styles = StyleSheet.create({
  rowOwn: { width: '100%', flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 8 },
  rowOther: { width: '100%', flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginBottom: 8 },
  bubble: { maxWidth: '78%', padding: 12, paddingHorizontal: 16 },
  attachment: { width: 200, height: 200, borderRadius: 12, marginBottom: 6 },
  text: { fontSize: 14, lineHeight: 20, fontFamily: 'Almarai_400Regular' },
  timestamp: { fontSize: 10, marginTop: 6, fontFamily: 'Almarai_400Regular' },
});
