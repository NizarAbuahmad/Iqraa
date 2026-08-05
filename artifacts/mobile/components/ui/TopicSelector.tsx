/**
 * TopicSelector
 *
 * Replaces the free-text topic <TextInput> on the three AI-tool screens.
 *
 * • When the KB has content for the chosen subject + grade, it shows a
 *   two-level cascade (الوحدة → الدرس):
 *     1. Unit picker  (first option = "Entire Book", then units grouped by semester)
 *     2. Lesson picker (first option = "Entire Unit", shown once a unit is picked)
 *   Topic is set only after a lesson (or entire-unit / entire-book) is chosen.
 * • When there is no KB content it falls back to a plain TextInput.
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
  Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  KB_BOOKS,
  getLessonsForUnit, getUnitsForSubjectGrade, hasKBContent,
  type KBUnit,
} from '@/services/knowledgeBase';

const ENTIRE_BOOK = '__entire_book__';
const ENTIRE_UNIT = '__entire_unit__';

type UnitSemesterGroup = {
  semester: 1 | 2;
  label: string;
  units: KBUnit[];
};

/** Group units under non-selectable semester headers (S1 then S2). */
function groupUnitsBySemester(
  units: KBUnit[],
  t: (key: any) => string,
): UnitSemesterGroup[] {
  const bookById = new Map(KB_BOOKS.map(b => [b.id, b]));
  const bySem = new Map<1 | 2, KBUnit[]>();
  for (const unit of units) {
    const sem = (bookById.get(unit.bookId)?.semester ?? 1) as 1 | 2;
    const list = bySem.get(sem) ?? [];
    list.push(unit);
    bySem.set(sem, list);
  }
  return ([1, 2] as const)
    .filter(sem => (bySem.get(sem)?.length ?? 0) > 0)
    .map(sem => ({
      semester: sem,
      label: sem === 1 ? t('semester1Short') : t('semester2Short'),
      units: bySem.get(sem)!,
    }));
}

interface Props {
  subjectId: string;
  gradeId: string;
  /** Controlled topic string – parent owns this value. */
  value: string;
  onChange: (topic: string) => void;
  lang: 'ar' | 'en';
  isRTL: boolean;
  colors: any;
  accent: string;
  hasError?: boolean;
  t: (key: any) => string;
}

