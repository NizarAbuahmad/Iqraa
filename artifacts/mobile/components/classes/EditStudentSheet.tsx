/**
 * Edit one student: name, register number, gender, the teacher's note.
 *
 * Mounted only while a student is being edited (`key` on the student id), so
 * its draft is initialised from props once and never needs an effect to reset.
 * It reports only what changed (services/studentEdit.ts) and leaves the save,
 * the cache update and the error text to the screen that owns the roster.
 */
import React, { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, TextInput, View, type TextStyle } from 'react-native';
import { KeyboardSafeView } from '@/components/ui/KeyboardSafeView';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import { RADIUS, SPACE, TYPE } from '@/constants/theme';
import type { RosterStudent, StudentChanges } from '@/services/roster';
import { canSaveStudent, draftOf, studentChanges, type StudentDraft } from '@/services/studentEdit';

interface Props {
  student: RosterStudent;
  saving: boolean;
  error: string;
  onSave: (changes: StudentChanges) => void;
  onClose: () => void;
}

const GENDERS = [
  { value: '', labelKey: 'studentGenderUnset' },
  { value: 'male', labelKey: 'studentGenderMale' },
  { value: 'female', labelKey: 'studentGenderFemale' },
] as const;

export function EditStudentSheet({ student, saving, error, onSave, onClose }: Props) {
  const colors = useColors();
  const { t, isRTL } = useLanguage();
  const align = isRTL ? 'right' : 'left';
  const [draft, setDraft] = useState<StudentDraft>(() => draftOf(student));
  const set = <K extends keyof StudentDraft>(key: K, value: StudentDraft[K]) =>
    setDraft(prev => ({ ...prev, [key]: value }));

  const nameMissing = draft.displayName.trim() === '';
  const canSave = canSaveStudent(student, draft) && !saving;

  const inputStyle: TextStyle[] = [
    styles.input,
    { color: colors.foreground, borderColor: colors.border, fontFamily: 'Almarai_400Regular', textAlign: align },
  ];
  const labelStyle: TextStyle[] = [
    styles.label,
    { color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', textAlign: align },
  ];

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardSafeView>
        <View style={styles.backdrop}>
          <View style={[styles.card, { backgroundColor: colors.card }]}>
            <Text style={[styles.title, { color: colors.foreground, fontFamily: 'ReadexPro_600SemiBold', textAlign: align }]}>
              {t('editStudent')}
            </Text>

            <Text style={labelStyle}>{t('studentNameLabel')}</Text>
            <TextInput
              value={draft.displayName}
              onChangeText={v => set('displayName', v)}
              autoFocus
              style={inputStyle}
              accessibilityLabel={t('studentNameLabel')}
            />
            {nameMissing ? (
              <Text style={[styles.hint, { color: colors.destructive, fontFamily: 'Almarai_400Regular', textAlign: align }]}>
                {t('studentNameRequired')}
              </Text>
            ) : null}

            <Text style={labelStyle}>{t('studentRefLabel')}</Text>
            <TextInput
              value={draft.externalRef}
              onChangeText={v => set('externalRef', v)}
              style={inputStyle}
              accessibilityLabel={t('studentRefLabel')}
            />

            <Text style={labelStyle}>{t('studentGenderLabel')}</Text>
            <View style={styles.genderRow}>
              {GENDERS.map(g => {
                const on = draft.gender === g.value;
                return (
                  <Pressable
                    key={g.value}
                    onPress={() => set('gender', g.value)}
                    accessibilityRole="radio"
                    aria-selected={on}
                    style={[
                      styles.genderBtn,
                      { borderColor: on ? colors.primary : colors.border, backgroundColor: on ? colors.primary : 'transparent' },
                    ]}
                  >
                    <Text
                      style={{
                        color: on ? colors.primaryForeground : colors.foreground,
                        fontFamily: 'ReadexPro_500Medium',
                        fontSize: TYPE.label,
                      }}
                    >
                      {t(g.labelKey)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={labelStyle}>{t('studentRecordNote')}</Text>
            <TextInput
              value={draft.teacherNote}
              onChangeText={v => set('teacherNote', v)}
              placeholder={t('studentNotePlaceholder')}
              placeholderTextColor={colors.mutedForeground}
              multiline
              style={[...inputStyle, styles.note]}
              accessibilityLabel={t('studentRecordNote')}
            />

            {error ? (
              <Text style={[styles.hint, { color: colors.destructive, fontFamily: 'Almarai_400Regular', textAlign: align }]}>
                {error}
              </Text>
            ) : null}

            <View style={styles.actions}>
              <Pressable onPress={onClose} style={styles.btn}>
                <Text style={{ color: colors.mutedForeground, fontFamily: 'ReadexPro_600SemiBold' }}>{t('cancel')}</Text>
              </Pressable>
              <Pressable
                onPress={() => onSave(studentChanges(student, draft))}
                disabled={!canSave}
                accessibilityRole="button"
                style={[styles.btn, styles.primary, { backgroundColor: colors.primary, opacity: canSave ? 1 : 0.5 }]}
              >
                {saving ? (
                  <ActivityIndicator color={colors.primaryForeground} size="small" />
                ) : (
                  <Text style={{ color: colors.primaryForeground, fontFamily: 'ReadexPro_600SemiBold' }}>
                    {t('saveChanges')}
                  </Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </KeyboardSafeView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center', padding: SPACE.xxl },
  card: { width: '100%', maxWidth: 460, borderRadius: RADIUS.lg, padding: SPACE.xl, gap: SPACE.sm },
  title: { fontSize: TYPE.bodyLg, marginBottom: SPACE.xs },
  label: { fontSize: TYPE.caption, marginTop: SPACE.sm },
  hint: { fontSize: TYPE.label, lineHeight: 22 },
  input: { borderWidth: 1, borderRadius: RADIUS.md, paddingHorizontal: SPACE.lg, paddingVertical: SPACE.md, fontSize: TYPE.body },
  note: { minHeight: 90, textAlignVertical: 'top' },
  genderRow: { flexDirection: 'row', gap: SPACE.sm },
  genderBtn: { flex: 1, alignItems: 'center', paddingVertical: SPACE.md, borderRadius: RADIUS.md, borderWidth: 1 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: SPACE.sm, marginTop: SPACE.sm },
  btn: { paddingHorizontal: SPACE.xl, paddingVertical: SPACE.md, borderRadius: RADIUS.md },
  primary: { minWidth: 120, alignItems: 'center' },
});
