import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import { Button } from '@/components/ui/Button';
import { ICON } from '@/constants/icons';
import type { AiFallbackNotice as Notice } from '@/services/ai/aiProvenance';

/**
 * «This is sample content» — on the result itself, with a retry.
 *
 * `RemoteAIService` falls back to the offline generator when a live call
 * fails, and that content is shaped exactly like a real answer. The header
 * badge says so in small type; on 2026-11-20 a teacher read a whole offline
 * activity as the model's answer anyway. Whether to show this is decided by
 * `aiFallbackNotice` (which defers to `aiSourceBadgeState`), never here.
 * Renders nothing when there is no notice.
 */
export function AiFallbackNotice({ notice, onRetry, disabled }: {
  notice: Notice | null;
  onRetry: () => void;
  disabled?: boolean;
}) {
  const colors = useColors();
  const { t, isRTL } = useLanguage();
  if (!notice) return null;
  const title = t(notice.titleKey);
  const body = t(notice.bodyKey);
  return (
    <View
      style={[styles.box, { borderColor: colors.warning, backgroundColor: colors.card, borderRadius: colors.radius }]}
      accessibilityRole="alert"
      // The API's failure text is diagnostic and usually English: kept out of
      // the visible text, available to a screen reader, as in AiSourceBadge.
      accessibilityLabel={notice.detail ? `${title}. ${body} — ${notice.detail}` : `${title}. ${body}`}
    >
      <View style={[styles.row, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
        <Ionicons name="alert-circle" size={ICON.lg} color={colors.warning} style={{ marginTop: 1 }} />
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: colors.foreground, textAlign: isRTL ? 'right' : 'left' }]}>{title}</Text>
          <Text style={[styles.body, { color: colors.mutedForeground, textAlign: isRTL ? 'right' : 'left' }]}>{body}</Text>
        </View>
      </View>
      <View style={{ alignSelf: isRTL ? 'flex-end' : 'flex-start' }}>
        <Button label={t(notice.retryKey)} onPress={onRetry} variant="secondary" size="sm" disabled={disabled} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { borderWidth: 1, paddingHorizontal: 16, paddingVertical: 12, marginBottom: 12, gap: 10 },
  row: { alignItems: 'flex-start', gap: 12 },
  title: { fontFamily: 'ReadexPro_600SemiBold', fontSize: 14, lineHeight: 21, marginBottom: 2 },
  body: { fontFamily: 'Almarai_400Regular', fontSize: 13, lineHeight: 20 },
});
