import React from 'react';
import { Pressable, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLanguage } from '@/context/LanguageContext';
import { goBack } from '@/services/navigation';

/**
 * The back arrow every stack screen draws in its header.
 *
 * It was ~50 hand-copied Pressables: three ways of mirroring the arrow, three
 * hit areas, and only three of them named for a screen reader until the
 * 2026-10-08 review labelled them one by one. One component so the next
 * screen gets the name, the hit area and the RTL flip without remembering.
 *
 * `goBack()` rather than `router.back()`: the latter is dead after a web
 * refresh (see services/navigation.ts).
 */
export function BackButton({
  color,
  onPress,
  style,
  disabled,
  size = 22,
}: {
  /** White on a hero band, `colors.foreground` on a plain header. */
  color: string;
  /** Defaults to `goBack()`. */
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
  size?: number;
}) {
  const { t, isRTL } = useLanguage();
  return (
    <Pressable
      onPress={onPress ?? (() => goBack())}
      disabled={disabled}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel={t('back')}
      style={style}
    >
      <Ionicons name={isRTL ? 'arrow-forward' : 'arrow-back'} size={size} color={color} />
    </Pressable>
  );
}
