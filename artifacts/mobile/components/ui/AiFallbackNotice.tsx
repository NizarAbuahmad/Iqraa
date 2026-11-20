/**
 * Says, on the result itself, that it is the offline sample and not what the
 * teacher asked the AI for — with a way to try again.
 *
 * The header badge (`AiSourceBadge`) already said «تعذّر الاتصال · محتوى
 * تجريبي», and it was not enough: on 2026-11-20 a teacher got a complete,
 * plausible discussion activity that ignored the question she had typed, and
 * read it as the AI's answer. A teacher deciding what to hand a class reads
 * the result, not the header, so this sits directly above it.
 *
 * When to show is decided by `resultFallbackNotice` (pure, tested); this file
 * only draws it.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { DEMO_MODE } from '@/services/ai/demoMode';
import { type AiGenerationKind, resultFallbackNotice } from '@/services/ai/aiProvenance';
import { useLanguage } from '@/context/LanguageContext';
import { useColors } from '@/hooks/useColors';
import { Button } from '@/components/ui/Button';
import { useLastGeneration } from '@/components/ui/AiSourceBadge';
import { SPACE } from '@/constants/theme';

type Props = {
  /** The generation kinds this screen makes. */
  kinds: readonly AiGenerationKind[];
  onRetry: () => void;
  isRTL?: boolean;
};

export function AiFallbackNotice({ kinds, onRetry, isRTL }: Props) {
  const { t, isRTL: ctxRtl } = useLanguage();
  const colors = useColors();
  const rtl = isRTL ?? ctxRtl;
  const notice = resultFallbackNotice(DEMO_MODE, useLastGeneration(), kinds);
  if (!notice) return null;

  const align = rtl ? 'right' : 'left';
  const title = t('aiFallbackNoticeTitle');
  const body = t('aiFallbackNoticeBody');
  return (
    <View
      style={[
        styles.wrap,
        {
          flexDirection: rtl ? 'row-reverse' : 'row',
          backgroundColor: colors.warning + '14',
          borderColor: colors.warning + '66',
        },
      ]}
      accessibilityRole="alert"
      // The failure text is diagnostic and usually English: it stays out of
      // the visible copy, as on the badge, and in the accessibility layer.
      accessibilityLabel={notice.error ? `${title}. ${body} — ${notice.error}` : `${title}. ${body}`}
    >
      <Ionicons name="alert-circle" size={20} color={colors.warning} style={{ marginTop: 2 }} />
      <View style={{ flex: 1, gap: 8 }}>
        <Text style={[styles.title, { color: colors.foreground, fontFamily: 'ReadexPro_600SemiBold', textAlign: align }]}>
          {title}
        </Text>
        <Text style={[styles.body, { color: colors.foreground, fontFamily: 'Almarai_400Regular', textAlign: align }]}>
          {body}
        </Text>
        <View style={{ alignSelf: rtl ? 'flex-end' : 'flex-start' }}>
          <Button label={t('aiFallbackNoticeRetry')} onPress={onRetry} variant="secondary" size="sm" />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginHorizontal: SPACE.xl,
    marginTop: SPACE.md,
    padding: SPACE.md,
    borderRadius: 12,
    borderWidth: 1,
    gap: SPACE.sm,
    alignItems: 'flex-start',
  },
  title: { fontSize: 15, lineHeight: 22 },
  body: { fontSize: 14, lineHeight: 22 },
});
