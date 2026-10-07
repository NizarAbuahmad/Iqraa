import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import { deckableLabItems } from '@/services/labSlides';

type Props = {
  /** The grounded lesson's KB id — empty until the topic resolves to a lesson, in which case nothing renders. */
  lessonId: string;
  /** The deck's content language: item titles and the slides built from them follow it. */
  isAr: boolean;
  picks: string[];
  onChange: (ids: string[]) => void;
};

/**
 * The lab items filed on the lesson being built, to tick into the deck. Off by
 * default: nothing is inserted until a teacher picks it, the same stance as
 * `includeAttachments`. Keyed by lesson id, never title.
 */
export function LessonLabItems({ lessonId, isAr, picks, onChange }: Props) {
  const colors = useColors();
  const { t, isRTL } = useLanguage();
  const items = useMemo(() => deckableLabItems(lessonId, isAr), [lessonId, isAr]);
  if (items.length === 0) return null;
  const align = isRTL ? 'right' : 'left';
  const toggle = (id: string) =>
    onChange(picks.includes(id) ? picks.filter(p => p !== id) : [...picks, id]);

  return (
    <View style={[styles.box, { borderColor: colors.border, backgroundColor: colors.card }]}>
      <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 8 }}>
        <Ionicons name="flask-outline" size={18} color={colors.primary} />
        <Text style={{ color: colors.foreground, fontFamily: 'ReadexPro_600SemiBold', fontSize: 15, flex: 1, textAlign: align }}>
          {t('slidesFromLab')}
        </Text>
      </View>
      <Text style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: 13, textAlign: align }}>
        {t('slidesFromLabHint')}
      </Text>
      {items.map(item => {
        const on = picks.includes(item.id);
        return (
          <Pressable
            key={item.id}
            onPress={() => toggle(item.id)}
            accessibilityRole="checkbox"
            aria-checked={on}
            style={{ flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 10, paddingVertical: 6 }}
          >
            <Ionicons name={on ? 'checkbox' : 'square-outline'} size={22} color={on ? colors.primary : colors.mutedForeground} />
            <Text
              numberOfLines={2}
              style={{ color: colors.foreground, fontFamily: 'Almarai_400Regular', fontSize: 14, flex: 1, textAlign: align }}
            >
              {isAr ? item.titleAr : item.titleEn}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { borderWidth: 1, borderRadius: 12, padding: 14, gap: 6, marginBottom: 14 },
});
