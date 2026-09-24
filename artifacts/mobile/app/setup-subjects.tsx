/**
 * Where a teacher says what they teach — one entry per grade, each paired
 * with the subjects taught in that grade — picked from the same catalog the
 * curriculum browser and AI-tools pickers already use (see
 * `@workspace/curriculum`'s GRADES/SUBJECTS).
 *
 * The flow is grade-first on purpose: add a grade, pick its subjects, add
 * another grade, pick its subjects. A flat "pick every grade, then pick
 * every subject" (the shape this screen used before) can't say that a
 * teacher who teaches Math in grade 7 doesn't also teach Science there just
 * because they teach Science in grade 8 — every subject picked applied to
 * every grade picked. `teachingAssignments` is what fixes that; see
 * `narrowSubjectsForGrade` in `services/teacherCatalogFilter.ts`, the reader
 * this exists for.
 *
 * Two ways in:
 *  - Mandatory, via the routing gate in `app/_layout.tsx` (`needsTeacherSetup`
 *    in routeGating.ts), for any teacher who has picked neither yet. No back
 *    button, no skip — same shape as `claim-required.tsx`'s gate, and for the
 *    same reason: `getVisibleGrades`/`getSubjectsForGrade` need something to
 *    default `app/(tabs)/curriculum.tsx` to.
 *  - Optional, from the profile screen's "Grades & Subjects" row, to change
 *    or add more later. `editMode` distinguishes the two: a back arrow instead
 *    of nothing, "Save" instead of "Continue", and `goBack()` instead of
 *    `router.replace('/(tabs)')` on success.
 */
