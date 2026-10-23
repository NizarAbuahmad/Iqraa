import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SPACE, TYPE } from '@/constants/theme';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import { goBack } from '@/services/navigation';
import { AiSourceBadge } from '@/components/ui/AiSourceBadge';
import { IconTile } from '@/components/ui/IconTile';
import { ICON, conceptOf, type ConceptId } from '@/constants/icons';
import { Band } from '@/components/ui/Band';
import { useLightStatusBar } from '@/hooks/useLightStatusBar';

interface Props {
  title: string;
  subtitle?: string;
  /** Small label above the title, e.g. «خطة درس بالذكاء الاصطناعي». */
  eyebrow?: { icon: keyof typeof Ionicons.glyphMap; label: string };
  /** An emoji or icon beside the title. */
  leading?: string | { icon: keyof typeof Ionicons.glyphMap };
  /**
   * The tool's teaching concept (`constants/icons.ts`): its icon, in its colour,
   * on a white tile. Wins over `leading`. Every generator screen passes one, so
   * the quiz wears the same glyph here as on the Tools tab and the prep board.
   * The band takes the concept's colour too, as a `Band` gradient that only
   * deepens (`generatorScreens.test.ts` measures white text on both stops for
   * every concept). Without a concept the band is the brand teal, as before.
   */
  concept?: ConceptId;
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
 * read as separate products. It is the brand teal, or the colour of the tool's
 * concept when one is passed, so the quiz looks like the quiz and not like
 * every other screen.
 *
 * The band sits under the status bar, so it asks for light status-bar icons
 * while the screen is focused (`statusBar.test.ts`).
 */
export function ToolHeader({ title, subtitle, eyebrow, leading, concept, sourceBadge = true, topPad, isRTL, children }: Props) {
  const colors = useColors();
  const { t, lang, toggleLang } = useLanguage();
  useLightStatusBar();
  const row = { flexDirection: isRTL ? 'row-reverse' : 'row' } as const;
  const align = { textAlign: isRTL ? 'right' : 'left' } as const;
  const body = (
    <>
      <View style={styles.nav}>
        <Pressable
          onPress={goBack}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={t('back')}
        >
          <Ionicons name={isRTL ? 'arrow-forward' : 'arrow-back'} size={ICON.xl} color="#fff" />
        </Pressable>
        <View style={[styles.navEnd, row]}>
          {/* After sign-in the only other switch is in Settings, which a
              full-screen tool gives no way to reach — and what a tool writes
              is in the app's language. */}
          <Pressable
            onPress={() => { void toggleLang(); }}
            hitSlop={8}
            style={styles.langPill}
            accessibilityRole="button"
            accessibilityLabel={t('changeLanguage')}
          >
            <Ionicons name="language-outline" size={14} color="#fff" />
            <Text style={styles.langPillText}>{lang === 'ar' ? 'English' : 'عربي'}</Text>
          </Pressable>
          {sourceBadge ? <AiSourceBadge onDark isRTL={isRTL} /> : null}
        </View>
      </View>
      {eyebrow ? (
        <View style={[styles.eyebrow, row, { alignSelf: isRTL ? 'flex-end' : 'flex-start' }]}>
          <Ionicons name={eyebrow.icon} size={14} color="#fff" />
          <Text style={styles.eyebrowText}>{eyebrow.label}</Text>
        </View>
      ) : null}
      <View style={[styles.titleRow, row]}>
        {concept ? <IconTile icon={conceptOf(concept).icon} glyph={conceptOf(concept).glyph} color={conceptOf(concept).color} size={36} tone="onBand" /> : null}
        {!concept && typeof leading === 'string' ? <Text style={styles.emoji}>{leading}</Text> : null}
        {!concept && leading && typeof leading === 'object' ? <Ionicons name={leading.icon} size={ICON.xl} color="#fff" /> : null}
        <Text style={[styles.title, align]}>{title}</Text>
      </View>
      {subtitle ? <Text style={[styles.subtitle, align]}>{subtitle}</Text> : null}
      {children}
    </>
  );
  const bandStyle = [styles.band, { paddingTop: topPad + 12 }];
  return concept ? (
    <Band color={conceptOf(concept).color} style={bandStyle}>{body}</Band>
  ) : (
    <View style={[bandStyle, { backgroundColor: colors.hero }]}>{body}</View>
  );
}

const styles = StyleSheet.create({
  band: { paddingHorizontal: 20, paddingBottom: 14, gap: 8 },
  nav: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  navEnd: { alignItems: 'center', gap: 8 },
  langPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.xs,
    backgroundColor: 'rgba(0,0,0,0.18)',
    borderRadius: 999,
    paddingHorizontal: SPACE.md,
    paddingVertical: SPACE.xs,
  },
  langPillText: { color: '#fff', fontFamily: 'ReadexPro_600SemiBold', fontSize: TYPE.caption },
  eyebrow: {
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(0,0,0,0.18)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  eyebrowText: { color: '#fff', fontFamily: 'ReadexPro_600SemiBold', fontSize: 12 },
  titleRow: { alignItems: 'center', gap: 8 },
  emoji: { fontSize: 22 },
  title: { flexShrink: 1, color: '#fff', fontFamily: 'ReadexPro_700Bold', fontSize: 22 },
  subtitle: { color: 'rgba(255,255,255,0.95)', fontFamily: 'Almarai_400Regular', fontSize: 15, lineHeight: 24 },
});
