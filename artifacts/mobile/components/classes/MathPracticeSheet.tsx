/**
 * «تمارين الرياضيات» for one class — each student's best Math Corner «اختبر نفسك»
 * score per lesson, from `GET /classes/:id/math-practice`. Opened from the class's
 * students tab; loads when opened; read-only, so no text input and no
 * KeyboardSafeView. Lesson titles come from the knowledge base by id.
 */
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import { RADIUS, SPACE, TYPE } from '@/constants/theme';
import { toArabicDigits } from '@/services/labFormat';
import { gameScoreText } from '@/services/homework';
import { getLessonById } from '@/services/knowledgeBase';
import { practiceByStudent, type ClassPracticeRow } from '@/services/mathExercises';
import { fetchClassPractice } from '@/services/mathExerciseProgress';

export function MathPracticeSheet({ classId, onClose }: { /** Null = closed. */ classId: string | null; onClose: () => void }) {
  const colors = useColors();
  const { t, isRTL, lang } = useLanguage();
  const align = isRTL ? 'right' : 'left';
  const rowDir = isRTL ? 'row-reverse' : 'row';
  const [rows, setRows] = useState<ClassPracticeRow[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!classId) return;
    let live = true;
    setRows(null);
    setFailed(false);
    fetchClassPractice(classId).then(
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
  }, [classId, attempt]);

  const lessonTitle = (id: string) => {
    const l = getLessonById(id);
    return l ? (lang === 'ar' ? l.titleAr : l.titleEn || l.titleAr) : id;
  };

  return (
    <Modal visible={classId !== null} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <Text style={{ color: colors.foreground, fontFamily: 'ReadexPro_600SemiBold', fontSize: TYPE.bodyLg, textAlign: align }}>
            {t('mathPracticeTitle')}
          </Text>
          <Text style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: TYPE.caption, textAlign: align }}>
            {t('mathPracticeHint')}
          </Text>
          <ScrollView style={{ maxHeight: 440 }} contentContainerStyle={{ gap: SPACE.sm }} showsVerticalScrollIndicator={false}>
            {failed ? (
              <View style={{ alignItems: 'center', gap: SPACE.sm, paddingVertical: SPACE.xl }}>
                <Text style={{ color: colors.destructive, fontFamily: 'Almarai_400Regular', fontSize: TYPE.body }}>{t('mathPracticeFailed')}</Text>
                <Pressable onPress={() => setAttempt(a => a + 1)} accessibilityRole="button" hitSlop={8}>
                  <Text style={{ color: colors.primary, fontFamily: 'ReadexPro_600SemiBold', textDecorationLine: 'underline' }}>{t('retry')}</Text>
                </Pressable>
              </View>
            ) : rows === null ? (
              <ActivityIndicator color={colors.primary} style={{ paddingVertical: SPACE.xl }} />
            ) : rows.length === 0 ? (
              <Text style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: TYPE.body, textAlign: 'center', paddingVertical: SPACE.xl }}>
                {t('mathPracticeEmpty')}
              </Text>
            ) : (
              practiceByStudent(rows).map(s => (
                <View key={s.studentId} style={[styles.student, { borderColor: colors.border }]}>
                  <Text numberOfLines={1} style={{ color: colors.foreground, fontFamily: 'ReadexPro_600SemiBold', fontSize: TYPE.label, textAlign: align }}>
                    {s.displayName}
                  </Text>
                  {s.lessons.map(r => {
                    const attempts = t('hwGameAttempts', r.attempts);
                    return (
                      <View key={r.lessonId} style={[styles.lesson, { flexDirection: rowDir }]}>
                        <View style={{ flex: 1, gap: SPACE.xxs }}>
                          <Text numberOfLines={2} style={{ color: colors.foreground, fontFamily: 'Almarai_400Regular', fontSize: TYPE.caption, textAlign: align }}>
                            {lessonTitle(r.lessonId)}
                          </Text>
                          <Text style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: TYPE.micro, textAlign: align }}>
                            {isRTL ? toArabicDigits(attempts) : attempts}
                          </Text>
                        </View>
                        <Text style={{ color: colors.primary, fontFamily: 'ReadexPro_600SemiBold', fontSize: TYPE.body }}>
                          {gameScoreText(r.correct, r.total, isRTL)}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              ))
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
  card: { width: '100%', maxWidth: 480, borderRadius: RADIUS.lg, padding: SPACE.xl, gap: SPACE.md },
  student: { borderWidth: 1, borderRadius: RADIUS.md, padding: SPACE.md, gap: SPACE.sm },
  lesson: { alignItems: 'center', gap: SPACE.md },
  actions: { flexDirection: 'row', justifyContent: 'flex-end' },
  doneBtn: { paddingHorizontal: SPACE.lg, paddingVertical: SPACE.md, borderRadius: RADIUS.md },
});