import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import { TeachingAssignment, useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/Button';
import { getPickerGrades, getSubjectsForGrade } from '@/services/curriculumData';
import { goBack } from '@/services/navigation';

function toggle(list: string[], id: string): string[] {
  return list.includes(id) ? list.filter(x => x !== id) : [...list, id];
}

/**
 * An account set up before per-grade pairing existed only has the flat
 * `gradeIds`/`subjectIds` — seed one assignment per picked grade, each
 * carrying every picked subject, so opening this screen shows exactly what
 * the old flat fields implied instead of an unexplained empty state.
 */
function initialAssignments(user: { teachingAssignments?: TeachingAssignment[]; gradeIds?: string[]; subjectIds?: string[] } | null): TeachingAssignment[] {
  if (user?.teachingAssignments?.length) return user.teachingAssignments;
  if (user?.gradeIds?.length) return user.gradeIds.map(gradeId => ({ gradeId, subjectIds: user?.subjectIds ?? [] }));
  return [];
}

function Chip({ label, selected, onPress, colors, accent }: {
  label: string; selected: boolean; onPress: () => void;
  colors: ReturnType<typeof useColors>; accent: string;
}) {
  return (
    <Pressable
      onPress={() => { Haptics.selectionAsync(); onPress(); }}
      style={[
        styles.chip,
        {
          backgroundColor: selected ? accent : colors.muted,
          borderColor: selected ? accent : colors.border,
        },
      ]}
    >
      <Text
        style={[
          styles.chipText,
          { color: selected ? colors.primaryForeground : colors.foreground, fontFamily: 'Cairo_500Medium' },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export default function SetupSubjectsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { t, lang, isRTL } = useLanguage();
  const { user, updateProfile } = useAuth();
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const editMode = mode === 'edit';

  const [assignments, setAssignments] = useState<TeachingAssignment[]>(() => initialAssignments(user));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const align = isRTL ? 'right' : 'left';
  const grades = getPickerGrades();
  const addedGradeIds = new Set(assignments.map(a => a.gradeId));
  const remainingGrades = grades.filter(g => !addedGradeIds.has(g.id));
  const hasEmptyAssignment = assignments.some(a => a.subjectIds.length === 0);
  const canSubmit = assignments.length > 0 && !hasEmptyAssignment && !saving;

  const addGrade = (gradeId: string) => {
    Haptics.selectionAsync();
    setAssignments(prev => [...prev, { gradeId, subjectIds: [] }]);
  };

  const removeGrade = (gradeId: string) => {
    Haptics.selectionAsync();
    setAssignments(prev => prev.filter(a => a.gradeId !== gradeId));
  };

  const toggleSubject = (gradeId: string, subjectId: string) => {
    setAssignments(prev => prev.map(a => (a.gradeId === gradeId ? { ...a, subjectIds: toggle(a.subjectIds, subjectId) } : a)));
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSaving(true);
    setError('');
    try {
      await updateProfile({ teachingAssignments: assignments });
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      if (editMode) goBack();
      else router.replace('/(tabs)');
    } catch {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError(t('teacherSetupFailed'));
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + (editMode ? 16 : 40), paddingBottom: insets.bottom + 32 },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        {editMode ? (
          <Pressable
            onPress={() => goBack()} hitSlop={10}
            style={[styles.back, { alignSelf: isRTL ? 'flex-end' : 'flex-start' }]}
          >
            <Ionicons name={isRTL ? 'arrow-forward' : 'arrow-back'} size={22} color={colors.foreground} />
          </Pressable>
        ) : (
          <View style={[styles.icon, { backgroundColor: colors.primary + '18' }]}>
            <Ionicons name="school-outline" size={32} color={colors.primary} />
          </View>
        )}

        <Text style={[styles.title, { color: colors.foreground, fontFamily: 'Cairo_700Bold', textAlign: align }]}>
          {editMode ? t('editTeachingTitle') : t('teacherSetupTitle')}
        </Text>
        <Text style={[styles.desc, { color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', textAlign: align }]}>
          {t('teacherSetupDesc')}
        </Text>

        {assignments.map(a => {
          const grade = grades.find(g => g.id === a.gradeId);
          if (!grade) return null;
          const gradeName = lang === 'ar' ? grade.nameAr : grade.name;
          return (
            <View
              key={a.gradeId}
              style={[styles.gradeCard, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}
            >
              <View style={[styles.gradeCardHeader, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                <Text style={[styles.gradeCardTitle, { color: colors.foreground, fontFamily: 'Cairo_600SemiBold', textAlign: align, flex: 1 }]}>
                  {gradeName}
                </Text>
                <Pressable
                  onPress={() => removeGrade(a.gradeId)}
                  hitSlop={8}
                  accessibilityLabel={t('teacherSetupRemoveGrade', gradeName)}
                >
                  <Ionicons name="trash-outline" size={18} color={colors.mutedForeground} />
                </Pressable>
              </View>
              <View style={[styles.chips, isRTL && { flexDirection: 'row-reverse' }]}>
                {getSubjectsForGrade(a.gradeId).map(s => (
                  <Chip
                    key={s.id}
                    label={lang === 'ar' ? s.nameAr : s.name}
                    selected={a.subjectIds.includes(s.id)}
                    onPress={() => toggleSubject(a.gradeId, s.id)}
                    colors={colors}
                    accent={s.color}
                  />
                ))}
              </View>
            </View>
          );
        })}

        {remainingGrades.length > 0 ? (
          <>
            <Text style={[styles.sectionLabel, { color: colors.foreground, fontFamily: 'Cairo_600SemiBold', textAlign: align, marginTop: assignments.length > 0 ? 8 : 20 }]}>
              {t('teacherSetupAddGrade')}
            </Text>
            <View style={[styles.chips, isRTL && { flexDirection: 'row-reverse' }]}>
              {remainingGrades.map(g => (
                <Chip
                  key={g.id}
                  label={lang === 'ar' ? g.nameAr : g.name}
                  selected={false}
                  onPress={() => addGrade(g.id)}
                  colors={colors}
                  accent={colors.primary}
                />
              ))}
            </View>
          </>
        ) : null}

        {error ? (
          <View style={[styles.errorBanner, { backgroundColor: colors.destructive + '18', borderColor: colors.destructive + '44', borderRadius: colors.radius, flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
            <Ionicons name="alert-circle-outline" size={16} color={colors.destructive} />
            <Text style={[styles.errorText, { color: colors.destructive, fontFamily: 'Almarai_400Regular', textAlign: align }]}>
              {error}
            </Text>
          </View>
        ) : null}

        {!saving && assignments.length === 0 ? (
          <Text style={[styles.hint, { color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', textAlign: align }]}>
            {t('teacherSetupNoGradesYet')}
          </Text>
        ) : null}
        {!saving && assignments.length > 0 && hasEmptyAssignment ? (
          <Text style={[styles.hint, { color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', textAlign: align }]}>
            {t('teacherSetupPickAtLeastOne')}
          </Text>
        ) : null}

        <Button
          label={editMode ? t('teacherSetupSave') : t('teacherSetupContinue')}
          onPress={handleSubmit}
          loading={saving}
          disabled={!canSubmit}
          fullWidth
          style={{ marginTop: 24 }}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1, paddingHorizontal: 24 },
  back: { marginBottom: 12, width: 40 },
  icon: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginBottom: 20 },
  title: { fontSize: 22, marginBottom: 8, lineHeight: 30 },
  desc: { fontSize: 14, lineHeight: 22, marginBottom: 20 },
  sectionLabel: { fontSize: 14, marginBottom: 10 },
  gradeCard: { borderWidth: 1, padding: 14, marginBottom: 12 },
  gradeCardHeader: { alignItems: 'center', marginBottom: 12, gap: 8 },
  gradeCardTitle: { fontSize: 15 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20, borderWidth: 1 },
  chipText: { fontSize: 13 },
  hint: { fontSize: 12, lineHeight: 19, marginTop: 10 },
  errorBanner: { alignItems: 'center', gap: 8, padding: 12, borderWidth: 1, marginTop: 16 },
  errorText: { flex: 1, fontSize: 13, lineHeight: 21 },
});
