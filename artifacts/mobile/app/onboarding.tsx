import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import { markAppIntroSeen } from '@/services/appIntro';
import { BrandLogo } from '@/components/ui/BrandLogo';
import { Button } from '@/components/ui/Button';
import type { TranslationKey } from '@/services/i18n';

type Slide = {
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  titleKey: TranslationKey;
  descKey: TranslationKey;
};

// One idea per slide, in the order a teacher would actually discover them:
// what this is, how a full lesson comes together, then the tools that carry a
// class from before to after.
//
// The last slide is the exception, and it is here because this screen is shown
// before login — to everyone, not only to teachers. Parents and students have
// been able to sign up since STUDENT_ACCOUNTS went on, and three slides of
// lesson-preparation features told them they had the wrong app.
//
// The keys are not renumbered as slides come and go: they are identifiers, and
// a gap costs nothing next to rewriting every one of them in two locales.
const SLIDES: Slide[] = [
  { icon: 'sparkles-outline', color: '#00A99D', titleKey: 'onboardingSlide1Title', descKey: 'onboardingSlide1Desc' },
  { icon: 'git-branch-outline', color: '#0EA5E9', titleKey: 'onboardingSlide2Title', descKey: 'onboardingSlide2Desc' },
  { icon: 'tv-outline', color: '#F59E0B', titleKey: 'onboardingSlide4Title', descKey: 'onboardingSlide4Desc' },
  { icon: 'people-outline', color: '#7C3AED', titleKey: 'onboardingSlide5Title', descKey: 'onboardingSlide5Desc' },
];

/**
 * First-run product intro, shown once per install before the teacher ever
 * reaches login. Deliberately not swipe-driven: this app expresses RTL
 * per-component rather than via the OS layout direction (see STATUS.md's
 * web-RTL writeup), and a horizontal ScrollView's physical scroll axis
 * doesn't follow that — so paging is button/dot driven instead, which
 * behaves identically in both languages.
 */
export default function OnboardingScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { t, lang, isRTL, toggleLang } = useLanguage();
  const [index, setIndex] = useState(0);

  const isLast = index === SLIDES.length - 1;
  const slide = SLIDES[index];

  const finish = async () => {
    await markAppIntroSeen();
    router.replace('/(auth)/login');
  };

  const handleNext = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (isLast) {
      void finish();
    } else {
      setIndex(i => i + 1);
    }
  };

  const handleSkip = () => {
    Haptics.selectionAsync();
    void finish();
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background, paddingTop: insets.top + 12, paddingBottom: insets.bottom + 20 }]}>
      <View style={[styles.topBar, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
        <BrandLogo variant="mark" width={24} height={22} accessibilityLabel="IQRA" />
        <View style={[styles.topBarActions, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
          <Pressable
            onPress={() => { Haptics.selectionAsync(); toggleLang(); }}
            style={[styles.langBtn, { borderColor: colors.border }]}
            accessibilityRole="button"
            accessibilityLabel={lang === 'ar' ? 'التبديل إلى الإنجليزية' : 'Switch to Arabic'}
          >
            <Ionicons name="language-outline" size={14} color={colors.mutedForeground} />
            <Text style={[styles.langBtnText, { color: colors.mutedForeground, fontFamily: 'Cairo_500Medium' }]}>
              {lang === 'ar' ? 'English' : 'عربي'}
            </Text>
          </Pressable>
          {!isLast && (
            <Pressable onPress={handleSkip} hitSlop={8}>
              <Text style={[styles.skipText, { color: colors.mutedForeground, fontFamily: 'Cairo_600SemiBold' }]}>
                {t('onboardingSkip')}
              </Text>
            </Pressable>
          )}
        </View>
      </View>

      <View style={styles.content}>
        <View style={[styles.iconCircle, { backgroundColor: slide.color + '18' }]}>
          <Ionicons name={slide.icon} size={56} color={slide.color} />
        </View>
        <Text
          style={[
            styles.title,
            { color: colors.foreground, fontFamily: 'Cairo_700Bold', textAlign: 'center', writingDirection: isRTL ? 'rtl' : 'ltr' },
          ]}
        >
          {t(slide.titleKey)}
        </Text>
        <Text
          style={[
            styles.desc,
            { color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', textAlign: 'center', writingDirection: isRTL ? 'rtl' : 'ltr' },
          ]}
        >
          {t(slide.descKey)}
        </Text>
      </View>

      <View style={styles.footer}>
        <View style={[styles.dots, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
          {/* A dot has no text child, so nothing names it: the a11y tree showed
              four unlabelled targets in a row and no way to tell which was
              current. The label is the position rather than the slide's title —
              the title is already read out as the heading directly above, and
              hearing it twice says nothing about where you are. `selected`
              carries the current one, which is the part the visual width
              conveys and assistive tech otherwise cannot see. */}
          {SLIDES.map((s, i) => (
            <Pressable
              key={s.titleKey}
              onPress={() => { Haptics.selectionAsync(); setIndex(i); }}
              hitSlop={6}
              accessibilityRole="button"
              accessibilityLabel={t('onboardingSlideLabel', i + 1, SLIDES.length)}
              accessibilityState={{ selected: i === index }}
              style={[
                styles.dot,
                {
                  backgroundColor: i === index ? colors.primary : colors.border,
                  width: i === index ? 20 : 7,
                },
              ]}
            />
          ))}
        </View>
        <Button
          label={isLast ? t('onboardingGetStarted') : t('onboardingNext')}
          onPress={handleNext}
          size="lg"
          fullWidth
        />
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
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  langBtnText: { fontSize: 12 },
  skipText: { fontSize: 14 },

  content: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 18, paddingHorizontal: 8 },
  iconCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  title: { fontSize: 24, lineHeight: 32, maxWidth: 340 },
  desc: { fontSize: 15, lineHeight: 24, maxWidth: 340 },

  footer: { gap: 20, paddingTop: 12 },
  dots: { alignSelf: 'center', alignItems: 'center', gap: 8 },
  dot: { height: 7, borderRadius: 4 },
});
