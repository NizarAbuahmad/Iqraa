/**
 * The generate button, with a one-line summary of what it will make above it
 * («10 أسئلة · 20 دقيقة · 20 درجة · 4 أنواع»).
 *
 * `docked` (a phone): a bar pinned to the bottom, paying the safe-area inset,
 * so the button is never below the fold. It hides while the soft keyboard is
 * open (`useKeyboardVisible`) because nothing lifts content above the keyboard
 * on Android unless a view asks, and a `KeyboardAvoidingView` inside a screen
 * would lift it twice (CLAUDE.md, «On Android nothing lifts content above the
 * keyboard»). `hidden` is for the screen to hide it for another reason (the
 * result's own save bar takes the same spot).
 *
 * Not docked (desktop): the same content as a card, placed by the layout under
 * the paper preview.
 *
 * `hint` is the reason the button is disabled («اكتب عنوان الدرس…»). A greyed
 * button with nothing beside it reads as broken, so it is drawn where the
 * summary is, and the summary returns once the button is ready.
 */
import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import { useKeyboardVisible } from '@/hooks/useKeyboardVisible';
import { PressableScale } from '@/components/ui/PressableScale';
import { useSurface } from '@/components/ui/Surface';
import { RADIUS, SPACE, TYPE } from '@/constants/theme';
import { textOn } from '@/services/readableColor';

export interface DockedActionProps {
  summary: string;
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  hint?: string;
  /** The tool's concept colour: the button's fill. */
  accent: string;
  docked: boolean;
  hidden?: boolean;
}

export function DockedAction({ summary, label, onPress, loading = false, disabled = false, hint, accent, docked, hidden = false }: DockedActionProps) {
  const colors = useColors();
  const surface = useSurface();
  const insets = useSafeAreaInsets();
  const { isRTL } = useLanguage();
  const keyboardOpen = useKeyboardVisible();
  if (hidden || (docked && keyboardOpen)) return null;

  const blocked = disabled && !loading;
  const fill = blocked ? colors.muted : accent;
  const ink = blocked ? colors.mutedForeground : textOn(accent);
  const note = disabled && hint ? hint : summary;
  const align = isRTL ? 'right' : 'left';

  const content = (
    <>
      {note ? (
        <Text
          style={[styles.note, { color: colors.mutedForeground, textAlign: docked ? 'center' : align }]}
          aria-live="polite"
        >
          {note}
        </Text>
      ) : null}
      <PressableScale
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onPress();
        }}
        disabled={disabled || loading}
        aria-disabled={disabled || loading}
        aria-busy={loading}
        style={[styles.button, { backgroundColor: fill, borderColor: blocked ? colors.border : fill, flexDirection: isRTL ? 'row-reverse' : 'row' }]}
      >
        {loading ? <ActivityIndicator color={ink} /> : null}
        <Text style={[styles.label, { color: ink }]}>{label}</Text>
      </PressableScale>
    </>
  );

  if (!docked) return <View style={[surface, styles.inline]}>{content}</View>;
  return (
    <View
      style={[
        styles.bar,
        { backgroundColor: colors.card, borderTopColor: colors.border, paddingBottom: SPACE.md + insets.bottom },
      ]}
    >
      {content}
    </View>
  );
}

/** What the docked bar adds to the bottom of the screen, for the scroll content's padding (excluding the inset). */
export const DOCKED_BAR_HEIGHT = 108;

const styles = StyleSheet.create({
  bar: { position: 'absolute', left: 0, right: 0, bottom: 0, gap: SPACE.sm, paddingHorizontal: SPACE.lg, paddingTop: SPACE.md, borderTopWidth: 1 },
  inline: { padding: SPACE.lg, gap: SPACE.sm },
  note: { fontFamily: 'Almarai_400Regular', fontSize: TYPE.caption, lineHeight: 20 },
  button: { minHeight: 50, alignItems: 'center', justifyContent: 'center', gap: SPACE.sm, borderRadius: RADIUS.md, borderWidth: 1, paddingHorizontal: SPACE.lg },
  label: { fontFamily: 'ReadexPro_600SemiBold', fontSize: TYPE.bodyLg },
});
