/**
 * The whole life of one generation, in one place: running, stopped, failed.
 *
 * Before this, every tool rendered a spinner and a fixed line of Arabic, and
 * put its error message above the form where a teacher who had just scrolled
 * to the button would not see it. A request that took twenty seconds and one
 * that had silently died looked identical, and there was no way to stop
 * either. That is the same defect as the Start Class button that swallowed
 * its own failure — the app knowing something and not saying it.
 *
 * The elapsed counter is the honest part: it does not estimate, because
 * nothing here knows how long a model will take. It reports what has actually
 * happened so far and lets the teacher decide.
 */
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { countSeconds } from '@/services/i18n';

/** How long before we admit this is slower than usual. */
const SLOW_AFTER_SECONDS = 15;

export type GenerationPhase = 'idle' | 'loading' | 'error' | 'cancelled';

type Colors = {
  card: string;
  border: string;
  foreground: string;
  mutedForeground: string;
  destructive: string;
  radius: number;
};

type Props = {
  phase: GenerationPhase;
  /** What the tool calls this work, e.g. "جارٍ تحضير خطة الدرس…". */
  loadingLabel: string;
  /** Failure detail, shown under the heading. Optional. */
  errorDetail?: string;
  onCancel?: () => void;
  onRetry?: () => void;
  colors: Colors;
  isRTL: boolean;
  lang: 'ar' | 'en';
  accent: string;
  t: (key: any, ...args: any[]) => string;
};

export function GenerationStatus({
  phase, loadingLabel, errorDetail, onCancel, onRetry, colors, isRTL, lang, accent, t,
}: Props) {
  const [elapsed, setElapsed] = useState(0);
  const startedAt = useRef<number | null>(null);

  useEffect(() => {
    if (phase !== 'loading') {
      startedAt.current = null;
      setElapsed(0);
      return;
    }
    startedAt.current = Date.now();
    setElapsed(0);
    const id = setInterval(() => {
      if (startedAt.current === null) return;
      setElapsed(Math.floor((Date.now() - startedAt.current) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, [phase]);

  if (phase === 'idle') return null;

  const rowDir = isRTL ? 'row-reverse' : 'row';
  const align = isRTL ? 'right' : 'left';

  const shell = (borderColor: string, background: string) => [
    styles.box,
    { backgroundColor: background, borderColor, borderRadius: colors.radius },
  ];

  if (phase === 'loading') {
    const slow = elapsed >= SLOW_AFTER_SECONDS;
    return (
      <View
        style={shell(colors.border, colors.card)}
        accessibilityRole="progressbar"
        accessibilityLabel={loadingLabel}
      >
        <View style={[styles.row, { flexDirection: rowDir }]}>
          <ActivityIndicator color={accent} />
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={[styles.title, { color: colors.foreground, textAlign: align }]}>
              {loadingLabel}
            </Text>
            {/*
              Announced politely rather than assertively: a counter that
              interrupted a screen reader every second would be unusable.
            */}
            <Text
              style={[styles.meta, { color: colors.mutedForeground, textAlign: align }]}
              accessibilityLiveRegion="polite"
            >
              {t('genElapsed', countSeconds(elapsed, lang))}
            </Text>
          </View>
          {onCancel ? (
            <Pressable
              onPress={onCancel}
              hitSlop={8}
              style={({ pressed }) => [
                styles.cancelBtn,
                { borderColor: colors.mutedForeground, borderRadius: colors.radius, opacity: pressed ? 0.7 : 1 },
              ]}
              accessibilityRole="button"
              accessibilityLabel={t('genCancel')}
            >
              <Text style={[styles.cancelText, { color: colors.mutedForeground }]}>{t('genCancel')}</Text>
            </Pressable>
          ) : null}
        </View>
        {slow ? (
          <Text style={[styles.hint, { color: colors.mutedForeground, textAlign: align }]}>
            {t('genSlowHint')}
          </Text>
        ) : null}
      </View>
    );
  }

  if (phase === 'cancelled') {
    return (
      <View style={shell(colors.border, colors.card)} accessibilityRole="alert">
        <View style={[styles.row, { flexDirection: rowDir }]}>
          <Ionicons name="stop-circle-outline" size={18} color={colors.mutedForeground} />
          <Text style={[styles.title, { color: colors.mutedForeground, textAlign: align, flex: 1 }]}>
            {t('genCancelled')}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={shell(colors.destructive, colors.destructive + '10')} accessibilityRole="alert">
      <View style={[styles.row, { flexDirection: rowDir }]}>
        <Ionicons name="alert-circle-outline" size={18} color={colors.destructive} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={[styles.title, { color: colors.destructive, textAlign: align }]}>
            {t('genFailedTitle')}
          </Text>
          {errorDetail ? (
            <Text style={[styles.meta, { color: colors.destructive, textAlign: align }]}>
              {errorDetail}
            </Text>
          ) : null}
        </View>
      </View>
      {onRetry ? (
        <Pressable
          onPress={onRetry}
          style={({ pressed }) => [
            styles.retryBtn,
            { borderColor: colors.destructive, borderRadius: colors.radius, flexDirection: rowDir, opacity: pressed ? 0.8 : 1 },
          ]}
          accessibilityRole="button"
          accessibilityLabel={t('genRetry')}
        >
          <Ionicons name="refresh-outline" size={15} color={colors.destructive} />
          <Text style={[styles.retryText, { color: colors.destructive }]}>{t('genRetry')}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    marginHorizontal: 20,
    marginBottom: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    gap: 8,
  },
  row: { alignItems: 'center', gap: 10 },
  title: { fontFamily: 'Cairo_600SemiBold', fontSize: 13, lineHeight: 20 },
  meta: { fontFamily: 'Almarai_400Regular', fontSize: 12, lineHeight: 18 },
  hint: { fontFamily: 'Almarai_400Regular', fontSize: 12, lineHeight: 18 },
  cancelBtn: { paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1 },
  cancelText: { fontFamily: 'Cairo_600SemiBold', fontSize: 12 },
  retryBtn: {
    alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 9, borderWidth: 1,
  },
  retryText: { fontFamily: 'Cairo_600SemiBold', fontSize: 13 },
});
