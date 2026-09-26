import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import { markAppIntroSeen } from '@/services/appIntro';
import { BrandLogo } from '@/components/ui/BrandLogo';
import { Button } from '@/components/ui/Button';
import type { Palette } from '@/constants/colors';
import type { TranslationKey } from '@/services/i18n';

type IconName = keyof typeof Ionicons.glyphMap;

type Slide = {
  icon: IconName;
  /** A palette token, not a hex: the slide colours have to hold up in dark mode too. */
  tone: 'primary' | 'info' | 'warning' | 'success';
  titleKey: TranslationKey;
  descKey: TranslationKey;
  /** Newline-separated, one line per entry in `pointIcons`. */
  pointsKey: TranslationKey;
  pointIcons: [IconName, IconName, IconName];
};

// One idea per slide, in the order a teacher would actually discover them:
// what this is and who to ask, how a lesson comes together, what it produces
// for the classroom, then the classes it all runs in.
//
// The last slide is the exception, and it is here because this screen is shown
// before login — to everyone, not only to teachers. Parents and students have
// been able to sign up since STUDENT_ACCOUNTS went on, and a run of
// lesson-preparation slides told them they had the wrong app.
//
// The keys are not renumbered as slides come and go: they are identifiers, and
// a gap costs nothing next to rewriting every one of them in two locales.
const SLIDES: Slide[] = [
  { icon: 'library-outline', tone: 'primary', titleKey: 'onboardingSlide1Title', descKey: 'onboardingSlide1Desc', pointsKey: 'onboardingSlide1Points', pointIcons: ['school-outline', 'book-outline', 'language-outline'] },
  { icon: 'chatbubbles-outline', tone: 'info', titleKey: 'onboardingSlide6Title', descKey: 'onboardingSlide6Desc', pointsKey: 'onboardingSlide6Points', pointIcons: ['book-outline', 'bulb-outline', 'arrow-redo-outline'] },
  { icon: 'git-branch-outline', tone: 'primary', titleKey: 'onboardingSlide2Title', descKey: 'onboardingSlide2Desc', pointsKey: 'onboardingSlide2Points', pointIcons: ['flag-outline', 'people-outline', 'exit-outline'] },
  { icon: 'tv-outline', tone: 'warning', titleKey: 'onboardingSlide4Title', descKey: 'onboardingSlide4Desc', pointsKey: 'onboardingSlide4Points', pointIcons: ['easel-outline', 'trophy-outline', 'image-outline'] },
  { icon: 'document-text-outline', tone: 'success', titleKey: 'onboardingSlide7Title', descKey: 'onboardingSlide7Desc', pointsKey: 'onboardingSlide7Points', pointIcons: ['stats-chart-outline', 'key-outline', 'checkmark-done-outline'] },
  { icon: 'phone-portrait-outline', tone: 'info', titleKey: 'onboardingSlide8Title', descKey: 'onboardingSlide8Desc', pointsKey: 'onboardingSlide8Points', pointIcons: ['sparkles-outline', 'link-outline', 'ribbon-outline'] },
  { icon: 'calendar-outline', tone: 'warning', titleKey: 'onboardingSlide9Title', descKey: 'onboardingSlide9Desc', pointsKey: 'onboardingSlide9Points', pointIcons: ['people-circle-outline', 'time-outline', 'map-outline'] },
  { icon: 'people-outline', tone: 'success', titleKey: 'onboardingSlide5Title', descKey: 'onboardingSlide5Desc', pointsKey: 'onboardingSlide5Points', pointIcons: ['key-outline', 'mail-outline', 'library-outline'] },
];

/**
 * First-run product intro, shown once per install before the teacher ever
 * reaches login. Deliberately not swipe-driven: this app expresses RTL
 * per-component rather than via the OS layout direction (see STATUS.md's
 * web-RTL writeup), and a horizontal ScrollView's physical scroll axis
 * doesn't follow that — so paging is button/dot driven instead, which
 * behaves identically in both languages.
 *
 * Each slide's illustration is drawn from the theme rather than shipped as an
 * image: it follows the language, the RTL flip and dark mode for free, and
 * adds nothing to the bundle.
 */
