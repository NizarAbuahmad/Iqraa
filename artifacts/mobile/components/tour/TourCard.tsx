/**
 * The card a tour step speaks from: where you are, the title and the sentence,
 * and the three ways on. On a solid card rather than on the dim layer, so the
 * text keeps its contrast in light and dark and in both languages.
 *
 * Rows flip with `isRTL` per component, as everywhere in the app (the layout
 * direction is pinned LTR; see LanguageContext). The buttons are local Pressables
 * and not `Button`, which does not forward a ref, and the overlay needs one on
 * Next to move keyboard focus there on web.
 */
import React, { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import { useSurface } from '@/components/ui/Surface';
import { RADIUS, SPACE, TYPE } from '@/constants/theme';
import type { TourStep } from '@/services/tour';

type Props = {
  step: TourStep;
  index: number;
  total: number;
  width: number;
  style?: StyleProp<ViewStyle>;
  cardRef?: React.Ref<View>;
  nextRef?: React.Ref<View>;
  onLayout?: (e: LayoutChangeEvent) => void;
  onNext: () => void;
  onBack: () => void;
  onSkip: () => void;
};

/**
 * The brand's keyboard focus ring on web — the same 3px ring `PressableScale`
 * draws. Focus moves to Next on every step, and the browser's own ring there is a
 * heavy black outline that is not the app's.
 */
function useFocusRing() {
  const colors = useColors();
  const [focused, setFocused] = useState(false);
  return {
    onFocus: () => setFocused(true),
    onBlur: () => setFocused(false),
    ringStyle:
      Platform.OS === 'web'
        ? ({
            cursor: 'pointer',
            ...(focused ? { outlineStyle: 'solid', outlineWidth: 3, outlineColor: colors.primary, outlineOffset: 2 } : {}),
          } as object)
        : null,
  };
}

function TourButton({
  label,
  onPress,
  primary,
  buttonRef,
  style,
}: {
  label: string;
  onPress: () => void;
  primary?: boolean;
  buttonRef?: React.Ref<View>;
  style?: StyleProp<ViewStyle>;
}) {
  const colors = useColors();
  const { onFocus, onBlur, ringStyle } = useFocusRing();
  return (
    <Pressable
      ref={buttonRef}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
      }}
      onFocus={onFocus}
      onBlur={onBlur}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: primary ? colors.primary : colors.secondary,
          opacity: pressed ? 0.75 : 1,
        },
        style,
        ringStyle,
      ]}
    >
      <Text
        style={[
          styles.buttonLabel,
          { color: primary ? colors.primaryForeground : colors.secondaryForeground },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function SkipButton({ label, onPress }: { label: string; onPress: () => void }) {
  const colors = useColors();
  const { onFocus, onBlur, ringStyle } = useFocusRing();
  return (
    <Pressable onPress={onPress} onFocus={onFocus} onBlur={onBlur} accessibilityRole="button" style={[styles.skip, ringStyle]}>
      <Text style={[styles.skipLabel, { color: colors.mutedForeground }]}>{label}</Text>
    </Pressable>
  );
}

export function TourCard({ step, index, total, width, style, cardRef, nextRef, onLayout, onNext, onBack, onSkip }: Props) {
  const colors = useColors();
  const { t, isRTL } = useLanguage();
  const surface = useSurface('raised');
  const row = isRTL ? 'row-reverse' : 'row';
  const align = isRTL ? 'right' : 'left';
  const dir = isRTL ? 'rtl' : 'ltr';
  const isLast = index === total - 1;

  return (
    <View
      ref={cardRef}
      onLayout={onLayout}
      accessibilityViewIsModal
      role="dialog"
      aria-modal
      aria-label={t('tourDialogLabel')}
      style={[surface, styles.card, { width }, style]}
    >
      <View style={[styles.topRow, { flexDirection: row }]}>
        <Text style={[styles.counter, { color: colors.mutedForeground, writingDirection: dir }]}>
          {t('tourStepOf', index + 1, total)}
        </Text>
        {!isLast ? <SkipButton label={t('onboardingSkip')} onPress={onSkip} /> : null}
      </View>

      <Text
        accessibilityRole="header"
        style={[styles.title, { color: colors.foreground, textAlign: align, writingDirection: dir }]}
      >
        {t(step.titleKey)}
      </Text>
      <Text style={[styles.body, { color: colors.mutedForeground, textAlign: align, writingDirection: dir }]}>
        {t(step.bodyKey)}
      </Text>

      {/* Decorative: the counter above already says where you are. */}
      <View
        style={[styles.dots, { flexDirection: row }]}
        aria-hidden
        importantForAccessibility="no-hide-descendants"
      >
        {Array.from({ length: total }, (_, i) => (
          <View
            key={i}
            style={[
              styles.dot,
              { backgroundColor: i === index ? colors.primary : colors.border, width: i === index ? 20 : 8 },
            ]}
          />
        ))}
      </View>

      <View style={[styles.actions, { flexDirection: row }]}>
        {index > 0 ? <TourButton label={t('onboardingBack')} onPress={onBack} style={styles.back} /> : null}
        <TourButton
          label={isLast ? t('tourDone') : t('onboardingNext')}
          onPress={onNext}
          primary
          buttonRef={nextRef}
          style={styles.next}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: SPACE.lg, gap: SPACE.sm },
  topRow: { alignItems: 'center', justifyContent: 'space-between', minHeight: 44 },
  counter: { fontSize: TYPE.caption, fontFamily: 'Almarai_400Regular' },
  // The target is padding around the label, not hitSlop: react-native-web ignores hitSlop.
  skip: { minHeight: 44, minWidth: 44, paddingHorizontal: SPACE.sm, alignItems: 'center', justifyContent: 'center' },
  skipLabel: { fontSize: TYPE.label, fontFamily: 'ReadexPro_600SemiBold' },
  title: { fontSize: TYPE.title, lineHeight: 30, fontFamily: 'ReadexPro_700Bold' },
  body: { fontSize: TYPE.body, lineHeight: 24, fontFamily: 'Almarai_400Regular' },
  dots: { alignItems: 'center', justifyContent: 'center', gap: SPACE.xs, paddingVertical: SPACE.xs },
  dot: { height: 8, borderRadius: RADIUS.xs },
  actions: { gap: SPACE.md, marginTop: SPACE.xs },
  button: { minHeight: 44, borderRadius: RADIUS.md, alignItems: 'center', justifyContent: 'center', paddingHorizontal: SPACE.xl },
  buttonLabel: { fontSize: TYPE.body, fontFamily: 'ReadexPro_600SemiBold' },
  back: { flex: 1 },
  next: { flex: 2 },
});
