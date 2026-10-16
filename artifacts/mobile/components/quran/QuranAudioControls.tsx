/**
 * The two small pieces every Quran audio screen draws: the listen/stop button
 * and the credit-and-error note. Rendered only when `useQuranAudio().visible`
 * (the release gate, `services/quranAudioRelease.ts`) — callers do the check,
 * so with the gate shut nothing here is on screen.
 *
 * Playing audio never touches the learner's progress, and the app never hears a
 * recitation; the credit line says whose voice it is and nothing more.
 */
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { RADIUS, SPACE, TYPE } from '@/constants/theme';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';

interface ListenButtonProps {
  /** True while THIS control's recitation is playing — the button then stops it. */
  active: boolean;
  onPress: () => void;
  /** With a label: a text pill. Without: an icon-only 44 px target. */
  label?: string;
  /** Spoken label for the icon-only form, e.g. «استمع ٣». Defaults to listen/stop. */
  a11yLabel?: string;
}

export function QuranListenButton({ active, onPress, label, a11yLabel }: ListenButtonProps) {
  const colors = useColors();
  const { t, isRTL } = useLanguage();
  const icon = active ? 'stop-circle-outline' : 'play-circle-outline';
  const spoken = a11yLabel ?? label ?? t(active ? 'quranStopAudio' : 'quranListen');
  return (
    <Pressable
      onPress={() => {
        Haptics.selectionAsync();
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={spoken}
      aria-pressed={active}
      style={[
        label ? styles.pill : styles.iconOnly,
        { backgroundColor: label || active ? colors.muted : 'transparent', flexDirection: isRTL ? 'row-reverse' : 'row' },
      ]}
    >
      <Ionicons name={icon} size={24} color={colors.primary} />
      {label ? (
        <Text style={{ color: colors.foreground, fontFamily: 'ReadexPro_500Medium', fontSize: TYPE.caption }}>{label}</Text>
      ) : null}
    </Pressable>
  );
}

export function QuranAudioNote({ error }: { error: boolean }) {
  const colors = useColors();
  const { t, isRTL } = useLanguage();
  const align = isRTL ? 'right' : 'left';
  return (
    <View style={styles.note}>
      <Text style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: TYPE.caption, textAlign: align }}>
        {t('quranAudioCredit')}
      </Text>
      {error ? (
        <Text
          accessibilityLiveRegion="polite"
          style={{ color: colors.destructive, fontFamily: 'Almarai_400Regular', fontSize: TYPE.caption, textAlign: align, marginTop: SPACE.xs }}
        >
          {t('quranAudioError')}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  iconOnly: { minWidth: 44, minHeight: 44, borderRadius: RADIUS.pill, alignItems: 'center', justifyContent: 'center' },
  pill: {
    minHeight: 44,
    alignItems: 'center',
    gap: SPACE.sm,
    paddingHorizontal: SPACE.lg,
    borderRadius: RADIUS.pill,
  },
  note: { paddingHorizontal: SPACE.lg, paddingTop: SPACE.sm },
});
