/**
 * The lesson as one card: «الصف العاشر · الرياضيات», the lesson's title, a
 * «من المنهاج» badge when the title is grounded in a curriculum lesson, and a
 * button that opens the pickers.
 *
 * The card is PRESENTATION over the screen's existing state. The grade and
 * subject pickers, the stranded-selection note and `TopicSelector` are passed
 * as `children` and are the expanded body. They are never unmounted:
 * `TopicSelector` holds the unit / semester / whole-book selection that drives
 * `useWideScope`, and unmounting it would drop that. Collapsed therefore means
 * `display: 'none'` and hidden from the accessibility tree, not removed.
 *
 * `locked` (no lesson picked yet) keeps the body open and hides the button, so
 * the field the validation message is about cannot be folded away.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import { PressableScale } from '@/components/ui/PressableScale';
import { useSurface } from '@/components/ui/Surface';
import { IconTile } from '@/components/ui/IconTile';
import { ICON } from '@/constants/icons';
import { RADIUS, SPACE, TYPE } from '@/constants/theme';
import { readableOn } from '@/services/readableColor';
import { subjectTile } from '@/services/subjectTheme';

export interface LessonCardProps {
  gradeLabel: string;
  subjectLabel: string;
  subjectId: string;
  /** The lesson's title; empty until one is picked. */
  topic: string;
  /** True when `topic` resolves to a curriculum lesson (a picked lesson id). */
  grounded: boolean;
  expanded: boolean;
  onToggle: () => void;
  /** No lesson yet: the body stays open and the button is not drawn. */
  locked?: boolean;
  children: React.ReactNode;
}

export function LessonCard({ gradeLabel, subjectLabel, subjectId, topic, grounded, expanded, onToggle, locked = false, children }: LessonCardProps) {
  const colors = useColors();
  const surface = useSurface();
  const { t, isRTL } = useLanguage();
  const tile = subjectTile(subjectId);
  const badgeInk = readableOn(colors.primary, colors.card);
  const align = isRTL ? 'right' : 'left';
  const title = topic.trim();
  // `locked` keeps the body open whatever `expanded` says, so a screen cannot fold away
  // the field its validation message is about (and there is no one-render flash).
  const open = expanded || locked;
  return (
    <View style={[surface, styles.card]}>
      <View style={[styles.head, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
        <IconTile icon={tile.icon} glyph={tile.glyph} color={tile.color} size={44} />
        <View style={styles.text}>
          <Text style={[styles.sub, { color: colors.mutedForeground, textAlign: align }]} numberOfLines={1}>
            {gradeLabel} · {subjectLabel}
          </Text>
          <Text
            style={[styles.title, { color: title ? colors.foreground : colors.mutedForeground, textAlign: align }]}
            numberOfLines={2}
          >
            {title || t('selectLesson')}
          </Text>
          {grounded && title ? (
            <View style={[styles.badge, { backgroundColor: colors.primary + '1F', flexDirection: isRTL ? 'row-reverse' : 'row', alignSelf: isRTL ? 'flex-end' : 'flex-start' }]}>
              <Ionicons name="checkmark-circle" size={ICON.sm} color={badgeInk} />
              <Text style={[styles.badgeText, { color: badgeInk }]}>{t('genLessonFromCurriculum')}</Text>
            </View>
          ) : null}
        </View>
        {locked ? null : (
          <PressableScale
            onPress={onToggle}
            aria-expanded={open}
            style={[styles.button, { borderColor: colors.border }]}
          >
            <Text style={[styles.buttonText, { color: colors.foreground }]}>{t(open ? 'genLessonDone' : 'changeLesson')}</Text>
          </PressableScale>
        )}
      </View>
      <View
        aria-hidden={!open}
        importantForAccessibility={open ? 'auto' : 'no-hide-descendants'}
        style={open ? styles.body : styles.bodyHidden}
      >
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: SPACE.md },
  head: { alignItems: 'center', gap: SPACE.md },
  text: { flex: 1, minWidth: 0, gap: SPACE.xxs },
  sub: { fontFamily: 'Almarai_400Regular', fontSize: TYPE.caption },
  title: { fontFamily: 'ReadexPro_600SemiBold', fontSize: TYPE.bodyLg },
  badge: { alignItems: 'center', gap: SPACE.xs, marginTop: SPACE.xs, paddingHorizontal: SPACE.sm, paddingVertical: SPACE.xxs, borderRadius: RADIUS.pill },
  badgeText: { fontFamily: 'ReadexPro_500Medium', fontSize: TYPE.micro },
  button: { minHeight: 44, minWidth: 44, justifyContent: 'center', paddingHorizontal: SPACE.md, borderWidth: 1, borderRadius: RADIUS.md },
  buttonText: { fontFamily: 'ReadexPro_500Medium', fontSize: TYPE.caption },
  body: { marginTop: SPACE.lg },
  bodyHidden: { display: 'none' },
});
