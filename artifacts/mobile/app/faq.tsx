/**
 * How to use Iqraa — as questions, not as a tour.
 *
 * This replaced re-opening the "start here" coach card on the retired home
 * screen. That card answered one question ("what is this?") once, at a moment
 * chosen by the app; a teacher who comes looking later has a specific question
 * and wants that one answered. Questions also survive the product changing —
 * an answer can be rewritten without redesigning a walkthrough.
 *
 * Eighteen questions are too many to scan as one flat list, so the screen
 * gives three ways in: search for the word you remember, a topic chip, or the
 * three-step strip for someone who has never opened the app. What the
 * questions are, and how they are grouped and searched, lives in
 * `services/faqContent.ts` so it can be tested.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  LayoutAnimation,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  UIManager,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import { goBack } from '@/services/navigation';
import {
  FAQ_CATEGORIES,
  FAQ_ENTRIES,
  filterFaq,
  type FaqCategoryId,
  type FaqEntry,
} from '@/services/faqContent';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type Glyph = keyof typeof Ionicons.glyphMap;

const STEPS: { icon: Glyph; key: 'faqStep1' | 'faqStep2' | 'faqStep3' }[] = [
  { icon: 'book-outline', key: 'faqStep1' },
  { icon: 'document-text-outline', key: 'faqStep2' },
  { icon: 'tv-outline', key: 'faqStep3' },
];

const ICON_BY_CATEGORY = Object.fromEntries(FAQ_CATEGORIES.map(c => [c.id, c.icon])) as Record<
  FaqCategoryId,
  Glyph
>;

export default function FaqScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { t, isRTL } = useLanguage();
  // The first question is open on arrival, so the screen shows an answer rather
  // than a list of closed rows that all look like buttons.
  const [open, setOpen] = useState<string | null>('faqQ1');
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<FaqCategoryId | 'all'>('all');
  const [focused, setFocused] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  const chipScroller = useRef<ScrollView>(null);

  // onContentSizeChange alone is not enough on web, where it can fire before the
  // scroller has a width to scroll within.
  useEffect(() => {
    if (!isRTL) return;
    const id = setTimeout(() => chipScroller.current?.scrollToEnd({ animated: false }), 60);
    return () => clearTimeout(id);
  }, [isRTL]);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion).catch(() => {});
  }, []);

  const align = isRTL ? 'right' : 'left' as const;
  const rowDir = isRTL ? 'row-reverse' : 'row' as const;
  const searching = query.trim().length > 0;

  const results = useMemo(
    () => filterFaq(FAQ_ENTRIES, query, category, t),
    [query, category, t],
  );

  const animate = () => {
    if (!reduceMotion) LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
  };

  const toggle = (key: string) => {
    void Haptics.selectionAsync().catch(() => {});
    animate();
    setOpen(prev => (prev === key ? null : key));
  };

  const pickCategory = (id: FaqCategoryId | 'all') => {
    void Haptics.selectionAsync().catch(() => {});
    animate();
    setCategory(id);
  };

  // A lone search hit opens itself: the teacher typed a word to reach an answer.
  const isOpen = (key: string) => open === key || (searching && results.length === 1);

  // Grouped under topic headers only when nothing is narrowing the list.
  const grouped = category === 'all' && !searching;

  const renderEntry = (entry: FaqEntry) => {
    const expanded = isOpen(entry.q);
    return (
      <View
        key={entry.q}
        style={[
          styles.card,
          {
            backgroundColor: colors.card,
            borderColor: expanded ? colors.primary + '55' : colors.border,
          },
        ]}
      >
        <Pressable
          onPress={() => toggle(entry.q)}
          style={({ pressed }) => [
            styles.qRow,
            { flexDirection: rowDir, opacity: pressed ? 0.7 : 1 },
          ]}
          accessibilityRole="button"
          aria-expanded={expanded}
        >
          <View
            style={[
              styles.badge,
              { backgroundColor: expanded ? colors.primary : colors.secondary },
            ]}
          >
            <Ionicons
              name={ICON_BY_CATEGORY[entry.category]}
              size={17}
              color={expanded ? colors.primaryForeground : colors.secondaryForeground}
            />
          </View>
          <Text style={[styles.question, { color: colors.foreground, textAlign: align, flex: 1 }]}>
            {t(entry.q)}
          </Text>
          <Ionicons
            name={expanded ? 'chevron-up' : 'chevron-down'}
            size={18}
            color={expanded ? colors.primary : colors.mutedForeground}
          />
        </Pressable>
        {expanded ? (
          <View
            style={[
              styles.answerWrap,
              { flexDirection: rowDir },
            ]}
          >
            <View style={[styles.rule, { backgroundColor: colors.primary + '40' }]} />
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
          </View>
        ) : null}
      </View>
    );
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
        {/* Same column as the list, so the header lines up with the cards on a wide screen. */}
        <View style={styles.column}>
          <View style={[styles.headerRow, { flexDirection: rowDir }]}>
            <Pressable
              onPress={() => goBack()}
              hitSlop={8}
              style={styles.backBtn}
              accessibilityRole="button"
              accessibilityLabel={t('back')}
            >
              <Ionicons
                name={isRTL ? 'arrow-forward' : 'arrow-back'}
                size={22}
                color={colors.foreground}
              />
            </Pressable>
            <View style={[styles.heroBadge, { backgroundColor: colors.secondary }]}>
              <Ionicons name="help-buoy-outline" size={20} color={colors.secondaryForeground} />
            </View>
            <Text
              accessibilityRole="header"
              style={[styles.title, { color: colors.foreground, textAlign: align, flex: 1 }]}
            >
              {t('faqTitle')}
            </Text>
          </View>
          <Text style={[styles.subtitle, { color: colors.mutedForeground, textAlign: align }]}>
            {t('faqSubtitle')}
          </Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.column}>
          <View
            style={[
              styles.search,
              {
                flexDirection: rowDir,
                backgroundColor: colors.card,
                borderColor: focused ? colors.primary : colors.border,
              },
            ]}
          >
            <Ionicons name="search-outline" size={19} color={colors.mutedForeground} />
            <TextInput
              value={query}
              onChangeText={text => {
                animate();
                setQuery(text);
              }}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              placeholder={t('faqSearchPlaceholder')}
              placeholderTextColor={colors.mutedForeground}
              accessibilityLabel={t('faqSearchPlaceholder')}
              returnKeyType="search"
              style={[
                styles.searchInput,
                {
                  color: colors.foreground,
                  textAlign: align,
                  writingDirection: isRTL ? 'rtl' : 'ltr',
                },
                Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null,
              ]}
            />
            {searching ? (
              <Pressable
                onPress={() => setQuery('')}
                hitSlop={8}
                style={styles.clearBtn}
                accessibilityRole="button"
                accessibilityLabel={t('faqSearchClear')}
              >
                <Ionicons name="close-circle" size={20} color={colors.mutedForeground} />
              </Pressable>
            ) : null}
          </View>

          {!searching && category === 'all' ? (
            <View style={styles.quick}>
              <Text style={[styles.sectionLabel, { color: colors.mutedForeground, textAlign: align }]}>
                {t('faqQuickTitle')}
              </Text>
              <View style={[styles.steps, { flexDirection: rowDir }]}>
                {STEPS.map((step, i) => (
                  <View
                    key={step.key}
                    style={[styles.step, { backgroundColor: colors.card, borderColor: colors.border }]}
                  >
                    <View style={[styles.stepIcon, { backgroundColor: colors.secondary }]}>
                      <Ionicons name={step.icon} size={20} color={colors.secondaryForeground} />
                    </View>
                    <Text style={[styles.stepNum, { color: colors.primary }]}>{i + 1}</Text>
                    <Text style={[styles.stepText, { color: colors.foreground }]}>{t(step.key)}</Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          <ScrollView
            ref={chipScroller}
            horizontal
            showsHorizontalScrollIndicator={false}
            // A reversed row still opens scrolled to its far end; bring the first chip into view.
            onContentSizeChange={() => {
              if (isRTL) chipScroller.current?.scrollToEnd({ animated: false });
            }}
            // Reversed rows so the first chip sits at the start edge in Arabic too.
            contentContainerStyle={[styles.chips, { flexDirection: rowDir }]}
          >
            {[{ id: 'all' as const, labelKey: 'faqCatAll' as const, icon: 'apps-outline' as Glyph },
              ...FAQ_CATEGORIES].map(c => {
              const selected = category === c.id;
              return (
                <Pressable
                  key={c.id}
                  onPress={() => pickCategory(c.id)}
                  accessibilityRole="button"
                  aria-selected={selected}
                  style={({ pressed }) => [
                    styles.chip,
                    {
                      flexDirection: rowDir,
                      backgroundColor: selected ? colors.primary : colors.card,
                      borderColor: selected ? colors.primary : colors.border,
                      opacity: pressed ? 0.75 : 1,
                    },
                  ]}
                >
                  <Ionicons
                    name={c.icon as Glyph}
                    size={15}
                    color={selected ? colors.primaryForeground : colors.mutedForeground}
                  />
                  <Text
                    style={[
                      styles.chipText,
                      { color: selected ? colors.primaryForeground : colors.foreground },
                    ]}
                  >
                    {t(c.labelKey)}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <View style={styles.list}>
            {results.length === 0 ? (
              <View style={[styles.empty, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Ionicons name="search-outline" size={26} color={colors.mutedForeground} />
                <Text style={[styles.emptyTitle, { color: colors.foreground }]}>{t('faqNoResults')}</Text>
                <Text style={[styles.emptyHint, { color: colors.mutedForeground }]}>
                  {t('faqNoResultsHint')}
                </Text>
              </View>
            ) : grouped ? (
              FAQ_CATEGORIES.map(cat => {
                const items = results.filter(e => e.category === cat.id);
                if (!items.length) return null;
                return (
                  <View key={cat.id} style={styles.group}>
                    <Text style={[styles.sectionLabel, { color: colors.mutedForeground, textAlign: align }]}>
                      {t(cat.labelKey)}
                    </Text>
                    {items.map(renderEntry)}
                  </View>
                );
              })
            ) : (
              <View style={styles.group}>{results.map(renderEntry)}</View>
            )}
          </View>

          <View style={[styles.still, { backgroundColor: colors.secondary, borderColor: colors.primary + '30' }]}>
            <Text style={[styles.stillTitle, { color: colors.secondaryForeground, textAlign: align }]}>
              {t('faqStillTitle')}
            </Text>
            <Text style={[styles.stillBody, { color: colors.foreground, textAlign: align }]}>
              {t('faqStillBody')}
            </Text>
            <View style={[styles.stillActions, { flexDirection: rowDir }]}>
              <Pressable
                onPress={() => router.push('/iqra')}
                accessibilityRole="button"
                style={({ pressed }) => [
                  styles.cta,
                  { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1, flexDirection: rowDir },
                ]}
              >
                <Ionicons name="chatbubble-ellipses-outline" size={18} color={colors.primaryForeground} />
                <Text style={[styles.ctaText, { color: colors.primaryForeground }]}>{t('faqAskIqra')}</Text>
              </Pressable>
              <Pressable
                onPress={() => router.push('/suggest-feature')}
                accessibilityRole="button"
                style={({ pressed }) => [
                  styles.cta,
                  {
                    backgroundColor: colors.card,
                    borderColor: colors.border,
                    borderWidth: 1,
                    opacity: pressed ? 0.85 : 1,
                    flexDirection: rowDir,
                  },
                ]}
              >
                <Ionicons name="bulb-outline" size={18} color={colors.foreground} />
                <Text style={[styles.ctaText, { color: colors.foreground }]}>{t('suggestFeature')}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 20, paddingBottom: 16, borderBottomWidth: StyleSheet.hairlineWidth },
  headerRow: { alignItems: 'center', gap: 10 },
  backBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  heroBadge: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: 'ReadexPro_700Bold', fontSize: 21 },
  subtitle: { fontFamily: 'Almarai_400Regular', fontSize: 15, lineHeight: 23, marginTop: 4 },
  body: { padding: 16 },
  // Matches the chat column so the page does not sprawl on a desktop browser.
  column: { width: '100%', maxWidth: 760, alignSelf: 'center' },

  search: {
    alignItems: 'center',
    gap: 10,
    borderWidth: 1.5,
    borderRadius: 14,
    paddingHorizontal: 14,
    minHeight: 48,
  },
  searchInput: { flex: 1, fontFamily: 'Almarai_400Regular', fontSize: 15, paddingVertical: 10 },
  clearBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },

  quick: { marginTop: 18 },
  sectionLabel: { fontFamily: 'ReadexPro_700Bold', fontSize: 13, letterSpacing: 0.2, marginBottom: 8 },
  steps: { gap: 10 },
  step: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 8,
  },
  stepIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  stepNum: { fontFamily: 'ReadexPro_700Bold', fontSize: 12 },
  stepText: { fontFamily: 'ReadexPro_600SemiBold', fontSize: 13, textAlign: 'center' },

  // flexGrow so a reversed (Arabic) row fills the scroller and hugs the start edge.
  chips: { gap: 8, paddingVertical: 16, flexGrow: 1 },
  chip: {
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 14,
    minHeight: 40,
  },
  chipText: { fontFamily: 'ReadexPro_600SemiBold', fontSize: 13 },

  list: { gap: 20 },
  group: { gap: 10 },
  card: { borderWidth: 1, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 4 },
  qRow: { alignItems: 'center', gap: 12, paddingVertical: 12, minHeight: 56 },
  badge: { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  question: { fontFamily: 'ReadexPro_600SemiBold', fontSize: 15, lineHeight: 24 },
  answerWrap: { gap: 12, paddingBottom: 14, paddingTop: 2 },
  rule: { width: 3, borderRadius: 2 },
  answer: { flex: 1, fontFamily: 'Almarai_400Regular', fontSize: 15, lineHeight: 25 },

  empty: { alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 16, padding: 28 },
  emptyTitle: { fontFamily: 'ReadexPro_700Bold', fontSize: 15 },
  emptyHint: { fontFamily: 'Almarai_400Regular', fontSize: 13, textAlign: 'center' },

  still: { marginTop: 28, borderWidth: 1, borderRadius: 20, padding: 18, gap: 6 },
  stillTitle: { fontFamily: 'ReadexPro_700Bold', fontSize: 16 },
  stillBody: { fontFamily: 'Almarai_400Regular', fontSize: 15, lineHeight: 23 },
  stillActions: { gap: 10, marginTop: 10, flexWrap: 'wrap' },
  cta: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 12,
    paddingHorizontal: 16,
    minHeight: 46,
    flexGrow: 1,
  },
  ctaText: { fontFamily: 'ReadexPro_700Bold', fontSize: 14 },
});
