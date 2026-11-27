/**
 * «المصادر وإخلاء المسؤولية» — the app is independent of the Ministry and the
 * NCCD, and here are the official sources its curriculum comes from.
 *
 * A static route beside `[doc].tsx`, so `/legal/sources` lands here rather
 * than on the privacy policy, and it is public for the same reason the policy
 * is: it sits under `/legal` in PUBLIC_ROUTES (`services/routeGating.ts`), so a
 * Play reviewer or a visitor can open it signed out from the login screen.
 *
 * The text lives in `constants/sources.ts`.
 */
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { useColors } from '@/hooks/useColors';
import { SPACE, TYPE } from '@/constants/theme';
import { useLanguage } from '@/context/LanguageContext';
import { displayUrl, SOURCE_LINKS, sourcesCopy } from '@/constants/sources';
import { openExternal } from '@/services/externalLinks';

export default function SourcesScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { lang, isRTL } = useLanguage();
  const copy = sourcesCopy(lang);
  const align = isRTL ? 'right' : 'left';
  const topPad = insets.top + (insets.top === 0 ? 16 : 0);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View
        style={[
          styles.header,
          { paddingTop: topPad + 12, backgroundColor: colors.card, borderBottomColor: colors.border },
        ]}
      >
        {router.canGoBack() ? (
          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel={lang === 'ar' ? 'رجوع' : 'Back'}
            style={[styles.backBtn, { alignSelf: isRTL ? 'flex-end' : 'flex-start' }]}
          >
            <Ionicons name={isRTL ? 'arrow-forward' : 'arrow-back'} size={24} color={colors.foreground} />
          </Pressable>
        ) : null}
        <Text
          accessibilityRole="header"
          style={[styles.title, { color: colors.foreground, fontFamily: 'ReadexPro_700Bold', textAlign: align }]}
        >
          {copy.title}
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: insets.bottom + 60 }}
        showsVerticalScrollIndicator={false}
      >
        <Text
          accessibilityRole="header"
          style={[styles.heading, { color: colors.foreground, fontFamily: 'ReadexPro_700Bold', textAlign: align }]}
        >
          {copy.disclaimerHeading}
        </Text>
        <View
          style={[
            styles.disclaimerCard,
            { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius },
          ]}
        >
          <Text
            selectable
            style={[styles.paragraph, { color: colors.foreground, fontFamily: 'Almarai_400Regular', textAlign: align }]}
          >
            {copy.disclaimer}
          </Text>
        </View>

        <Text
          accessibilityRole="header"
          style={[styles.heading, styles.sectionTop, { color: colors.foreground, fontFamily: 'ReadexPro_700Bold', textAlign: align }]}
        >
          {copy.sourcesHeading}
        </Text>
        <Text
          style={[styles.paragraph, { color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', textAlign: align }]}
        >
          {copy.sourcesIntro}
        </Text>

        <View style={{ gap: SPACE.md, marginTop: SPACE.sm }}>
          {SOURCE_LINKS.map(link => (
            <Pressable
              key={link.url}
              onPress={() => { void openExternal(link.url); }}
              accessibilityRole="link"
              accessibilityLabel={`${link.label[lang === 'en' ? 'en' : 'ar']}${lang === 'en' ? ', ' : '، '}${copy.opensInBrowser}`}
              style={({ pressed }) => [
                styles.linkRow,
                {
                  flexDirection: isRTL ? 'row-reverse' : 'row',
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                  borderRadius: colors.radius,
                  opacity: pressed ? 0.7 : 1,
                },
              ]}
            >
              <Ionicons name="link-outline" size={20} color={colors.primary} />
              <View style={{ flex: 1, gap: SPACE.xxs }}>
                <Text
                  style={[styles.linkLabel, { color: colors.primary, fontFamily: 'ReadexPro_600SemiBold', textAlign: align }]}
                >
                  {link.label[lang === 'en' ? 'en' : 'ar']}
                </Text>
                {/* The address is Latin: its own Text, so the bidi algorithm
                    never mixes it into the Arabic label. Shown without the
                    scheme and trailing slash — on web a trailing «/» in an RTL
                    row jumps to the left end (react-native-web's dir="auto"). */}
                <Text
                  numberOfLines={1}
                  style={[
                    styles.linkUrl,
                    { color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', textAlign: align, writingDirection: 'ltr' },
                  ]}
                >
                  {displayUrl(link.url)}
                </Text>
              </View>
              <Ionicons name="open-outline" size={16} color={colors.mutedForeground} />
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 20, paddingBottom: 16, borderBottomWidth: StyleSheet.hairlineWidth },
  backBtn: { padding: 4, marginBottom: 8 },
  title: { fontSize: TYPE.title },
  heading: { fontSize: TYPE.bodyLg, marginBottom: SPACE.md },
  sectionTop: { marginTop: SPACE.xxl },
  disclaimerCard: { borderWidth: 1, padding: SPACE.lg },
  paragraph: { fontSize: TYPE.body, lineHeight: 27 },
  linkRow: { alignItems: 'center', gap: SPACE.md, borderWidth: 1, paddingHorizontal: SPACE.lg, paddingVertical: SPACE.md, minHeight: 44 },
  linkLabel: { fontSize: TYPE.body, lineHeight: 24 },
  linkUrl: { fontSize: TYPE.caption, lineHeight: 20 },
});
