/**
 * «عنك» — a teacher's four optional questions: gender, age range, governorate, years teaching
 * (services/teacherProfile.ts). They feed the admin insights page's "who the teachers are"
 * breakdowns; nothing in the product changes with them.
 *
 * Reached two ways: right after a new teacher saves /setup-subjects (`?from=setup`, which adds
 * «تخطّ» and goes on to the tabs either way), and from Profile → «عنك (اختياري)». Every answer
 * can be left blank or cleared. Only teachers are sent here; the API refuses these fields from a
 * student or parent account, who may be minors.
 */
import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import { useAuth } from '@/context/AuthContext';
import { SPACE, TYPE } from '@/constants/theme';
import { ICON } from '@/constants/icons';
import { Surface } from '@/components/ui/Surface';
import { Button } from '@/components/ui/Button';
import { ChipGroup } from '@/components/generator/ChipGroup';
import { goBack } from '@/services/navigation';
import { readableOn } from '@/services/readableColor';
import type { TranslationKey } from '@/services/i18n';
import {
  EMPTY_TEACHER_PROFILE,
  TEACHER_PROFILE_FIELDS,
  TEACHER_PROFILE_OPTIONS,
  changedTeacherProfile,
  teacherProfileLabel,
  type TeacherProfile,
  type TeacherProfileField,
} from '@/services/teacherProfile';

const FIELD_LABEL: Record<TeacherProfileField, TranslationKey> = {
  gender: 'teacherProfileGender',
  ageRange: 'teacherProfileAgeRange',
  governorate: 'teacherProfileGovernorate',
  yearsTeaching: 'teacherProfileYearsTeaching',
};

export default function TeacherProfileScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { t, isRTL, lang } = useLanguage();
  const { user, updateProfile } = useAuth();
  const { from } = useLocalSearchParams<{ from?: string }>();
  const fromSetup = from === 'setup';
  const [answers, setAnswers] = useState<TeacherProfile>(user?.teacherProfile ?? EMPTY_TEACHER_PROFILE);
  // Only fields the teacher changed here are sent. The screen can open before /auth/me has
  // brought the stored answers back (a cold start, a web reload); sending all four would then
  // overwrite the stored answers with blanks.
  const [touched, setTouched] = useState<ReadonlySet<TeacherProfileField>>(new Set());
  const stored = user?.teacherProfile;
  useEffect(() => {
    if (!stored) return;
    setAnswers(prev => {
      const next = { ...prev };
      for (const f of TEACHER_PROFILE_FIELDS) if (!touched.has(f)) next[f] = stored[f];
      return next;
    });
  }, [stored, touched]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const align = isRTL ? 'right' : 'left';
  const accent = readableOn(colors.primary, colors.card);

  const leave = () => {
    if (fromSetup) router.replace('/(tabs)');
    else goBack();
  };

  const set = (field: TeacherProfileField, value: string | null) => {
    setSaved(false);
    setTouched(prev => new Set(prev).add(field));
    setAnswers(prev => ({ ...prev, [field]: value }));
  };
  const pick = (field: TeacherProfileField, value: string) => set(field, value);
  const clear = (field: TeacherProfileField) => set(field, null);

  const save = async () => {
    const changes = changedTeacherProfile(answers, touched);
    if (Object.keys(changes).length === 0) {
      // Nothing picked: nothing to send (the API refuses an empty update).
      if (fromSetup) leave();
      else setSaved(true);
      return;
    }
    setSaving(true);
    setError('');
    try {
      await updateProfile({ teacherProfile: changes });
      setSaved(true);
      setTouched(new Set());
      if (fromSetup) leave();
    } catch {
      setError(t('teacherProfileFailed'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View
        style={[
          styles.header,
          { paddingTop: insets.top + (insets.top === 0 ? SPACE.md : SPACE.sm), backgroundColor: colors.card, borderBottomColor: colors.border },
        ]}
      >
        <View style={styles.column}>
          <View style={[styles.headerRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
            {!fromSetup && (
              <Pressable onPress={() => goBack()} hitSlop={8} style={styles.backBtn} accessibilityRole="button" accessibilityLabel={t('back')}>
                <Ionicons name={isRTL ? 'arrow-forward' : 'arrow-back'} size={ICON.xl} color={colors.foreground} />
              </Pressable>
            )}
            <Text accessibilityRole="header" style={[styles.title, { color: colors.foreground, textAlign: align, flex: 1 }]}>
              {t('teacherProfileTitle')}
            </Text>
          </View>
          <Text style={[styles.subtitle, { color: colors.mutedForeground, textAlign: align }]}>{t('teacherProfileIntro')}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + SPACE.page }]}>
        <View style={[styles.column, styles.list]}>
          {TEACHER_PROFILE_FIELDS.map(field => {
            const value = answers[field];
            return (
              <Surface key={field} style={styles.card}>
                <ChipGroup
                  label={t(FIELD_LABEL[field])}
                  single
                  accent={accent}
                  options={TEACHER_PROFILE_OPTIONS[field].map(id => ({ id, label: teacherProfileLabel(id, lang) }))}
                  selected={new Set(value ? [value] : [])}
                  onToggle={id => pick(field, id)}
                />
                {value !== null && (
                  <Pressable
                    onPress={() => clear(field)}
                    accessibilityRole="button"
                    hitSlop={8}
                    style={[styles.clear, { alignSelf: isRTL ? 'flex-end' : 'flex-start' }]}
                  >
                    <Text style={[styles.clearText, { color: colors.mutedForeground }]}>{t('teacherProfileClear')}</Text>
                  </Pressable>
                )}
              </Surface>
            );
          })}

          {error ? <Text style={[styles.status, { color: colors.destructive, textAlign: align }]}>{error}</Text> : null}
          {saved && !fromSetup ? (
            <View style={[styles.savedRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
              <Ionicons name="checkmark-circle" size={ICON.md} color={colors.success} />
              <Text style={[styles.status, { color: colors.foreground }]}>{t('teacherProfileSaved')}</Text>
            </View>
          ) : null}

          <Button label={t('teacherProfileSave')} onPress={save} loading={saving} disabled={saving} fullWidth size="lg" />
          {fromSetup && <Button label={t('teacherProfileSkip')} onPress={leave} variant="ghost" fullWidth />}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: SPACE.xl, paddingBottom: SPACE.lg, borderBottomWidth: StyleSheet.hairlineWidth },
  headerRow: { alignItems: 'center', gap: SPACE.sm, minHeight: 44 },
  backBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: 'ReadexPro_700Bold', fontSize: TYPE.title },
  subtitle: { fontFamily: 'Almarai_400Regular', fontSize: TYPE.body, lineHeight: 23, marginTop: SPACE.xs },
  body: { padding: SPACE.lg },
  column: { width: '100%', maxWidth: 760, alignSelf: 'center' },
  list: { gap: SPACE.md },
  card: { padding: SPACE.lg },
  clear: { marginTop: SPACE.sm, minHeight: 44, justifyContent: 'center' },
  clearText: { fontFamily: 'Almarai_400Regular', fontSize: TYPE.caption, textDecorationLine: 'underline' },
  status: { fontFamily: 'Almarai_400Regular', fontSize: TYPE.body },
  savedRow: { alignItems: 'center', gap: SPACE.xs },
});
