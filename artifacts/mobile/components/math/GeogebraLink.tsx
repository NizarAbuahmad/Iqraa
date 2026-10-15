/**
 * A link-out to GeoGebra's graphing calculator. Never an embed: GeoGebra's
 * licence does not allow framing it in a commercial product (see STATUS.md,
 * «The GeoGebra embed is gone»), so this opens their website instead — a new
 * tab on web, the in-app browser on native.
 */
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import { openGeogebraGraphing } from '@/services/geogebra';
import { RADIUS, SPACE, TYPE } from '@/constants/theme';

export function GeogebraLink() {
  const colors = useColors();
  const { t, isRTL } = useLanguage();
  const align = isRTL ? 'right' : 'left';
  return (
    <Pressable
      onPress={() => {
        Haptics.selectionAsync();
        void openGeogebraGraphing();
      }}
      accessibilityRole="link"
      accessibilityLabel={`${t('mathOpenGeogebra')}, ${t('mathGeogebraHint')}`}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          flexDirection: isRTL ? 'row-reverse' : 'row',
          opacity: pressed ? 0.8 : 1,
        },
      ]}
    >
      <View style={[styles.icon, { backgroundColor: colors.secondary }]}>
        <Ionicons name="open-outline" size={22} color={colors.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.title, { color: colors.foreground, textAlign: align, fontFamily: 'ReadexPro_600SemiBold' }]}>
          {t('mathOpenGeogebra')}
        </Text>
        <Text style={[styles.hint, { color: colors.mutedForeground, textAlign: align, fontFamily: 'Almarai_400Regular' }]}>
          {t('mathGeogebraHint')}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { alignItems: 'center', gap: SPACE.md, padding: SPACE.md, borderWidth: 1, borderRadius: RADIUS.lg },
  icon: { width: 44, height: 44, borderRadius: RADIUS.md, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: TYPE.body },
  hint: { fontSize: TYPE.caption, marginTop: SPACE.xxs },
});
