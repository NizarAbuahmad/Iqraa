/**
 * Highlights that a subject is taught from the national, Ministry-approved
 * textbook. Renders nothing for subjects `nationalBook.ts` doesn't flag, so
 * callers can drop it in unconditionally.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLanguage } from '@/context/LanguageContext';
import { nationalBookNoteKey } from '@/services/nationalBook';

interface Props {
  subjectId: string | undefined | null;
  /** Text/icon colour — pass the surface's foreground colour. */
  color: string;
  /** Fill behind the banner. Defaults to a soft white wash for dark heroes. */
  background?: string;
  borderColor?: string;
}

export function NationalBookBanner({
  subjectId, color, background = 'rgba(255,255,255,0.18)', borderColor = 'rgba(255,255,255,0.45)',
}: Props) {
  const { t, isRTL } = useLanguage();
  const key = nationalBookNoteKey(subjectId);
  if (!key) return null;

  return (
    <View
      accessible
      accessibilityRole="text"
      style={[
        styles.banner,
        { backgroundColor: background, borderColor, flexDirection: isRTL ? 'row-reverse' : 'row' },
      ]}
    >
      <Ionicons name="ribbon" size={16} color={color} />
      <Text
        style={[styles.text, { color, fontFamily: 'ReadexPro_600SemiBold', textAlign: isRTL ? 'right' : 'left' }]}
      >
        {t(key)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    alignItems: 'center',
    alignSelf: 'stretch',
    gap: 8,
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  text: { flex: 1, fontSize: 13, lineHeight: 19 },
});
