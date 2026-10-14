/**
 * The deck's look, chosen with one tap — shared by Slides and Prompt Slides.
 *
 * A deck starts in its subject's theme (`resolveDeckTheme`), so a teacher who
 * does nothing still gets a maths deck that is not an Arabic deck. This row is
 * for the one who wants another: it writes `themeId` onto the deck, which the
 * presenter, the PDF and the PPTX all read, and which a saved deck keeps.
 */
import React from 'react';
import { Pressable, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import type { Dispatch, SetStateAction } from 'react';
import type { ClassroomActivity } from '@/services/ai/AIService';
import { DECK_THEMES, DECK_THEME_ORDER, resolveDeckTheme, type DeckThemeId } from '@/services/deckTheme';
import type { TranslationKey } from '@/services/i18n';
import type { useColors } from '@/hooks/useColors';
import { RADIUS, SPACE, TYPE } from '@/constants/theme';

export function DeckThemePicker({ deck, setDeck, isRTL, isAr, colors, t }: {
  deck: ClassroomActivity;
  setDeck: Dispatch<SetStateAction<ClassroomActivity | null>>;
  isRTL: boolean;
  /** The deck's own language, for the theme names. */
  isAr: boolean;
  colors: ReturnType<typeof useColors>;
  t: (key: TranslationKey, ...args: any[]) => string;
}) {
  const current = resolveDeckTheme(deck).id;
  const choose = (id: DeckThemeId) => {
    if (id === current) return;
    Haptics.selectionAsync();
    setDeck(cur => (cur ? { ...cur, themeId: id } : cur));
  };
  return (
    <View style={{ marginBottom: SPACE.md }}>
      <Text style={{
        color: colors.mutedForeground, fontFamily: 'ReadexPro_500Medium', fontSize: TYPE.caption,
        textAlign: isRTL ? 'right' : 'left', marginBottom: SPACE.sm,
      }}>
        {t('deckThemeLabel')}
      </Text>
      <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', flexWrap: 'wrap', gap: SPACE.sm }}>
        {DECK_THEME_ORDER.map(id => {
          const theme = DECK_THEMES[id];
          const on = id === current;
          const name = isAr ? theme.nameAr : theme.nameEn;
          return (
            <Pressable
              key={id}
              onPress={() => choose(id)}
              accessibilityRole="radio"
              accessibilityLabel={name}
              aria-selected={on}
              style={{
                flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: SPACE.sm,
                paddingHorizontal: SPACE.md, paddingVertical: SPACE.sm, borderRadius: RADIUS.pill,
                borderWidth: 2, borderColor: on ? theme.primary : colors.border,
                backgroundColor: on ? theme.bg : 'transparent',
              }}
            >
              {/* The slide ground ringed in the theme's own colour, so the chip
                  shows what the slide will look like and not just a hue. */}
              <View style={{
                width: 20, height: 20, borderRadius: RADIUS.pill, backgroundColor: theme.bg,
                borderWidth: 2, borderColor: theme.accent, alignItems: 'center', justifyContent: 'center',
              }}>
                <View style={{ width: 8, height: 8, borderRadius: RADIUS.pill, backgroundColor: theme.primary }} />
              </View>
              <Text style={{
                color: on ? theme.primary : colors.foreground,
                fontFamily: on ? 'ReadexPro_700Bold' : 'ReadexPro_500Medium', fontSize: TYPE.caption,
              }}>
                {name}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