export default function OnboardingScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { t, lang, isRTL, toggleLang } = useLanguage();
  const [index, setIndex] = useState(0);
  const enter = useRef(new Animated.Value(1)).current;

  const isLast = index === SLIDES.length - 1;
  const slide = SLIDES[index];
  const tone = (colors as Palette)[slide.tone];
  const row = isRTL ? 'row-reverse' : 'row';
  const dir = isRTL ? 'rtl' : 'ltr';

  // A short fade-and-rise on every slide change, so the new content reads as
  // new. Skipped under Reduce Motion — the change is just the swap then.
  useEffect(() => {
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled().then(reduced => {
      if (cancelled || reduced) return;
      enter.setValue(0);
      Animated.timing(enter, { toValue: 1, duration: 260, useNativeDriver: true }).start();
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [index, enter]);

  const finish = async () => {
    await markAppIntroSeen();
    router.replace('/(auth)/login');
  };

  // Button already fires its own light haptic.
  const handleNext = () => {
    if (isLast) {
      void finish();
    } else {
      setIndex(i => i + 1);
    }
  };

  const handleBack = () => setIndex(i => Math.max(0, i - 1));

  const handleSkip = () => {
    Haptics.selectionAsync();
    void finish();
  };

  const points = t(slide.pointsKey).split('\n');
  const animated = {
    opacity: enter,
    transform: [{ translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }],
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background, paddingTop: insets.top + 12, paddingBottom: insets.bottom + 20 }]}>
      <View style={[styles.topBar, { flexDirection: row }]}>
        <BrandLogo variant="mark" width={24} height={22} accessibilityLabel="Iqraa" />
        <View style={[styles.topBarActions, { flexDirection: row }]}>
          <Pressable
            onPress={() => { Haptics.selectionAsync(); toggleLang(); }}
            style={[styles.langBtn, { borderColor: colors.border }]}
            accessibilityRole="button"
            accessibilityLabel={lang === 'ar' ? 'التبديل إلى الإنجليزية' : 'Switch to Arabic'}
          >
            <Ionicons name="language-outline" size={16} color={colors.mutedForeground} />
            <Text style={[styles.langBtnText, { color: colors.mutedForeground, fontFamily: 'Cairo_500Medium' }]}>
              {lang === 'ar' ? 'English' : 'عربي'}
            </Text>
          </Pressable>
          {!isLast && (
            <Pressable onPress={handleSkip} hitSlop={12} accessibilityRole="button">
              <Text style={[styles.skipText, { color: colors.mutedForeground, fontFamily: 'Cairo_600SemiBold' }]}>
                {t('onboardingSkip')}
              </Text>
            </Pressable>
          )}
        </View>
      </View>

      <Animated.View style={[styles.content, animated]}>
        {/* Headline first, then the card as its proof: that is the order the
            eye reads it, and the order a screen reader announces it. */}
        <Text
          accessibilityRole="header"
          style={[styles.title, { color: colors.foreground, fontFamily: 'Cairo_700Bold', writingDirection: dir }]}
        >
          {t(slide.titleKey)}
        </Text>
        <Text style={[styles.desc, { color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', writingDirection: dir }]}>
          {t(slide.descKey)}
        </Text>

        {/* The illustration: a feature card in the slide's tone, its three
            points as rows, soft blobs behind. The rows are real text, so the
            card reads out as content rather than an unlabelled image. */}
        <View style={styles.stage}>
          <View style={[styles.blob, styles.blobA, { backgroundColor: tone + '1F' }]} />
          <View style={[styles.blob, styles.blobB, { backgroundColor: colors.accent + '26' }]} />
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[styles.cardHead, { backgroundColor: tone + '14' }]}>
              <View style={[styles.cardIcon, { backgroundColor: tone }]}>
                <Ionicons name={slide.icon} size={26} color={colors.card} />
              </View>
            </View>
            {points.map((p, i) => (
              <View key={p} style={[styles.pointRow, { flexDirection: row, borderTopColor: colors.border }]}>
                <View style={[styles.pointIcon, { backgroundColor: tone + '1A' }]}>
                  <Ionicons name={slide.pointIcons[i] ?? 'checkmark'} size={18} color={tone} />
                </View>
                <Text style={[styles.pointText, { color: colors.cardForeground, fontFamily: 'Cairo_600SemiBold', textAlign: isRTL ? 'right' : 'left', writingDirection: dir }]}>
                  {p}
                </Text>
                <Ionicons name="checkmark-circle" size={18} color={colors.success} />
              </View>
            ))}
          </View>
        </View>
      </Animated.View>

      <View style={styles.footer}>
        <View style={[styles.dots, { flexDirection: row }]}>
          {/* A dot has no text child, so nothing names it: the label is the
              position rather than the slide's title — the title is already
              read out as the heading above. Which dot is current needs saying
              twice: `accessibilityState.selected` for iOS/Android, and
              `aria-current="step"`, because React Native Web drops `selected`
              on role="button" and emits nothing at all.

              The target is padding around the visible bar, not hitSlop:
              React Native Web ignores hitSlop, and an 8px dot was missed
              by real clicks on web. */}
          {SLIDES.map((s, i) => (
            <Pressable
              key={s.titleKey}
              onPress={() => { Haptics.selectionAsync(); setIndex(i); }}
              accessibilityRole="button"
              accessibilityLabel={t('onboardingSlideLabel', i + 1, SLIDES.length)}
              accessibilityState={{ selected: i === index }}
              aria-current={i === index ? 'step' : undefined}
              style={styles.dotTarget}
            >
              <View
                style={[
                  styles.dot,
                  {
                    backgroundColor: i === index ? colors.primary : colors.border,
                    width: i === index ? 22 : 8,
                  },
                ]}
              />
            </Pressable>
          ))}
        </View>
        <View style={[styles.actions, { flexDirection: row }]}>
          {index > 0 && (
            <Button label={t('onboardingBack')} onPress={handleBack} variant="secondary" size="lg" style={styles.backBtn} />
          )}
          <Button
            label={isLast ? t('onboardingGetStarted') : t('onboardingNext')}
            onPress={handleNext}
            size="lg"
            style={styles.nextBtn}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: 24 },
  topBar: { alignItems: 'center', justifyContent: 'space-between' },
  topBarActions: { alignItems: 'center', gap: 16 },
  langBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 36,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
  },
  langBtnText: { fontSize: 13 },
  skipText: { fontSize: 15 },

  content: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, alignSelf: 'center', width: '100%', maxWidth: 440 },
  stage: { width: '100%', maxWidth: 340, marginTop: 18 },
  blob: { position: 'absolute', borderRadius: 999 },
  blobA: { width: 220, height: 220, top: -36, left: -40 },
  blobB: { width: 150, height: 150, bottom: -30, right: -30 },
  card: {
    borderRadius: 20,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#0B1B33',
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  cardHead: { alignItems: 'center', padding: 14 },
  cardIcon: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  pointRow: { alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: 1 },
  pointIcon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  pointText: { flex: 1, fontSize: 14, lineHeight: 22 },

  title: { fontSize: 26, lineHeight: 36, maxWidth: 380, textAlign: 'center' },
  desc: { fontSize: 16, lineHeight: 26, maxWidth: 380, textAlign: 'center' },

  footer: { gap: 20, paddingTop: 12, alignSelf: 'center', width: '100%', maxWidth: 440 },
  dots: { alignSelf: 'center', alignItems: 'center' },
  dotTarget: { minWidth: 24, minHeight: 24, paddingHorizontal: 4, alignItems: 'center', justifyContent: 'center' },
  dot: { height: 8, borderRadius: 4 },
  actions: { gap: 12 },
  backBtn: { flex: 1 },
  nextBtn: { flex: 2 },
});
