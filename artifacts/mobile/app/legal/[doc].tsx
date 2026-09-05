/**
 * The privacy policy and terms of service — one screen, both documents.
 *
 * A dynamic segment rather than two near-identical files: the documents differ
 * only in their content, which lives in `constants/legal.ts`.
 *
 * These routes are deliberately reachable **signed out** (see PUBLIC_ROUTES in
 * `services/routeGating.ts`). Both store listings require a policy URL that a
 * reviewer can open cold, and on the web build these resolve to
 * `/legal/privacy` and `/legal/terms` — no static file, so nothing depends on
 * how Render's SPA rewrite orders itself against the catch-all.
 */
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import { getLegalDoc, isLegalDocId, LEGAL_LAST_UPDATED } from '@/constants/legal';

export default function LegalScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { lang, isRTL } = useLanguage();
  const { doc } = useLocalSearchParams<{ doc?: string }>();

  // An unknown slug falls back to the privacy policy rather than a not-found:
  // a mistyped link in a store listing should still land on a real document.
  const id = isLegalDocId(doc) ? doc : 'privacy';
  const content = getLegalDoc(id, lang);
  const align = isRTL ? 'right' : 'left';
  const topPad = insets.top + (insets.top === 0 ? 67 : 0);

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
            style={[styles.backBtn, { alignSelf: isRTL ? 'flex-end' : 'flex-start' }]}
          >
            <Ionicons name={isRTL ? 'arrow-forward' : 'arrow-back'} size={22} color={colors.foreground} />
          </Pressable>
        ) : null}
        <Text
          style={[styles.title, { color: colors.foreground, fontFamily: 'Cairo_700Bold', textAlign: align }]}
        >
          {content.title}
        </Text>
        <Text
          style={[styles.updated, { color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', textAlign: align }]}
        >
          {lang === 'ar' ? 'آخر تحديث: ' : 'Last updated: '}
          {LEGAL_LAST_UPDATED[lang]}
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: 60 }}
        showsVerticalScrollIndicator={false}
      >
        <Text
          style={[styles.intro, { color: colors.foreground, fontFamily: 'Almarai_400Regular', textAlign: align }]}
        >
          {content.intro}
        </Text>

        {content.sections.map(section => (
          <View key={section.heading} style={styles.section}>
            <Text
              style={[styles.heading, { color: colors.foreground, fontFamily: 'Cairo_700Bold', textAlign: align }]}
            >
              {section.heading}
            </Text>
            {section.body.map((paragraph, i) => (
              <Text
                key={i}
                style={[
                  styles.paragraph,
                  { color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', textAlign: align },
                ]}
              >
                {paragraph}
              </Text>
            ))}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 20, paddingBottom: 16, borderBottomWidth: StyleSheet.hairlineWidth },
  backBtn: { padding: 4, marginBottom: 8 },
  title: { fontSize: 22 },
  updated: { fontSize: 12, marginTop: 4 },
  intro: { fontSize: 15, lineHeight: 26 },
  section: { marginTop: 26 },
  heading: { fontSize: 16, marginBottom: 10 },
  paragraph: { fontSize: 14, lineHeight: 25, marginBottom: 10 },
});