export function TopicSelector({
  subjectId, gradeId, value, onChange,
  lang, isRTL, colors, accent, hasError, t,
}: Props) {
  const units = getUnitsForSubjectGrade(subjectId, gradeId);
  const kbAvailable = hasKBContent(subjectId, gradeId);
  const unitGroups = useMemo(() => groupUnitsBySemester(units, t), [units, t]);

  // Runtime proof for /ai-tools/* topic dropdown (reads KB, not curriculumData).
  useEffect(() => {
    const s1 = units.filter(u => u.bookId === 'kb-math-10-s1');
    const u1 = s1.find(u => u.id === 'kbu-math-s1-nccd-u1');
    const u1Lessons = u1 ? getLessonsForUnit(u1.id).map(l => l.titleAr) : [];
    // eslint-disable-next-line no-console
    console.log('[TopicSelector-PROOF]', {
      subjectId,
      gradeId,
      source: 'knowledgeBase.getUnitsForSubjectGrade / getLessonsForUnit',
      unitTitles: units.map(u => `${u.bookId}:${u.titleAr}`),
      s1UnitTitles: s1.map(u => u.titleAr),
      u1Title: u1?.titleAr ?? null,
      u1Lessons,
      hasLegacyEquations: units.some(u => u.id === 'kbu-math-s2-1' || u.titleAr === 'المعادلات'),
    });
  }, [subjectId, gradeId, units]);

  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null);
  const [selectedLessonId, setSelectedLessonId] = useState<string | null>(null);
  const [unitOpen, setUnitOpen] = useState(false);
  const [lessonOpen, setLessonOpen] = useState(false);

  const lessons = selectedUnitId && selectedUnitId !== ENTIRE_BOOK
    ? getLessonsForUnit(selectedUnitId)
    : [];

  // Reset selections when subject/grade changes
  useEffect(() => {
    setSelectedUnitId(null);
    setSelectedLessonId(null);
    onChange('');
  }, [subjectId, gradeId]);

  // Derive the topic string whenever selections change.
  // Require a lesson (or entire-unit / entire-book) before setting topic —
  // unit-only selection used to set the unit title (e.g. wrong "المعادلات").
  useEffect(() => {
    if (!kbAvailable) return;
    if (!selectedUnitId) { onChange(''); return; }

    if (selectedUnitId === ENTIRE_BOOK) {
      onChange(t('entireBook'));
      return;
    }

    const unit = units.find(u => u.id === selectedUnitId);
    if (!unit) return;

    // Unit chosen but no lesson yet → wait for lesson picker
    if (!selectedLessonId) {
      onChange('');
      return;
    }

    if (selectedLessonId === ENTIRE_UNIT) {
      onChange(lang === 'ar' ? unit.titleAr : unit.titleEn);
      return;
    }

    const lesson = lessons.find(l => l.id === selectedLessonId);
    if (lesson) {
      // Lesson title alone for precise KB / NCCD matching
      onChange(lang === 'ar' ? lesson.titleAr : lesson.titleEn);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedUnitId, selectedLessonId, lang]);

  const handleUnitSelect = (id: string) => {
    setSelectedUnitId(id);
    setSelectedLessonId(null);
    setUnitOpen(false);
  };

  // ── Fallback: no KB for this subject/grade ───────────────────────────────
  if (!kbAvailable) {
    return (
      <View style={{ marginBottom: 16 }}>
        <Text style={[s.label, { color: colors.foreground, fontFamily: 'Inter_500Medium', textAlign: isRTL ? 'right' : 'left' }]}>
          {t('topicLabel')}
        </Text>
        <View style={[s.inputBox, {
          backgroundColor: colors.card,
          borderColor: hasError && !value ? colors.destructive : colors.border,
          borderRadius: colors.radius,
        }]}>
          <TextInput
            style={[s.textInput, { color: colors.foreground, fontFamily: 'Inter_400Regular', textAlign: isRTL ? 'right' : 'left' }]}
            placeholder={t('topicPlaceholder')}
            placeholderTextColor={colors.mutedForeground}
            value={value}
            onChangeText={onChange}
            multiline
          />
        </View>
      </View>
    );
  }

  // ── KB cascade ────────────────────────────────────────────────────────────
  const selectedUnit = selectedUnitId && selectedUnitId !== ENTIRE_BOOK
    ? units.find(u => u.id === selectedUnitId)
    : undefined;
  const selectedSemesterLabel = selectedUnit
    ? unitGroups.find(g => g.units.some(u => u.id === selectedUnit.id))?.label
    : null;

  const unitTitle = selectedUnit
    ? (lang === 'ar' ? selectedUnit.titleAr : selectedUnit.titleEn)
    : '';
  const unitDisplayValue = selectedUnitId === ENTIRE_BOOK
    ? t('entireBook')
    : selectedUnit
      ? (selectedSemesterLabel ? `${selectedSemesterLabel} · ${unitTitle}` : unitTitle)
      : '';

  const lessonDisplayValue = selectedLessonId === ENTIRE_UNIT
    ? t('entireUnit')
    : selectedLessonId
      ? (lessons.find(l => l.id === selectedLessonId)?.[lang === 'ar' ? 'titleAr' : 'titleEn'] ?? '')
      : '';

  const unitBorderColor = hasError && !selectedUnitId
    ? colors.destructive
    : unitOpen ? accent : colors.border;

  return (
    <View style={{ marginBottom: 8 }}>
      {/* ── Unit picker ─────────────────────────── */}
      <Text style={[s.label, { color: colors.foreground, fontFamily: 'Inter_500Medium', textAlign: isRTL ? 'right' : 'left' }]}>
        {t('topicLabel')}
      </Text>
      <Pressable
        onPress={() => { setUnitOpen(o => !o); setLessonOpen(false); }}
        style={[s.pickerBtn, {
          backgroundColor: colors.card,
          borderColor: unitBorderColor,
          borderRadius: colors.radius,
          flexDirection: isRTL ? 'row-reverse' : 'row',
        }]}
      >
        <Text style={[s.pickerText, {
          color: unitDisplayValue ? colors.foreground : colors.mutedForeground,
          fontFamily: 'Inter_400Regular',
          textAlign: isRTL ? 'right' : 'left',
        }]}>
          {unitDisplayValue || t('selectUnit')}
        </Text>
        <Ionicons name={unitOpen ? 'chevron-up' : 'chevron-down'} size={16} color={colors.mutedForeground} />
      </Pressable>

      {unitOpen && (
        <View style={[s.dropdown, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
          <ScrollView nestedScrollEnabled style={{ maxHeight: 280 }}>
            <DropdownItem
              label={`📚  ${t('entireBook')}`}
              selected={selectedUnitId === ENTIRE_BOOK}
              onPress={() => handleUnitSelect(ENTIRE_BOOK)}
              accent={accent} colors={colors} isRTL={isRTL}
            />
            {unitGroups.map(group => (
              <View key={`sem-${group.semester}`}>
                <SemesterSectionHeader
                  label={group.label}
                  colors={colors}
                  isRTL={isRTL}
                />
                {group.units.map(unit => (
                  <DropdownItem
                    key={unit.id}
                    label={lang === 'ar' ? unit.titleAr : unit.titleEn}
                    selected={selectedUnitId === unit.id}
                    onPress={() => handleUnitSelect(unit.id)}
                    accent={accent} colors={colors} isRTL={isRTL}
                  />
                ))}
              </View>
            ))}
          </ScrollView>
        </View>
      )}

      {/* ── Lesson picker (only when a specific unit is chosen) ─────────── */}
      {selectedUnitId && selectedUnitId !== ENTIRE_BOOK && (
        <View style={{ marginTop: 4, marginBottom: 8 }}>
          <Text style={[s.label, { color: colors.foreground, fontFamily: 'Inter_500Medium', textAlign: isRTL ? 'right' : 'left' }]}>
            {t('selectLesson')}
          </Text>
          <Pressable
            onPress={() => { setLessonOpen(o => !o); setUnitOpen(false); }}
            style={[s.pickerBtn, {
              backgroundColor: colors.card,
              borderColor: lessonOpen ? accent : colors.border,
              borderRadius: colors.radius,
              flexDirection: isRTL ? 'row-reverse' : 'row',
            }]}
          >
            <Text style={[s.pickerText, {
              color: lessonDisplayValue ? colors.foreground : colors.mutedForeground,
              fontFamily: 'Inter_400Regular',
              textAlign: isRTL ? 'right' : 'left',
            }]}>
              {lessonDisplayValue || t('selectLesson')}
            </Text>
            <Ionicons name={lessonOpen ? 'chevron-up' : 'chevron-down'} size={16} color={colors.mutedForeground} />
          </Pressable>

          {lessonOpen && (
            <View style={[s.dropdown, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
              <ScrollView nestedScrollEnabled style={{ maxHeight: 230 }}>
                <DropdownItem
                  label={`📖  ${t('entireUnit')}`}
                  selected={selectedLessonId === ENTIRE_UNIT}
                  onPress={() => { setSelectedLessonId(ENTIRE_UNIT); setLessonOpen(false); }}
                  accent={accent} colors={colors} isRTL={isRTL}
                />
                {lessons.map(lesson => (
                  <DropdownItem
                    key={lesson.id}
                    label={lang === 'ar' ? lesson.titleAr : lesson.titleEn}
                    selected={selectedLessonId === lesson.id}
                    onPress={() => { setSelectedLessonId(lesson.id); setLessonOpen(false); }}
                    accent={accent} colors={colors} isRTL={isRTL}
                  />
                ))}
              </ScrollView>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

// ── Internal helpers ───────────────────────────────────────────────────────────

function SemesterSectionHeader({ label, colors, isRTL }: {
  label: string; colors: any; isRTL: boolean;
}) {
  return (
    <View
      style={{
        paddingHorizontal: 14,
        paddingTop: 10,
        paddingBottom: 6,
        backgroundColor: colors.muted,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
      }}
      accessibilityRole="header"
    >
      <Text style={{
        color: colors.mutedForeground,
        fontFamily: 'Inter_600SemiBold',
        fontSize: 12,
        textAlign: isRTL ? 'right' : 'left',
      }}>
        {label}
      </Text>
    </View>
  );
}

function DropdownItem({ label, selected, onPress, accent, colors, isRTL }: {
  label: string; selected: boolean; onPress: () => void;
  accent: string; colors: any; isRTL: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[{
        paddingHorizontal: 14, paddingVertical: 12,
        borderBottomWidth: 1, borderBottomColor: colors.border,
        backgroundColor: selected ? accent + '18' : 'transparent',
        flexDirection: isRTL ? 'row-reverse' : 'row',
        alignItems: 'center', justifyContent: 'space-between',
      }]}
    >
      <Text style={[{
        flex: 1,
        color: selected ? accent : colors.foreground,
        fontFamily: selected ? 'Inter_500Medium' : 'Inter_400Regular',
        fontSize: 14,
        textAlign: isRTL ? 'right' : 'left',
      }]}>
        {label}
      </Text>
      {selected && <Ionicons name="checkmark" size={16} color={accent} />}
    </Pressable>
  );
}

const s = StyleSheet.create({
  label:      { fontSize: 13, marginBottom: 6 },
  inputBox:   { borderWidth: 1.5, padding: 14, marginBottom: 16 },
  textInput:  { fontSize: 15, padding: 0, minHeight: 44 },
  pickerBtn:  { alignItems: 'center', borderWidth: 1.5, paddingHorizontal: 14, paddingVertical: 13, marginBottom: 8 },
  pickerText: { flex: 1, fontSize: 15 },
  dropdown:   { borderWidth: 1, marginBottom: 12, overflow: 'hidden' },
});
