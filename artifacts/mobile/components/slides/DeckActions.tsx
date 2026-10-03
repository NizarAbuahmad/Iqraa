/**
 * Present, class, save and export for a built deck — shared by Slides and
 * Prompt Slides, which had identical copies of this block.
 */
import React from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { palette } from '@/constants/colors';
import { MaterialClassField } from '@/components/ui/MaterialClassField';
import type { DeckWorkspace } from '@/hooks/useDeckWorkspace';
import type { TranslationKey } from '@/services/i18n';
import type { useColors } from '@/hooks/useColors';
import { DECK_ACCENT as ACCENT, DECK_ACCENT_FILL as ACCENT_FILL, deckStyles as styles } from './deckStyles';

export function DeckActions({ workspace, onPresent, showToast, isRTL, colors, t }: {
  workspace: DeckWorkspace;
  onPresent: () => void;
  showToast: (message: string) => void;
  isRTL: boolean;
  colors: ReturnType<typeof useColors>;
  t: (key: TranslationKey, ...args: any[]) => string;
}) {
  const { saved, savedId, savingBusy, toggleSave, exportPdf, exportPptx, exportingPptx } = workspace;
  return (
    <>
      <Pressable
        onPress={onPresent}
        style={({ pressed }) => [styles.ctaBtn, { backgroundColor: ACCENT_FILL, borderRadius: colors.radius, flexDirection: isRTL ? 'row-reverse' : 'row', opacity: pressed ? 0.88 : 1 }]}
      >
        <Ionicons name="tv-outline" size={20} color="#fff" />
        <Text style={{ color: '#fff', fontFamily: 'Cairo_700Bold', fontSize: 15 }}>{t('presentOnScreen')}</Text>
      </Pressable>

      {/* Which class this deck is for — nothing until the deck on screen is
          what is stored. An adopted copy that differs is not this deck. */}
      <MaterialClassField materialId={saved ? savedId : null} onToast={showToast} />

      <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', gap: 10 }}>
        <Pressable
          onPress={toggleSave}
          disabled={savingBusy}
          accessibilityRole="button"
          accessibilityState={{ selected: saved, disabled: savingBusy }}
          accessibilityLabel={saved ? t('savedLabel') : t('save')}
          style={({ pressed }) => [
            styles.secondaryBtn,
            {
              backgroundColor: saved ? ACCENT : 'transparent',
              borderColor: ACCENT,
              borderRadius: colors.radius,
              flexDirection: isRTL ? 'row-reverse' : 'row',
              opacity: pressed || savingBusy ? 0.75 : 1,
            },
          ]}
        >
          <Ionicons name={saved ? 'bookmark' : 'bookmark-outline'} size={16} color={saved ? palette.primaryForeground : ACCENT} />
          <Text style={{ color: saved ? palette.primaryForeground : ACCENT, fontFamily: 'Cairo_600SemiBold', fontSize: 13 }}>
            {saved ? t('savedLabel') : t('save')}
          </Text>
        </Pressable>
        <Pressable
          onPress={exportPdf}
          style={[styles.secondaryBtn, { borderColor: colors.border, borderRadius: colors.radius, flexDirection: isRTL ? 'row-reverse' : 'row' }]}
        >
          <Ionicons name="document-outline" size={16} color={colors.mutedForeground} />
          <Text style={{ color: colors.mutedForeground, fontFamily: 'Cairo_600SemiBold', fontSize: 13 }}>PDF</Text>
        </Pressable>
        <Pressable
          onPress={exportPptx}
          disabled={exportingPptx}
          style={[styles.secondaryBtn, { borderColor: colors.border, borderRadius: colors.radius, flexDirection: isRTL ? 'row-reverse' : 'row', opacity: exportingPptx ? 0.6 : 1 }]}
        >
          {exportingPptx
            ? <ActivityIndicator size="small" color={colors.mutedForeground} />
            : <Ionicons name="easel-outline" size={16} color={colors.mutedForeground} />}
          <Text style={{ color: colors.mutedForeground, fontFamily: 'Cairo_600SemiBold', fontSize: 13 }}>PPTX</Text>
        </Pressable>
      </View>
    </>
  );
}
