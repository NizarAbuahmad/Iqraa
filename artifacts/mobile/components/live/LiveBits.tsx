/**
 * Pieces the live game's host (projector) and player (any device) screens
 * share: a question/option text that draws maths properly, the option tile,
 * and a rank row. Colours come from `useColors()`; the option fills are the
 * fixed colour-blind-safe set in services/liveGame.ts, each with its own
 * shape and letter so colour is never the only cue.
 */
import React from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type TextStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { RADIUS, SPACE, TYPE } from '@/constants/theme';
import { MathText } from '@/components/classroom/MathText';
import { bindOperators, hasRenderableMath, isolateForeignRuns } from '@/services/mathRender';
import { liveOptionLook, liveNum, type LiveLang } from '@/services/liveGame';

/** Question or option text: stacked fractions and exponents where there is maths, plain bidi-safe text otherwise. */
export function LiveText({
  text, size, color, lang, bold, centered, style,
}: {
  text: string;
  size: number;
  color: string;
  /** The game's language — decides the text's direction, not the app's. */
  lang: LiveLang;
  bold?: boolean;
  centered?: boolean;
  style?: StyleProp<TextStyle>;
}) {
  const isRTL = lang === 'ar';
  const fontFamily = bold ? 'ReadexPro_700Bold' : 'ReadexPro_500Medium';
  if (hasRenderableMath(text)) {
    return <MathText text={text} fontSize={size} color={color} fontFamily={fontFamily} isRTL={isRTL} centered={centered} />;
  }
  return (
    <Text
      style={[
        {
          fontSize: size,
          color,
          fontFamily,
          lineHeight: Math.round(size * 1.4),
          textAlign: centered ? 'center' : isRTL ? 'right' : 'left',
          writingDirection: isRTL ? 'rtl' : 'ltr',
        },
        style,
      ]}
    >
      {isolateForeignRuns(bindOperators(text))}
    </Text>
  );
}

export type OptionMark = 'correct' | 'wrong' | 'picked' | null;

/**
 * One answer. Shape + letter on the left of the text (the right in Arabic),
 * a fill from the safe set, and — once the answer is known — a ✓/✗ mark that
 * is an icon, not just a border colour.
 */
export function OptionTile({
  index, text, lang, scale = 1, onPress, disabled, dim, mark, count, a11yHint,
}: {
  index: number;
  text: string;
  lang: LiveLang;
  /** 1 on a device; larger on the projector. */
  scale?: number;
  onPress?: () => void;
  disabled?: boolean;
  dim?: boolean;
  mark?: OptionMark;
  /** How many chose this option (the host's reveal). */
  count?: number;
  a11yHint?: string;
}) {
  const look = liveOptionLook(index, lang);
  const badge = Math.round(52 * scale);
  const markSize = Math.round(30 * scale);
  const content = (
    <>
      <View style={[styles.badge, { width: badge, height: badge, borderRadius: badge / 2, backgroundColor: look.fg === '#FFFFFF' ? 'rgba(0,0,0,0.25)' : 'rgba(255,255,255,0.4)' }]}>
        <Text style={{ color: look.fg, fontSize: Math.round(TYPE.bodyLg * scale), lineHeight: Math.round(TYPE.bodyLg * scale * 1.1) }}>{look.shape}</Text>
        <Text style={{ color: look.fg, fontSize: Math.round(TYPE.label * scale), fontFamily: 'ReadexPro_700Bold', lineHeight: Math.round(TYPE.label * scale * 1.2) }}>{look.letter}</Text>
      </View>
      <View style={styles.tileText}>
        <LiveText text={text} size={Math.round(TYPE.bodyLg * scale * 1.15)} color={look.fg} lang={lang} bold />
      </View>
      {count !== undefined && (
        <Text style={{ color: look.fg, fontSize: Math.round(TYPE.title * scale), fontFamily: 'ReadexPro_700Bold' }}>{liveNum(count, lang)}</Text>
      )}
      {mark === 'correct' && <Ionicons name="checkmark-circle" size={markSize} color={look.fg} />}
      {mark === 'wrong' && <Ionicons name="close-circle" size={markSize} color={look.fg} />}
      {mark === 'picked' && <Ionicons name="radio-button-on" size={markSize} color={look.fg} />}
    </>
  );
  const tileStyle = [
    styles.tile,
    {
      backgroundColor: look.fill,
      flexDirection: lang === 'ar' ? ('row-reverse' as const) : ('row' as const),
      opacity: dim ? 0.35 : 1,
      borderColor: mark === 'correct' || mark === 'picked' ? look.fg : 'transparent',
      padding: Math.round(SPACE.md * scale),
      minHeight: Math.round(72 * scale),
    },
  ];
  const a11yLabel = `${look.letter}. ${text}`;
  if (!onPress) {
    return (
      <View style={tileStyle} accessible accessibilityLabel={a11yLabel}>
        {content}
      </View>
    );
  }
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={a11yLabel}
      accessibilityHint={a11yHint}
      aria-disabled={!!disabled}
      aria-selected={mark === 'picked'}
      style={({ pressed }) => [...tileStyle, pressed && { opacity: 0.85 }]}
    >
      {content}
    </Pressable>
  );
}

/** A leaderboard line: rank, name, score. `me` highlights the player's own row. */
export function RankRow({
  rank, name, score, lang, scale = 1, me, trailing,
}: {
  rank: number;
  name: string;
  score: number;
  lang: LiveLang;
  scale?: number;
  me?: boolean;
  trailing?: React.ReactNode;
}) {
  const colors = useColors();
  const size = Math.round(TYPE.bodyLg * scale);
  return (
    <View
      style={[
        styles.rankRow,
        {
          flexDirection: lang === 'ar' ? 'row-reverse' : 'row',
          backgroundColor: me ? colors.selected : colors.card,
          borderColor: me ? colors.primary : colors.border,
          paddingVertical: Math.round(SPACE.sm * scale),
          paddingHorizontal: Math.round(SPACE.md * scale),
        },
      ]}
    >
      <Text style={{ width: Math.round(36 * scale), textAlign: 'center', color: colors.mutedForeground, fontSize: size, fontFamily: 'ReadexPro_700Bold' }}>
        {liveNum(rank, lang)}
      </Text>
      <Text
        numberOfLines={1}
        style={{ flex: 1, color: colors.foreground, fontSize: size, fontFamily: 'ReadexPro_600SemiBold', textAlign: lang === 'ar' ? 'right' : 'left' }}
      >
        {name}
      </Text>
      {trailing}
      <Text style={{ color: colors.primary, fontSize: size, fontFamily: 'ReadexPro_700Bold' }}>{liveNum(score, lang)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    alignItems: 'center',
    gap: SPACE.md,
    borderRadius: RADIUS.lg,
    borderWidth: 4,
  },
  badge: { alignItems: 'center', justifyContent: 'center' },
  tileText: { flex: 1 },
  rankRow: {
    alignItems: 'center',
    gap: SPACE.sm,
    borderRadius: RADIUS.md,
    borderWidth: 1,
  },
});
