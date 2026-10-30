/**
 * One «ما الجديد» entry: its title, what changed, and «جرّبها» when it has
 * somewhere to go. Shared by the dialog (WhatsNewHost) and the Profile screen
 * (app/whats-new.tsx), so a note reads the same in both.
 */
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import { SPACE, TYPE } from '@/constants/theme';
import type { WhatsNewEntry } from '@/services/whatsNew';

export function WhatsNewItem({ entry, onTry }: { entry: WhatsNewEntry; onTry?: (entry: WhatsNewEntry) => void }) {
  const colors = useColors();
  const { t, isRTL } = useLanguage();
  const align = isRTL ? 'right' : 'left';
  return (
    <View style={styles.item}>
      <Text style={[styles.title, { color: colors.foreground, textAlign: align }]}>{t(entry.titleKey)}</Text>
      <Text style={[styles.body, { color: colors.mutedForeground, textAlign: align }]}>{t(entry.bodyKey)}</Text>
      {entry.route && onTry ? (
        <Pressable
          onPress={() => onTry(entry)}
          accessibilityRole="link"
          hitSlop={8}
          style={({ pressed }) => [
            styles.try,
            { flexDirection: isRTL ? 'row-reverse' : 'row', alignSelf: isRTL ? 'flex-end' : 'flex-start', opacity: pressed ? 0.7 : 1 },
          ]}
        >
          <Text style={[styles.tryText, { color: colors.primary }]}>{t('whatsNewTry')}</Text>
          <Ionicons name={isRTL ? 'arrow-back' : 'arrow-forward'} size={16} color={colors.primary} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  item: { gap: SPACE.xs },
  title: { fontFamily: 'ReadexPro_700Bold', fontSize: TYPE.bodyLg, lineHeight: 27 },
  body: { fontFamily: 'Almarai_400Regular', fontSize: TYPE.body, lineHeight: 24 },
  try: { alignItems: 'center', gap: SPACE.xs, minHeight: 44 },
  tryText: { fontFamily: 'ReadexPro_600SemiBold', fontSize: TYPE.body },
});
