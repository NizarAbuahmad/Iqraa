/**
 * A pointer to a curated third-party resource.
 *
 * Opens the original rather than copying or embedding it, and always shows the
 * attribution verbatim: for these licences the credit is a condition of use,
 * not decoration (STATUS.md, «The English lab» — three render paths once
 * dropped it).
 */
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { LabExternalItem } from '@workspace/curriculum/lab';
import { getExternalResource } from '@workspace/curriculum/external';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import { openExternal } from '@/services/externalLinks';

export function LabExternalCard({ item }: { item: LabExternalItem }) {
  const colors = useColors();
  const { t, lang, isRTL } = useLanguage();
  const resource = getExternalResource(item.externalId);
  const align = isRTL ? 'right' : 'left';

  // validateLabItems rejects a dangling externalId, so this is a belt-and-braces
  // guard rather than an expected state.
  if (!resource) {
    return (
      <Text style={{ color: colors.destructive, padding: 16, textAlign: align, fontFamily: 'Almarai_400Regular' }}>
        {t('labNotFound')}
      </Text>
    );
  }

  return (
    <View style={styles.wrap}>
      <Text style={[styles.title, { color: colors.foreground, textAlign: align, fontFamily: 'ReadexPro_600SemiBold' }]}>
        {lang === 'ar' ? resource.titleAr : resource.titleEn}
      </Text>
      <Pressable
        onPress={() => openExternal(resource.sourceUrl)}
        accessibilityRole="button"
        style={[styles.open, { backgroundColor: colors.primary, flexDirection: isRTL ? 'row-reverse' : 'row' }]}
      >
        <Ionicons name="open-outline" size={18} color={colors.primaryForeground} />
        <Text style={{ color: colors.primaryForeground, fontFamily: 'ReadexPro_600SemiBold' }}>{t('labOpenSource')}</Text>
      </Pressable>
      <Text style={[styles.credit, { color: colors.mutedForeground, textAlign: align, fontFamily: 'Almarai_400Regular' }]}>
        {t('labSource')}: {resource.attribution}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 16, gap: 14 },
  title: { fontSize: 18 },
  open: { alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 14 },
  credit: { fontSize: 12 },
});
