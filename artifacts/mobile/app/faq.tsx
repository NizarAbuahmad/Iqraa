/**
 * How to use Iqraa — as questions, not as a tour.
 *
 * This replaced re-opening the "start here" coach card on the retired home
 * screen. That card answered one question ("what is this?") once, at a moment
 * chosen by the app; a teacher who comes looking later has a specific question
 * and wants that one answered. Questions also survive the product changing —
 * an answer can be rewritten without redesigning a walkthrough.
 */
import React, { useState } from 'react';
import { LayoutAnimation, Platform, Pressable, ScrollView, StyleSheet, Text, UIManager, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import type { TranslationKey } from '@/services/i18n';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

/** Ordered by when a teacher hits them, not by topic. */
const ENTRIES: { q: TranslationKey; a: TranslationKey }[] = [
  { q: 'faqQ1', a: 'faqA1' },
  { q: 'faqQ2', a: 'faqA2' },
  { q: 'faqQ3', a: 'faqA3' },
  { q: 'faqQ4', a: 'faqA4' },
  { q: 'faqQ5', a: 'faqA5' },
  { q: 'faqQ6', a: 'faqA6' },
  { q: 'faqQ7', a: 'faqA7' },
  { q: 'faqQ8', a: 'faqA8' },
  { q: 'faqQ9', a: 'faqA9' },
];

export default function FaqScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { t, isRTL } = useLanguage();
  // The first question is open on arrival, so the screen shows an answer rather
  // than a list of closed rows that all look like buttons.
  const [open, setOpen] = useState<string | null>('faqQ1');

  const align = isRTL ? 'right' : 'left' as const;
  const rowDir = isRTL ? 'row-reverse' : 'row' as const;

  const toggle = (key: string) => {
    void Haptics.selectionAsync().catch(() => {});
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpen(prev => (prev === key ? null : key));
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View
        style={[
          styles.header,
          {
            paddingTop: insets.top + (insets.top === 0 ? 14 : 8),
            backgroundColor: colors.card,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <View style={[styles.headerRow, { flexDirection: rowDir }]}>
          <Pressable onPress={() => router.back()} hitSlop={10} accessibilityRole="button">
            <Ionicons
              name={isRTL ? 'arrow-forward' : 'arrow-back'}
              size={22}
              color={colors.foreground}
            />
          </Pressable>
          <Text style={[styles.title, { color: colors.foreground, textAlign: align, flex: 1 }]}>
            {t('faqTitle')}
          </Text>
        </View>
        <Text style={[styles.subtitle, { color: colors.mutedForeground, textAlign: align }]}>
          {t('faqSubtitle')}
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.column}>
          {ENTRIES.map(entry => {
            const isOpen = open === entry.q;
            return (
              <View
                key={entry.q}
                style={[
                  styles.card,
                  {
                    backgroundColor: colors.card,
                    borderColor: isOpen ? colors.primary + '40' : colors.border,
                  },
                ]}
              >
                <Pressable
                  onPress={() => toggle(entry.q)}
                  style={[styles.qRow, { flexDirection: rowDir }]}
                  accessibilityRole="button"
                  accessibilityState={{ expanded: isOpen }}
                >
                  <Text style={[styles.question, { color: colors.foreground, textAlign: align, flex: 1 }]}>
                    {t(entry.q)}
                  </Text>
                  <Ionicons
                    name={isOpen ? 'chevron-up' : 'chevron-down'}
                    size={17}
                    color={isOpen ? colors.primary : colors.mutedForeground}
                  />
                </Pressable>
                {isOpen ? (
                  <Text
                    style={[
                      styles.answer,
                      {
                        color: colors.mutedForeground,
                        textAlign: align,
                        writingDirection: isRTL ? 'rtl' : 'ltr',
                      },
                    ]}
                  >
                    {t(entry.a)}
                  </Text>
                ) : null}
              </View>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 20, paddingBottom: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  headerRow: { alignItems: 'center', gap: 12 },
  title: { fontFamily: 'Cairo_700Bold', fontSize: 20 },
  subtitle: { fontFamily: 'Almarai_400Regular', fontSize: 12.5, lineHeight: 20, marginTop: 6 },
  body: { padding: 16 },
  // Matches the chat column so the page does not sprawl on a desktop browser.
  column: { width: '100%', maxWidth: 760, alignSelf: 'center', gap: 10 },
  card: { borderWidth: 1, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 4 },
  qRow: { alignItems: 'center', gap: 10, paddingVertical: 12 },
  question: { fontFamily: 'Cairo_600SemiBold', fontSize: 14 },
  answer: {
    fontFamily: 'Almarai_400Regular',
    fontSize: 13,
    lineHeight: 23,
    paddingBottom: 14,
    paddingTop: 2,
  },
});
