/**
 * TopicSelector
 *
 * Replaces the free-text topic <TextInput> on the three AI-tool screens.
 *
 * • When the KB has content for the chosen subject + grade, it shows a
 *   two-level cascade:
 *     1. Unit picker  (first option = "Entire Book")
 *     2. Lesson picker (first option = "Entire Unit", shown once a unit is picked)
 * • When there is no KB content it falls back to a plain TextInput.
 */
import React, { useEffect, useState } from 'react';
import {
  Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  KB_BOOKS, KB_UNITS,
  getLessonsForUnit, getUnitsForSubjectGrade, hasKBContent,
} from '@/services/knowledgeBase';

const ENTIRE_BOOK = '__entire_book__';
const ENTIRE_UNIT = '__entire_unit__';

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

  // Derive the topic string whenever selections change
  useEffect(() => {
    if (!kbAvailable) return;
    if (!selectedUnitId) { onChange(''); return; }

    if (selectedUnitId === ENTIRE_BOOK) {
      onChange(t('entireBook'));
      return;
    }

    const unit = units.find(u => u.id === selectedUnitId);
    if (!unit) return;

    if (!selectedLessonId || selectedLessonId === ENTIRE_UNIT) {
      onChange(lang === 'ar' ? unit.titleAr : unit.titleEn);
      return;
    }

    const lesson = lessons.find(l => l.id === selectedLessonId);
    if (lesson) {
      const unitLabel = lang === 'ar' ? unit.titleAr : unit.titleEn;
      const lessonLabel = lang === 'ar' ? lesson.titleAr : lesson.titleEn;
      onChange(`${unitLabel} – ${lessonLabel}`);
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
  const unitDisplayValue = selectedUnitId === ENTIRE_BOOK
    ? t('entireBook')
    : selectedUnitId
      ? (units.find(u => u.id === selectedUnitId)?.[lang === 'ar' ? 'titleAr' : 'titleEn'] ?? '')
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
          <ScrollView nestedScrollEnabled style={{ maxHeight: 230 }}>
            <DropdownItem
              label={`📚  ${t('entireBook')}`}
              selected={selectedUnitId === ENTIRE_BOOK}
              onPress={() => handleUnitSelect(ENTIRE_BOOK)}
              accent={accent} colors={colors} isRTL={isRTL}
            />
            {units.map(unit => (
              <DropdownItem
                key={unit.id}
                label={lang === 'ar' ? unit.titleAr : unit.titleEn}
                selected={selectedUnitId === unit.id}
                onPress={() => handleUnitSelect(unit.id)}
                accent={accent} colors={colors} isRTL={isRTL}
              />
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
