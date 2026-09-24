import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import { goBack } from '@/services/navigation';
import { AiSourceBadge } from '@/components/ui/AiSourceBadge';

interface Props {
  title: string;
  subtitle?: string;
  /** Small label above the title, e.g. «خطة درس بالذكاء الاصطناعي». */
  eyebrow?: { icon: keyof typeof Ionicons.glyphMap; label: string };
  /** An emoji or icon beside the title. */
  leading?: string | { icon: keyof typeof Ionicons.glyphMap };
  /** The demo/live pill. Off only for screens that never generate. */
  sourceBadge?: boolean;
  topPad: number;
  isRTL: boolean;
  /** Rendered under the subtitle — a search field, a filter row. */
  children?: React.ReactNode;
}

/**
 * The header every generator screen shares. Eleven screens each hand-built
 * this band with their own colour, title size and badge order, so the tools
 * read as separate products; the band is now always the primary teal.
 */
export function ToolHeader({ title, subtitle, eyebrow, leading, sourceBadge = true, topPad, isRTL, children }: Props) {
  const colors = useColors();
  const { t } = useLanguage();
  const row = { flexDirection: isRTL ? 'row-reverse' : 'row' } as const;
  const align = { textAlign: isRTL ? 'right' : 'left' } as const;
  return (
    <View style={[styles.band, { backgroundColor: colors.primary, paddingTop: topPad + 12 }]}>
      <Pressable
        onPress={goBack}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel={t('back')}
        style={[styles.back, { alignSelf: isRTL ? 'flex-end' : 'flex-start' }]}
      >
        <Ionicons name={isRTL ? 'arrow-forward' : 'arrow-back'} size={22} color="#fff" />
      </Pressable>
      {eyebrow ? (
        <View style={[styles.eyebrow, row, { alignSelf: isRTL ? 'flex-end' : 'flex-start' }]}>
          <Ionicons name={eyebrow.icon} size={13} color="#fff" />
          <Text style={styles.eyebrowText}>{eyebrow.label}</Text>
        </View>
      ) : null}
      {sourceBadge ? <AiSourceBadge onDark isRTL={isRTL} /> : null}
      <View style={[styles.titleRow, row]}>
        {typeof leading === 'string' ? <Text style={styles.emoji}>{leading}</Text> : null}
        {leading && typeof leading === 'object' ? <Ionicons name={leading.icon} size={22} color="#fff" /> : null}
        <Text style={[styles.title, align]}>{title}</Text>
      </View>
      {subtitle ? <Text style={[styles.subtitle, align]}>{subtitle}</Text> : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  band: { paddingHorizontal: 20, paddingBottom: 22, gap: 6 },
  back: { paddingVertical: 4, marginBottom: 4 },
  eyebrow: {
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  eyebrowText: { color: '#fff', fontFamily: 'Cairo_600SemiBold', fontSize: 12 },
  titleRow: { alignItems: 'center', gap: 8 },
  emoji: { fontSize: 22 },
  title: { flexShrink: 1, color: '#fff', fontFamily: 'Cairo_700Bold', fontSize: 22 },
  subtitle: { color: 'rgba(255,255,255,0.88)', fontFamily: 'Almarai_400Regular', fontSize: 13.5, lineHeight: 22 },
});
