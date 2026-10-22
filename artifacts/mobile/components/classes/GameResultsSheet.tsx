/**
 * «النتائج» of a homework's lesson games — each student's best round, from
 * `GET /homework/:id/game-results`. Loads when opened; a read-only list, so no
 * text input and no KeyboardSafeView.
 */
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import { RADIUS, SPACE, TYPE } from '@/constants/theme';
import { toArabicDigits } from '@/services/labFormat';
import { gameScoreText, type HomeworkGameResource, type TeacherGameResult } from '@/services/homework';
import { fetchGameResults } from '@/services/homeworkApi';
import { LESSON_GAME_TITLE_KEY } from '@/services/lessonGames';

export function GameResultsSheet({
  homeworkId,
  title,
  games,
  onClose,
}: {
  /** Null = closed. */
  homeworkId: string | null;
  title: string;
  /** The homework's game attachments: with more than one, each row says which lesson it is for. */
  games: readonly HomeworkGameResource[];
  onClose: () => void;
}) {
  const colors = useColors();
  const { t, isRTL } = useLanguage();
  const align = isRTL ? 'right' : 'left';
  const rowDir = isRTL ? 'row-reverse' : 'row';
  const [rows, setRows] = useState<TeacherGameResult[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!homeworkId) return;
    let live = true;
    setRows(null);
    setFailed(false);
    fetchGameResults(homeworkId).then(
      r => {
        if (live) setRows(r);
      },
      () => {
        if (live) setFailed(true);
      },
    );
    return () => {
      live = false;
    };
  }, [homeworkId, attempt]);

  return (
    <Modal visible={homeworkId !== null} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <Text style={{ color: colors.foreground, fontFamily: 'ReadexPro_600SemiBold', fontSize: TYPE.bodyLg, textAlign: align }}>
            {t('hwGameResultsTitle')}
          </Text>
          <Text numberOfLines={2} style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: TYPE.caption, textAlign: align }}>
            {title}
          </Text>
          <ScrollView style={{ maxHeight: 400 }} contentContainerStyle={{ gap: SPACE.sm }} showsVerticalScrollIndicator={false}>
            {failed ? (
              <View style={{ alignItems: 'center', gap: SPACE.sm, paddingVertical: SPACE.xl }}>
                <Text style={{ color: colors.destructive, fontFamily: 'Almarai_400Regular', fontSize: TYPE.body }}>{t('hwGameResultsFailed')}</Text>
                <Pressable onPress={() => setAttempt(a => a + 1)} accessibilityRole="button" hitSlop={8}>
                  <Text style={{ color: colors.primary, fontFamily: 'ReadexPro_600SemiBold', textDecorationLine: 'underline' }}>{t('retry')}</Text>
                </Pressable>
              </View>
            ) : rows === null ? (
              <ActivityIndicator color={colors.primary} style={{ paddingVertical: SPACE.xl }} />
            ) : rows.length === 0 ? (
              <Text style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: TYPE.body, textAlign: 'center', paddingVertical: SPACE.xl }}>
                {t('hwGameResultsEmpty')}
              </Text>
            ) : (
              rows.map(r => {
                const attempts = t('hwGameAttempts', r.attempts);
                const lesson = games.length > 1 ? games.find(g => g.lessonId === r.lessonId && g.game === r.game)?.title : undefined;
                return (
                  <View key={`${r.studentId}:${r.lessonId}:${r.game}`} style={[styles.row, { borderColor: colors.border, flexDirection: rowDir }]}>
                    <View style={{ flex: 1, gap: SPACE.xxs }}>
                      <Text numberOfLines={1} style={{ color: colors.foreground, fontFamily: 'ReadexPro_500Medium', fontSize: TYPE.label, textAlign: align }}>
                        {r.displayName}
                      </Text>
                      <Text style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: TYPE.caption, textAlign: align }}>
                        {`${t(LESSON_GAME_TITLE_KEY[r.game])} · ${isRTL ? toArabicDigits(attempts) : attempts}`}
                      </Text>
                      {lesson ? (
                        <Text numberOfLines={1} style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: TYPE.caption, textAlign: align }}>
                          {lesson}
                        </Text>
                      ) : null}
                    </View>
                    <Text style={{ color: colors.primary, fontFamily: 'ReadexPro_600SemiBold', fontSize: TYPE.body }}>
                      {gameScoreText(r.score, r.total, isRTL)}
                    </Text>
                  </View>
                );
              })
            )}
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
  row: { alignItems: 'center', gap: SPACE.md, borderWidth: 1, borderRadius: RADIUS.md, padding: SPACE.md },
  actions: { flexDirection: 'row', justifyContent: 'flex-end' },
  doneBtn: { paddingHorizontal: SPACE.lg, paddingVertical: SPACE.md, borderRadius: RADIUS.md },
});
