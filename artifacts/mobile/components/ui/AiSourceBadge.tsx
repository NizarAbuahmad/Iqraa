import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { DEMO_MODE } from '@/services/ai/demoMode';
import {
  AiGenerationRecord, aiSourceBadgeState, getLastGeneration, subscribeToGenerations,
} from '@/services/ai/aiProvenance';
import { useLanguage } from '@/context/LanguageContext';
import { useColors } from '@/hooks/useColors';

type Props = {
  /** Use on dark colored headers (teal/purple). */
  onDark?: boolean;
  isRTL?: boolean;
};

/** `getLastGeneration` returns the same object until a new one is recorded. */
function useLastGeneration(): AiGenerationRecord | null {
  return React.useSyncExternalStore(
    subscribeToGenerations,
    getLastGeneration,
    () => null,
  );
}

/**
 * Says where the content on screen came from.
 *
 * Three states, and the third is the reason this exists: with DEMO_MODE off,
 * a failed live call falls back to the mock generator, which returns content
 * shaped exactly like a real answer. Nothing on screen distinguished them, so
 * a broken key or a sleeping API server looked like working AI. This labels
 * that case loudly, in the same slot every generator screen already renders.
 */
export function AiSourceBadge({ onDark = false, isRTL }: Props) {
  const { t, isRTL: ctxRtl } = useLanguage();
  const colors = useColors();
  const rtl = isRTL ?? ctxRtl;
  const state = aiSourceBadgeState(DEMO_MODE, useLastGeneration());

  if (!state) return null;
  const label = t(state.labelKey);
  const warn = state.tone === 'warn';

  // The warning has to out-shout a header it sits on top of; the other states
  // stay secondary to the IQRA brand, as the demo badge always did.
  // It says the content is sample content, so it has to be legible: the old
  // greys were 2.4:1 on both the header band and the page.
  const quiet = onDark ? 'rgba(255,255,255,0.92)' : colors.mutedForeground;
  const tint = warn ? (onDark ? '#FFD8A8' : colors.warning) : quiet;

  return (
    <View
      style={[
        styles.wrap,
        warn ? styles.wrapWarn : onDark ? styles.wrapDark : styles.wrapLight,
        { flexDirection: rtl ? 'row-reverse' : 'row', alignSelf: rtl ? 'flex-end' : 'flex-start' },
      ]}
    >
      <Ionicons name={state.icon} size={11} color={tint} />
      <Text
        style={[
          styles.text,
          { color: tint, fontFamily: 'Almarai_400Regular', textAlign: rtl ? 'right' : 'left' },
        ]}
        // The API's failure text is diagnostic and usually English; keep it out
        // of the visible label and in the accessibility layer instead of
        // showing a raw HTTP string to a teacher.
        accessibilityLabel={state.detail ? `${label} — ${state.detail}` : label}
      >
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 10,
    marginTop: 4,
    marginBottom: 2,
  },
  wrapDark: {
    backgroundColor: 'rgba(0,0,0,0.18)',
  },
  wrapLight: {
    backgroundColor: 'rgba(139,160,184,0.12)',
  },
  wrapWarn: {
    backgroundColor: 'rgba(217,119,6,0.16)',
  },
  text: {
    fontSize: 10, lineHeight: 16,
  },
});
