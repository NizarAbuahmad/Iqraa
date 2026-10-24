/**
 * "A game from the lesson" — opened from the homework form, beside the Library
 * and My files. The list is the class's grade and subjects run through
 * `gameLessonsForScope` (code, not a network call, so no loading state):
 * lessons with enough key terms or with Math Corner exercises, by unit. Tapping a
 * lesson shows what it can offer (`homeworkGamesFor`: its games, and «تمارين
 * الرياضيات» for a covered maths lesson); tapping one adds it and the sheet stays
 * open, the added game reading «مضاف». No text input, so no KeyboardSafeView.
 */
import React, { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getLessonById } from '@workspace/curriculum';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import { RADIUS, SPACE, TYPE } from '@/constants/theme';
import { HOMEWORK_GAME_TITLE_KEY, gameLessonsForScope, homeworkGamesFor } from '@/services/lessonGames';
import { resourceKey, type HomeworkGameName, type HomeworkGameResource } from '@/services/homework';

export function GamePickerSheet({
  visible,
  group,
  added,
  onAdd,
  onClose,
}: {
  visible: boolean;
  group: { gradeId: string; subjectIds: readonly string[] };
  /** `resourceKey` of every attachment already on the homework. */
  added: ReadonlySet<string>;
  onAdd: (resource: HomeworkGameResource) => void;
  onClose: () => void;
}) {
  const colors = useColors();
  const { t, isRTL } = useLanguage();
  const align = isRTL ? 'right' : 'left';
  const rowDir = isRTL ? 'row-reverse' : 'row';
  const [openId, setOpenId] = useState<string | null>(null);
  const groups = useMemo(
    () => (visible ? gameLessonsForScope(group.gradeId, group.subjectIds) : []),
    // The array is rebuilt each render by the caller; its contents are the key.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [visible, group.gradeId, group.subjectIds.join(',')],
  );
  const games = useMemo(() => {
    const lesson = openId ? getLessonById(openId) : undefined;
    return lesson ? homeworkGamesFor(lesson) : [];
  }, [openId]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <Text style={{ color: colors.foreground, fontFamily: 'ReadexPro_600SemiBold', fontSize: TYPE.bodyLg, textAlign: align }}>
            {t('gamePickerTitle')}
          </Text>
          <ScrollView style={{ maxHeight: 440 }} contentContainerStyle={{ gap: SPACE.sm }} showsVerticalScrollIndicator={false}>
            {groups.length === 0 ? (
              <Text
                style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', textAlign: 'center', paddingVertical: SPACE.xxl }}
              >
                {t('gamePickerEmpty')}
              </Text>
            ) : null}
            {groups.map(g => (
              <View key={g.unitId} style={{ gap: SPACE.xs }}>
                <Text
                  style={{
                    color: colors.mutedForeground,
                    fontFamily: 'ReadexPro_600SemiBold',
                    fontSize: TYPE.caption,
                    textAlign: align,
                    marginTop: SPACE.sm,
                  }}
                >
                  {`${g.bookTitle} · ${g.unitTitle}`}
                </Text>
                {g.lessons.map(l => {
                  const on = openId === l.id;
                  return (
                    <View key={l.id} style={[styles.lesson, { borderColor: on ? colors.primary : colors.border }]}>
                      <Pressable
                        onPress={() => setOpenId(on ? null : l.id)}
                        accessibilityRole="button"
                        aria-expanded={on}
                        style={[styles.lessonHead, { flexDirection: rowDir }]}
                      >
                        <Text
                          numberOfLines={2}
                          style={{ flex: 1, color: colors.foreground, fontFamily: 'ReadexPro_500Medium', fontSize: TYPE.label, textAlign: align }}
                        >
                          {l.title}
                        </Text>
                        <Ionicons name={on ? 'chevron-up' : 'chevron-down'} size={20} color={colors.mutedForeground} />
                      </Pressable>
                      {on ? (
                        <View style={[styles.chips, { flexDirection: rowDir }]}>
                          {games.map((game: HomeworkGameName) => {
                            const resource: HomeworkGameResource = { kind: 'game', lessonId: l.id, game, title: l.title };
                            const isAdded = added.has(resourceKey(resource));
                            return (
                              <Pressable
                                key={game}
                                onPress={() => onAdd(resource)}
                                disabled={isAdded}
                                accessibilityRole="button"
                                style={[
                                  styles.chip,
                                  { borderColor: isAdded ? colors.border : colors.primary, opacity: isAdded ? 0.7 : 1, flexDirection: rowDir },
                                ]}
                              >
                                <Ionicons
                                  name={isAdded ? 'checkmark-circle' : 'add-circle-outline'}
                                  size={16}
                                  color={isAdded ? colors.mutedForeground : colors.primary}
                                />
                                <Text
                                  style={{
                                    color: isAdded ? colors.mutedForeground : colors.primary,
                                    fontFamily: 'ReadexPro_600SemiBold',
                                    fontSize: TYPE.caption,
                                  }}
                                >
                                  {t(HOMEWORK_GAME_TITLE_KEY[game])}
                                </Text>
                              </Pressable>
                            );
                          })}
                        </View>
                      ) : null}
                    </View>
                  );
                })}
              </View>
            ))}
          </ScrollView>
          <View style={styles.actions}>
            <Pressable onPress={onClose} style={styles.doneBtn} accessibilityRole="button">
              <Text style={{ color: colors.primary, fontFamily: 'ReadexPro_600SemiBold' }}>{t('libraryPickerDone')}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center', padding: SPACE.xxl },
  card: { width: '100%', maxWidth: 460, borderRadius: RADIUS.lg, padding: SPACE.xl, gap: SPACE.md },
  lesson: { borderWidth: 1, borderRadius: RADIUS.md, overflow: 'hidden' },
  lessonHead: { alignItems: 'center', gap: SPACE.sm, minHeight: 44, paddingHorizontal: SPACE.md, paddingVertical: SPACE.sm },
  chips: { flexWrap: 'wrap', gap: SPACE.sm, paddingHorizontal: SPACE.md, paddingBottom: SPACE.md },
  chip: {
    alignItems: 'center',
    gap: SPACE.xs,
    minHeight: 36,
    paddingHorizontal: SPACE.md,
    borderRadius: RADIUS.pill,
    borderWidth: 1.5,
  },
  actions: { flexDirection: 'row', justifyContent: 'flex-end' },
  doneBtn: { paddingHorizontal: SPACE.lg, paddingVertical: SPACE.md, borderRadius: RADIUS.md },
});
