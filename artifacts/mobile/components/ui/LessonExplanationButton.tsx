import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import { getLessonExplanation } from '@/services/lessonExplanation';

type State = 'checking' | 'ready' | 'soon';

/**
 * «اشرح لي الدرس» — students only (the lesson page decides who sees it).
 *
 * Asks the server whether an approved explanation exists when the page opens.
 * «قريبًا» means the server said so explicitly (a 404 with `not_available`,
 * see `isNotAvailable`); any other failure — a network error, or a 404 from an
 * API revision without the route — leaves the button enabled, because the
 * screen it opens has a retry and a dead button teaches students to stop
 * trying.
 *
 * `fill` is the button's background and sits under white text, so it must be a
 * colour tuned for that (the lesson page's `colorFill`). `accent` is the
 * subject colour tuned for text on a card; it is only forwarded to the screen,
 * which uses it for headings.
 */
export function LessonExplanationButton({ lessonId, accent, fill }: { lessonId: string; accent: string; fill: string }) {
  const colors = useColors();
  const { t, isRTL, lang } = useLanguage();
  const [state, setState] = useState<State>('checking');

  useEffect(() => {
    let cancelled = false;
    setState('checking');
    getLessonExplanation(lessonId, lang === 'ar' ? 'ar' : 'en')
      .then(result => { if (!cancelled) setState(result.status === 'ok' ? 'ready' : 'soon'); })
      .catch(() => { if (!cancelled) setState('ready'); });
    return () => { cancelled = true; };
  }, [lessonId, lang]);

  const disabled = state !== 'ready';
  return (
    <Pressable
      accessibilityRole="button"
      aria-disabled={disabled}
      disabled={disabled}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        router.push({ pathname: '/curriculum/lesson-explanation', params: { lessonId, subjectColor: accent } } as never);
      }}
      style={[
        styles.button,
        {
          backgroundColor: disabled ? colors.muted : fill,
          borderRadius: colors.radius,
          flexDirection: isRTL ? 'row-reverse' : 'row',
          opacity: state === 'checking' ? 0.7 : 1,
        },
      ]}
    >
      {state === 'checking' ? (
        <ActivityIndicator size="small" color={colors.mutedForeground} />
      ) : (
        <Ionicons name={disabled ? 'time-outline' : 'bulb-outline'} size={18} color={disabled ? colors.mutedForeground : '#fff'} />
      )}
      <Text style={[styles.text, { color: disabled ? colors.mutedForeground : '#fff', fontFamily: 'ReadexPro_600SemiBold' }]}>
        {state === 'soon' ? t('lessonExplainSoon') : t('lessonExplainButton')}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, paddingHorizontal: 16, marginBottom: 16 },
  text: { fontSize: 15 },
});
