/**
 * Where a parent or student says which class they are in, so the curriculum
 * shows only that. A student picks one; a parent picks one per child.
 *
 * Same two ways in as `/setup-subjects`:
 *  - Mandatory, via the routing gate in `app/_layout.tsx` (`needsGradeSetup`
 *    in routeGating.ts), once the roster claim is done. No back button.
 *  - Optional, from Settings, with `mode=edit`: a back arrow, "Save", and
 *    `goBack()` on success.
 *
 * Saves to `gradeIds` through the same PATCH /users/profile a teacher uses;
 * the server keeps a student to one (`limitGradesForRole`). A student already
 * linked to a class starts with that class's grade ticked.
 */
import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import { isStudentRole, useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/Button';
import { getPickerGrades } from '@/services/curriculumData';
import { goBack } from '@/services/navigation';
import { getMyGradeIds } from '@/services/studentExam';

export default function SetupGradeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { t, lang, isRTL } = useLanguage();
  const { user, updateProfile } = useAuth();
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const editMode = mode === 'edit';
  const isStudent = isStudentRole(user?.role);

  const grades = getPickerGrades();
  // Highest grade first, as /setup-subjects lists them; the picker's own order
  // is persisted state, so sort a copy.
  const ordered = [...grades].sort((x, y) => y.level - x.level);
  const [selected, setSelected] = useState<string[]>(() => user?.gradeIds ?? []);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // First time through, a linked student's class already says which grade they
  // are in — start there rather than on an empty choice.
  useEffect(() => {
    if (!isStudent || selected.length > 0) return;
    let cancelled = false;
    void getMyGradeIds().then(ids => {
      const own = ids.find(id => grades.some(g => g.id === id));
      if (!cancelled && own) setSelected(prev => (prev.length === 0 ? [own] : prev));
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isStudent]);

  const toggle = (id: string) => {
    Haptics.selectionAsync();
    setSelected(prev => {
      if (isStudent) return [id];
      return prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id];
    });
  };

  const canSubmit = selected.length > 0 && !saving;
  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSaving(true);
    setError('');
    try {
      await updateProfile({ gradeIds: selected });
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      if (editMode) goBack();
      else router.replace('/(tabs)');
    } catch {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError(t('gradeSetupFailed'));
      setSaving(false);
    }
  };

  const align = isRTL ? 'right' : 'left';
  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + (editMode ? 16 : 40), paddingBottom: insets.bottom + 32 }]}
      >
        {editMode ? (
          <Pressable onPress={() => goBack()} hitSlop={10} style={[styles.back, { alignSelf: isRTL ? 'flex-end' : 'flex-start' }]}>
            <Ionicons name={isRTL ? 'arrow-forward' : 'arrow-back'} size={22} color={colors.foreground} />
          </Pressable>
        ) : (
          <View style={[styles.icon, { backgroundColor: colors.primary + '18' }]}>
            <Ionicons name="school-outline" size={32} color={colors.primary} />
          </View>
        )}

        <Text style={[styles.title, { color: colors.foreground, fontFamily: 'ReadexPro_700Bold', textAlign: align }]}>
          {t(isStudent ? 'gradeSetupTitleStudent' : 'gradeSetupTitleParent')}
        </Text>
        <Text style={[styles.desc, { color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', textAlign: align }]}>
          {t(isStudent ? 'gradeSetupDescStudent' : 'gradeSetupDescParent')}
        </Text>

        <View style={[styles.chips, isRTL && { flexDirection: 'row-reverse' }]}>
          {ordered.map(g => {
            const on = selected.includes(g.id);
            return (
              <Pressable
                key={g.id}
                onPress={() => toggle(g.id)}
                accessibilityRole={isStudent ? 'radio' : 'checkbox'}
                aria-checked={on}
                style={[styles.chip, { backgroundColor: on ? colors.primary : colors.muted, borderColor: on ? colors.primary : colors.border }]}
              >
                <Text
                  numberOfLines={1}
                  style={[styles.chipText, { color: on ? colors.primaryForeground : colors.foreground, fontFamily: 'ReadexPro_500Medium' }]}
                >
                  {lang === 'ar' ? g.nameAr : g.name}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {error ? (
          <View style={[styles.errorBanner, { backgroundColor: colors.destructive + '18', borderColor: colors.destructive + '44', borderRadius: colors.radius, flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
            <Ionicons name="alert-circle-outline" size={16} color={colors.destructive} />
            <Text style={[styles.errorText, { color: colors.destructive, fontFamily: 'Almarai_400Regular', textAlign: align }]}>{error}</Text>
          </View>
        ) : null}

        <Button
          label={editMode ? t('teacherSetupSave') : t('gradeSetupContinue')}
          onPress={handleSubmit}
          loading={saving}
          disabled={!canSubmit}
          fullWidth
          style={{ marginTop: 24 }}
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1, paddingHorizontal: 24 },
  back: { marginBottom: 12, width: 40 },
  icon: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginBottom: 20 },
  title: { fontSize: 22, marginBottom: 8, lineHeight: 30 },
  desc: { fontSize: 15, lineHeight: 24, marginBottom: 20 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20, borderWidth: 1 },
  chipText: { fontSize: 13 },
  errorBanner: { alignItems: 'center', gap: 8, padding: 12, borderWidth: 1, marginTop: 16 },
  errorText: { flex: 1, fontSize: 15, lineHeight: 24 },
});
