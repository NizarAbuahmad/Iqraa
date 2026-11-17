/**
 * «قبل طباعة الرسوم» — a short checklist for a drawing a teacher made
 * themselves, reached from a teacher-only tile in the library's front row.
 *
 * The book's own figures need none of this: «صور الكتاب» prints each one with
 * its source and printed page. A drawing the teacher made by hand, in a drawing
 * program or with an image model does not, and its Arabic labels are where it
 * goes wrong — an image model draws Arabic letters as shapes, and a label baked
 * into a picture cannot be corrected without redrawing it. So: labels as text,
 * read it again at worksheet size, and mark what came from the book.
 *
 * Static copy, no state. Added from a suggestion sent through the site's contact
 * form (2026-11-17); the message's link to a third-party guide was left out on
 * purpose — the app does not send teachers to outside sites it has not vetted.
 */
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { useLightStatusBar } from '@/hooks/useLightStatusBar';
import { useLanguage } from '@/context/LanguageContext';
import type { TranslationKey } from '@/services/i18n';
import { palette } from '@/constants/colors';
import { CONTENT_MAX_WIDTH } from '@/constants/layout';
import { TYPE } from '@/constants/theme';
import { readableOn } from '@/services/readableColor';
import { BackButton } from '@/components/ui/BackButton';
import { Band } from '@/components/ui/Band';

type Check = { icon: React.ComponentProps<typeof Ionicons>['name']; title: TranslationKey; body: TranslationKey };

const CHECKS: readonly Check[] = [
  { icon: 'text-outline', title: 'figureCheckLabelsTitle', body: 'figureCheckLabelsBody' },
  { icon: 'search-outline', title: 'figureCheckScaleTitle', body: 'figureCheckScaleBody' },
  { icon: 'pricetag-outline', title: 'figureCheckSourceTitle', body: 'figureCheckSourceBody' },
];

export default function FigureCheckScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  // The band sits under the status bar: its icons must be light on it.
  useLightStatusBar();
  const { t, isRTL } = useLanguage();
  const align = isRTL ? 'right' : 'left';
  const dir = isRTL ? 'row-reverse' : 'row';
  const accent = readableOn(palette.primary, colors.card, 3);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Band color={palette.hero} motif="leaf" style={[styles.hero, { paddingTop: insets.top + 12 }]}>
        <BackButton color="#fff" style={[styles.backBtn, { alignSelf: isRTL ? 'flex-end' : 'flex-start' }]} />
        <Text style={[styles.heroTitle, { fontFamily: 'ReadexPro_700Bold', textAlign: align }]}>{t('figureCheckTitle')}</Text>
      </Band>

      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <Text style={[styles.intro, { color: colors.foreground, fontFamily: 'Almarai_400Regular', textAlign: align }]}>
          {t('figureCheckIntro')}
        </Text>

        {CHECKS.map((c, i) => (
          <View
            key={c.title}
            style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius, flexDirection: dir }]}
          >
            <Ionicons name={c.icon} size={24} color={accent} />
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={[styles.cardTitle, { color: colors.foreground, fontFamily: 'ReadexPro_600SemiBold', textAlign: align }]}>
                {`${(i + 1).toLocaleString(isRTL ? 'ar-EG' : 'en')}. ${t(c.title)}`}
              </Text>
              <Text style={[styles.cardBody, { color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', textAlign: align }]}>
                {t(c.body)}
              </Text>
            </View>
          </View>
        ))}

        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.push('/curriculum/book-images' as never);
          }}
          accessibilityRole="button"
          accessibilityLabel={t('bookImagesTitle')}
          style={({ pressed }) => [
            styles.link,
            { borderColor: colors.border, borderRadius: colors.radius, flexDirection: dir, opacity: pressed ? 0.85 : 1 },
          ]}
        >
          <Ionicons name="images-outline" size={20} color={accent} />
          <Text style={[styles.linkText, { color: colors.foreground, fontFamily: 'Almarai_400Regular', textAlign: align }]}>
            {t('figureCheckBookImages')}
          </Text>
          <Ionicons name={isRTL ? 'chevron-back' : 'chevron-forward'} size={20} color={colors.mutedForeground} />
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { paddingHorizontal: 20, paddingBottom: 16, gap: 2 },
  backBtn: { padding: 4 },
  heroTitle: { color: '#fff', fontSize: TYPE.headline, lineHeight: 34 },
  body: { padding: 20, paddingBottom: 48, gap: 12, width: '100%', maxWidth: CONTENT_MAX_WIDTH, alignSelf: 'center' },
  intro: { fontSize: TYPE.body, lineHeight: 24 },
  card: { alignItems: 'flex-start', gap: 12, padding: 16, borderWidth: 1 },
  cardTitle: { fontSize: TYPE.bodyLg, lineHeight: 24 },
  cardBody: { fontSize: TYPE.label, lineHeight: 23 },
  link: { alignItems: 'center', gap: 12, padding: 16, borderWidth: 1, minHeight: 56 },
  linkText: { flex: 1, fontSize: TYPE.body, lineHeight: 23 },
});
