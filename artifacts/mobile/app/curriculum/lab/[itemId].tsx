/**
 * Present mode — one lab item, full screen, for the projector.
 *
 * The id in the URL is shareable and untrusted: it resolves through
 * `resolveLabParam` or the screen says it could not find the item. The share
 * button copies a link built by `Linking.createURL`, which is the app's own
 * scheme on native and the site origin on web.
 */
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import * as Linking from 'expo-linking';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import { getLessonById } from '@/services/knowledgeBase';
import { labItemPath, resolveLabParam } from '@/services/labLinks';
import { LabFrame } from '@/components/lab/LabFrame';
import { LabLawCard } from '@/components/lab/LabLawCard';
import { LabExternalCard } from '@/components/lab/LabExternalCard';
import { LabFigureStrip } from '@/components/lab/LabFigureStrip';
import { LabInteractive } from '@/components/lab/LabInteractive';

export default function LabPresentScreen() {
  const { itemId } = useLocalSearchParams<{ itemId: string }>();
  const colors = useColors();
  const { t, lang, isRTL } = useLanguage();
  const [copied, setCopied] = useState(false);

  const item = resolveLabParam(itemId);
  if (!item) {
    return (
      <LabFrame title={t('labTitle')}>
        <Text style={[styles.missing, { color: colors.mutedForeground, fontFamily: 'Almarai_400Regular' }]}>
          {t('labNotFound')}
        </Text>
      </LabFrame>
    );
  }

  const lesson = getLessonById(item.lessonId);
  const lessonTitle = lesson ? (lang === 'ar' ? lesson.titleAr : lesson.titleEn) : undefined;

  const copyLink = async () => {
    try {
      await Clipboard.setStringAsync(Linking.createURL(labItemPath(item.id)));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard can be refused (insecure web origin, permissions). Nothing to
      // recover: the button simply does not confirm.
    }
  };

  return (
    <LabFrame title={lang === 'ar' ? item.titleAr : item.titleEn} subtitle={lessonTitle}>
      <View style={[styles.actions, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
        <Pressable
          onPress={copyLink}
          accessibilityRole="button"
          style={[styles.copy, { backgroundColor: colors.muted, flexDirection: isRTL ? 'row-reverse' : 'row' }]}
        >
          <Ionicons name={copied ? 'checkmark' : 'link-outline'} size={16} color={colors.foreground} />
          <Text style={{ color: colors.foreground, fontFamily: 'ReadexPro_500Medium', fontSize: 13 }}>
            {copied ? t('labLinkCopied') : t('labCopyLink')}
          </Text>
        </Pressable>
      </View>

      {item.kind === 'interactive' ? <LabInteractive interactiveId={item.interactiveId} /> : null}
      {item.kind === 'law' ? <LabLawCard item={item} /> : null}
      {item.kind === 'external' ? <LabExternalCard item={item} /> : null}

      <LabFigureStrip lessonId={item.lessonId} />
    </LabFrame>
  );
}

const styles = StyleSheet.create({
  missing: { textAlign: 'center', padding: 32 },
  actions: { paddingHorizontal: 16, paddingTop: 12 },
  copy: { alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999 },
});
