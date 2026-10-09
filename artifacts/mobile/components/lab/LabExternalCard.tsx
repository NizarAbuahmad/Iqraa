/**
 * A curated third-party resource.
 *
 * Opens the original rather than embedding it, and always shows the
 * attribution verbatim: for these licences the credit is a condition of use,
 * not decoration (STATUS.md, «The English lab» — three render paths once
 * dropped it). An image whose licence let us keep our own copy (it carries an
 * `ingest` block) is shown here as well, with the credit under it.
 */
import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import type { LabExternalItem } from '@workspace/curriculum/lab';
import { getExternalResource } from '@workspace/curriculum/external';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import { openExternal } from '@/services/externalLinks';
import { loadExternalAsset } from '@/services/externalMedia';

export function LabExternalCard({ item }: { item: LabExternalItem }) {
  const colors = useColors();
  const { t, lang, isRTL } = useLanguage();
  const resource = getExternalResource(item.externalId);
  const align = isRTL ? 'right' : 'left';
  const [image, setImage] = useState<{ url: string; attribution: string } | null>(null);

  const wantsImage = resource?.kind === 'image' && !!resource.ingest;
  useEffect(() => {
    if (!wantsImage) return;
    let live = true;
    // The URL is signed and short-lived, so it is fetched on mount, not baked in.
    void loadExternalAsset(item.externalId).then(asset => {
      if (live && asset) setImage({ url: asset.url, attribution: asset.attribution });
    });
    return () => { live = false; };
  }, [wantsImage, item.externalId]);

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
      {image ? (
        <Image
          source={{ uri: image.url }}
          style={[styles.image, { borderColor: colors.border }]}
          contentFit="contain"
          accessibilityLabel={resource.titleEn}
        />
      ) : null}
      <Pressable
        onPress={() => openExternal(resource.sourceUrl)}
        accessibilityRole="button"
        style={[styles.open, { backgroundColor: colors.primary, flexDirection: isRTL ? 'row-reverse' : 'row' }]}
      >
        <Ionicons name="open-outline" size={18} color={colors.primaryForeground} />
        <Text style={{ color: colors.primaryForeground, fontFamily: 'ReadexPro_600SemiBold' }}>{t('labOpenSource')}</Text>
      </Pressable>
      <Text style={[styles.credit, { color: colors.mutedForeground, textAlign: align, fontFamily: 'Almarai_400Regular' }]}>
        {t('labSource')}: {image?.attribution ?? resource.attribution}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 16, gap: 14 },
  title: { fontSize: 18 },
  image: { width: '100%', height: 360, borderWidth: 1, borderRadius: 12, backgroundColor: '#fff' },
  open: { alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 14 },
  credit: { fontSize: 12 },
});
