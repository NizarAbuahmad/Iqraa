/**
 * Pick a student to enter answers for — class first, then roster.
 *
 * There is no single "students of this evaluation" list — an evaluation isn't
 * tied to a class. So this is the same two-step picker the roster itself
 * uses (`/classes` → `/classes/[id]`), reused here rather than reinvented,
 * with each student's attempt status overlaid from `listAttempts`.
 */
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import { RosterError, getClass, listClasses, type ClassGroup, type RosterStudent } from '@/services/roster';
import { listAttempts, type AttemptListRow, type AttemptStatus } from '@/services/evaluations';
import type { TranslationKey } from '@/services/i18n';

const ACCENT = '#1B6B62';

const STATUS_KEY: Record<AttemptStatus, TranslationKey> = {
  not_started: 'attemptStatusNotStarted',
  in_progress: 'attemptStatusInProgress',
  submitted: 'attemptStatusSubmitted',
  grading: 'attemptStatusGrading',
  graded: 'attemptStatusGraded',
  needs_review: 'attemptStatusNeedsReview',
  abandoned: 'attemptStatusAbandoned',
};
const STATUS_COLOR: Record<AttemptStatus, string> = {
  not_started: '#9CA3AF',
  in_progress: '#F59E0B',
  submitted: '#3B82F6',
  grading: '#3B82F6',
  graded: '#10B981',
  needs_review: '#EF4444',
  abandoned: '#9CA3AF',
};

export default function PickStudentScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { t, isRTL, lang } = useLanguage();
  const align = isRTL ? 'right' : 'left';
  const { id } = useLocalSearchParams<{ id: string }>();

  const [classes, setClasses] = useState<ClassGroup[]>([]);
  const [classId, setClassId] = useState<string | null>(null);
  const [students, setStudents] = useState<RosterStudent[]>([]);
  const [attempts, setAttempts] = useState<AttemptListRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useFocusEffect(
    useCallback(() => {
      if (!id) return;
      listAttempts(id).then(setAttempts).catch(() => {});
    }, [id]),
  );

  const loadClasses = useCallback(async () => {
    setError('');
    try {
      setClasses(await listClasses());
    } catch (err) {
      setError(err instanceof RosterError ? err.message : t('rosterLoadFailed'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useFocusEffect(
    useCallback(() => {
      if (!classId) void loadClasses();
    }, [classId, loadClasses]),
  );

  const openClass = async (id_: string) => {
    setError('');
    setLoading(true);
    try {
      const { students: roster } = await getClass(id_);
      setStudents(roster);
      setClassId(id_);
    } catch (err) {
      setError(err instanceof RosterError ? err.message : t('rosterLoadFailed'));
    } finally {
      setLoading(false);
    }
  };

  const attemptFor = (studentId: string) => attempts.find(a => a.studentId === studentId);

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={ACCENT} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={[styles.hero, { backgroundColor: ACCENT, paddingTop: insets.top + 12 }]}>
        <Pressable
          onPress={() => (classId ? setClassId(null) : router.back())}
          hitSlop={12}
          style={{ alignSelf: isRTL ? 'flex-end' : 'flex-start' }}
        >
          <Ionicons name={isRTL ? 'arrow-forward' : 'arrow-back'} size={22} color="#fff" />
        </Pressable>
        <Text style={[styles.heroTitle, { fontFamily: 'Cairo_700Bold', textAlign: align }]}>
          {classId ? t('pickStudentTitle') : t('pickClassFirst')}
        </Text>
      </View>

      {error ? (
        <View style={[styles.errorBox, { borderColor: colors.destructive, margin: 20 }]}>
          <Ionicons name="alert-circle-outline" size={18} color={colors.destructive} />
          <Text style={{ color: colors.destructive, fontFamily: 'Almarai_400Regular', flex: 1, textAlign: align }}>
            {error}
          </Text>
        </View>
      ) : null}

      {!classId ? (
        <FlatList
          data={classes}
          keyExtractor={c => c.id}
          contentContainerStyle={{ padding: 20, gap: 12 }}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => openClass(item.id)}
              style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
            >
              <Text style={[{ flex: 1, color: colors.foreground, fontFamily: 'Cairo_600SemiBold', fontSize: 16, textAlign: align }]}>
                {lang === 'ar' && item.nameAr ? item.nameAr : item.name}
              </Text>
              <Ionicons name={isRTL ? 'chevron-back' : 'chevron-forward'} size={20} color={colors.mutedForeground} />
            </Pressable>
          )}
        />
      ) : (
        <FlatList
          data={students}
          keyExtractor={s => s.id}
          contentContainerStyle={{ padding: 20, gap: 12 }}
          renderItem={({ item }) => {
            const attempt = attemptFor(item.id);
            const status = attempt?.status ?? 'not_started';
            return (
              <Pressable
                onPress={() => router.push({ pathname: '/evaluations/[id]/answers/[studentId]', params: { id: id as string, studentId: item.id } })}
                style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[{ color: colors.foreground, fontFamily: 'Cairo_600SemiBold', fontSize: 15, textAlign: align }]}>
                    {item.displayName}
                  </Text>
                  {attempt?.result && (
                    <Text style={[{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: 12, marginTop: 2, textAlign: align }]}>
                      {t('resultPercentLabel', attempt.result.percent)}
                    </Text>
                  )}
                </View>
                <View style={[styles.statusPill, { backgroundColor: STATUS_COLOR[status] + '20' }]}>
                  <Text style={{ color: STATUS_COLOR[status], fontFamily: 'Cairo_600SemiBold', fontSize: 11 }}>
                    {t(STATUS_KEY[status])}
                  </Text>
                </View>
              </Pressable>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  hero: { paddingHorizontal: 20, paddingBottom: 20, gap: 12 },
  heroTitle: { fontSize: 22, color: '#fff' },
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderRadius: 14, borderWidth: 1 },
  statusPill: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 20 },
  errorBox: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 12, borderWidth: 1 },
});
