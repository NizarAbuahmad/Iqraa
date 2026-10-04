/**
 * The slide outline under a built deck — shared by Slides and Prompt Slides,
 * which had byte-identical copies of it.
 *
 * The outline is the product: a teacher decides whether to use a deck by
 * scanning slide titles, not by opening it. Each row opens the editor — the
 * deck is theirs to adjust.
 */
import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import type { ActivitySlide } from '@/services/ai/AIService';
import { isolateForeignRuns } from '@/services/mathRender';
import { timerSecondsForSlide } from '@/services/presentationUtils';
import type { TranslationKey } from '@/services/i18n';
import type { useColors } from '@/hooks/useColors';
import { DECK_ACCENT, deckStyles } from './deckStyles';

export function DeckOutline({ slides, onEdit, onRemove, isRTL, colors, t }: {
  slides: readonly ActivitySlide[];
  onEdit: (index: number) => void;
  onRemove: (index: number) => void;
  isRTL: boolean;
  colors: ReturnType<typeof useColors>;
  t: (key: TranslationKey, ...args: any[]) => string;
}) {
  return (
    <View style={{ marginTop: 12, gap: 6 }}>
      {slides.map((s, i) => (
        <View
          key={i}
          style={{ flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 10 }}
        >
          <Pressable
            onPress={() => { Haptics.selectionAsync(); onEdit(i); }}
            accessibilityRole="button"
            accessibilityLabel={`${t('editSlide')}: ${s.title}`}
            style={({ pressed }) => [
              { flex: 1, flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 10, opacity: pressed ? 0.7 : 1 },
            ]}
          >
            <View style={[deckStyles.slideNum, { backgroundColor: DECK_ACCENT + '18' }]}>
              <Text style={{ color: DECK_ACCENT, fontFamily: 'ReadexPro_700Bold', fontSize: 11 }}>{i + 1}</Text>
            </View>
            <Text
              style={{
                flex: 1,
                color: colors.foreground,
                fontFamily: 'Almarai_400Regular',
                fontSize: 15, lineHeight: 24,
                textAlign: isRTL ? 'right' : 'left',
                writingDirection: isRTL ? 'rtl' : 'ltr',
              }}
              numberOfLines={1}
            >
              {isolateForeignRuns(s.title)}
            </Text>
            {/* The projector's own rule, so the editor cannot advertise a
                timer the presentation screen then refuses to run. */}
            {timerSecondsForSlide(s) > 0 && (
              <Text style={{ color: colors.mutedForeground, fontFamily: 'ReadexPro_500Medium', fontSize: 11 }}>
                {timerSecondsForSlide(s)}s
              </Text>
            )}
            <Ionicons name="create-outline" size={16} color={colors.mutedForeground} />
          </Pressable>
          <Pressable
            onPress={() => { Haptics.selectionAsync(); onRemove(i); }}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={`${t('deleteLabel')}: ${s.title}`}
          >
            <Ionicons name="trash-outline" size={16} color={colors.mutedForeground} />
          </Pressable>
        </View>
      ))}
    </View>
  );
}
