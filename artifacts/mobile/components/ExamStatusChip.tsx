/**
 * The status pill on a family exam row: one word-group, coloured by meaning
 * (`EXAM_STATE_TONE`), with no icon — the icon and the pill used to say the same
 * thing twice. Shared by «نتائج أبنائي» and the school tab's upcoming exams, so
 * a state reads the same on both.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import { RADIUS, TYPE } from '@/constants/theme';
import {
  EXAM_STATE_TONE,
  MY_EXAM_STATE_KEY,
  PARENT_EXAM_STATE_KEY,
  type ExamTone,
  type MyExamState,
} from '@/services/myExams';

type Colors = ReturnType<typeof useColors>;

export function toneColor(tone: ExamTone, colors: Colors): string {
  return tone === 'muted' ? colors.mutedForeground : colors[tone];
}

export function ExamStatusChip({ state, parent }: { state: MyExamState; parent: boolean }) {
  const colors = useColors();
  const { t } = useLanguage();
  // A state a newer server adds degrades to «مُغلق» instead of a blank pill.
  const known = state in EXAM_STATE_TONE;
  const color = toneColor(known ? EXAM_STATE_TONE[state] : 'destructive', colors);
  const key = known ? (parent ? PARENT_EXAM_STATE_KEY : MY_EXAM_STATE_KEY)[state] : 'myExamsStateClosed';
  return (
    <View style={[styles.chip, { backgroundColor: color + '1A' }]}>
      <Text style={{ color, fontFamily: 'ReadexPro_600SemiBold', fontSize: TYPE.caption, lineHeight: 18 }}>{t(key)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: { borderRadius: RADIUS.pill, paddingHorizontal: 10, paddingVertical: 3 },
});
