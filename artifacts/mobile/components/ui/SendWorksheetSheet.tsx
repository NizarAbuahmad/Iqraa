/**
 * Send a worksheet to one of the teacher's classes as a digital assignment.
 *
 * Two choices — the class, and the one objective the sheet practises — then the
 * server builds a draft evaluation (`POST /evaluations/from-worksheet`) and the
 * teacher lands on the ordinary review-and-publish screen, which issues the
 * code students use. What is marked automatically is the server's call; the
 * split comes back and is shown on success, never guessed here.
 *
 * No text input, so no `KeyboardSafeView` (CLAUDE.md).
 */
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useLanguage } from '@/context/LanguageContext';
import type { WorksheetOutput } from '@/services/ai/AIService';
import { createEvaluationFromWorksheet, EvaluationError } from '@/services/evaluations';
import { listClasses, type ClassGroup } from '@/services/roster';
import { classesForSend, lessonObjectivesForSend, worksheetSendPayload } from '@/services/worksheetAssignment';

type Props = {
  visible: boolean;
  worksheet: WorksheetOutput;
  /** The KB lesson the sheet was made for; without one there is nothing to file it under. */
  lessonId?: string;
  language: 'ar' | 'en';
  accent: string;
  colors: { card: string; border: string; muted: string; foreground: string; mutedForeground: string; destructive?: string };
  onClose: () => void;
  onSent: (evaluationId: string, autoMarked: number, teacherMarked: number) => void;
};

export function SendWorksheetSheet({ visible, worksheet, lessonId, language, accent, colors, onClose, onSent }: Props) {
  const { t, isRTL } = useLanguage();
  const align = isRTL ? 'right' : 'left';
  const row: 'row' | 'row-reverse' = isRTL ? 'row-reverse' : 'row';

  const [classes, setClasses] = useState<ClassGroup[] | null>(null);
  const [classId, setClassId] = useState<string | null>(null);
  const objectives = useMemo(() => lessonObjectivesForSend(lessonId), [lessonId]);
  const [objectiveId, setObjectiveId] = useState<string | null>(null);
  // The lesson's own grade and subject, from the curriculum — not from pickers
  // that may have moved since the sheet was made.
  const gradeId = objectives[0]?.gradeId ?? '';
  const subjectId = objectives[0]?.subjectId ?? '';
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!visible) return;
    setError('');
    setObjectiveId(objectives.length === 1 ? objectives[0]!.id : null);
    let alive = true;
    listClasses()
      .then(list => {
        if (!alive) return;
        const ordered = classesForSend(list, gradeId, subjectId);
        setClasses(ordered);
        setClassId(ordered.length === 1 ? ordered[0]!.id : null);
      })
      .catch(() => { if (alive) { setClasses([]); setError(t('sendToClassLoadFailed')); } });
    return () => { alive = false; };
  }, [visible, gradeId, subjectId, objectives, t]);

  const send = async () => {
    if (!classId || !objectiveId || sending) return;
    setSending(true);
    setError('');
    try {
      const out = await createEvaluationFromWorksheet({
        worksheet: worksheetSendPayload(worksheet),
        objectiveId,
        classGroupId: classId,
        language,
      });
      onSent(out.evaluation.id, out.autoMarked, out.teacherMarked);
    } catch (err) {
      if (err instanceof EvaluationError && err.code === 'missing_key') setError(t('sendToClassMissingKey', err.details.join('، ')));
      else if (err instanceof EvaluationError && err.code === 'no_level_scale') setError(t('evaluationSetupNotReady'));
      else setError(t('sendToClassFailed'));
    } finally {
      setSending(false);
    }
  };

  const choice = (on: boolean) => [styles.choice, { borderColor: on ? accent : colors.border, borderWidth: on ? 2 : 1, flexDirection: row }];

  return (
    <Modal transparent visible={visible} animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <View style={[styles.sheet, { backgroundColor: colors.card, borderTopColor: colors.border }]} onStartShouldSetResponder={() => true}>
          <View style={[styles.handle, { backgroundColor: colors.border }]} />
          <Text style={[styles.title, { color: colors.foreground, fontFamily: 'ReadexPro_600SemiBold', textAlign: align }]}>{t('sendToClassTitle')}</Text>
          <ScrollView contentContainerStyle={{ gap: 8, paddingBottom: 8 }}>
            {!lessonId || objectives.length === 0 ? (
              <Text style={[styles.note, { color: colors.mutedForeground, textAlign: align }]}>{t('sendToClassNoLesson')}</Text>
            ) : (
              <>
                <Text style={[styles.label, { color: colors.mutedForeground, textAlign: align }]}>{t('sendToClassClass')}</Text>
                {classes === null ? <ActivityIndicator color={accent} /> : classes.length === 0 ? (
                  <Text style={[styles.note, { color: colors.mutedForeground, textAlign: align }]}>{t('sendToClassNoClasses')}</Text>
                ) : classes.map(c => (
                  <Pressable key={c.id} accessibilityRole="button" aria-selected={classId === c.id} onPress={() => setClassId(c.id)} style={choice(classId === c.id)}>
                    <Ionicons name={classId === c.id ? 'radio-button-on' : 'radio-button-off'} size={18} color={classId === c.id ? accent : colors.mutedForeground} />
                    <Text style={[styles.choiceText, { color: colors.foreground, textAlign: align }]}>{(isRTL ? c.nameAr : c.name) || c.name || c.nameAr}</Text>
                  </Pressable>
                ))}

                <Text style={[styles.label, { color: colors.mutedForeground, textAlign: align }]}>{t('sendToClassObjective')}</Text>
                {objectives.map(o => (
                  <Pressable key={o.id} accessibilityRole="button" aria-selected={objectiveId === o.id} onPress={() => setObjectiveId(o.id)} style={choice(objectiveId === o.id)}>
                    <Ionicons name={objectiveId === o.id ? 'radio-button-on' : 'radio-button-off'} size={18} color={objectiveId === o.id ? accent : colors.mutedForeground} />
                    <Text style={[styles.choiceText, { color: colors.foreground, textAlign: align }]}>{(isRTL ? o.descriptionAr : o.description) || o.descriptionAr || o.description}</Text>
                  </Pressable>
                ))}

                {worksheet.workedExample ? (
                  <Text style={[styles.note, { color: colors.mutedForeground, textAlign: align }]}>{t('sendToClassWorkedExampleNote')}</Text>
                ) : null}
              </>
            )}
            {error ? <Text style={[styles.note, { color: colors.destructive ?? '#B42318', textAlign: align }]}>{error}</Text> : null}
          </ScrollView>

          <Pressable
            accessibilityRole="button"
            disabled={!classId || !objectiveId || sending}
            onPress={() => { void send(); }}
            style={[styles.send, { backgroundColor: accent, opacity: !classId || !objectiveId || sending ? 0.5 : 1 }]}
          >
            {sending ? <ActivityIndicator color="#fff" /> : <Text style={[styles.sendText, { fontFamily: 'ReadexPro_600SemiBold' }]}>{t('sendToClassSend')}</Text>}
          </Pressable>
          <Pressable onPress={onClose} style={[styles.cancel, { backgroundColor: colors.muted }]}>
            <Text style={[styles.sendText, { color: colors.foreground, fontFamily: 'ReadexPro_500Medium' }]}>{t('cancel')}</Text>
          </Pressable>
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: { maxHeight: '88%', borderTopLeftRadius: 24, borderTopRightRadius: 24, borderTopWidth: 1, padding: 20, paddingBottom: 32 },
  handle: { width: 40, height: 4, borderRadius: 4, alignSelf: 'center', marginBottom: 16 },
  title: { fontSize: 17, marginBottom: 12 },
  label: { fontSize: 13, fontFamily: 'ReadexPro_500Medium', marginTop: 8 },
  note: { fontSize: 13, lineHeight: 20, fontFamily: 'Almarai_400Regular' },
  choice: { alignItems: 'center', gap: 8, padding: 12, borderRadius: 12 },
  choiceText: { flex: 1, fontSize: 14, lineHeight: 20, fontFamily: 'Almarai_400Regular' },
  send: { marginTop: 12, padding: 12, alignItems: 'center', borderRadius: 12 },
  sendText: { fontSize: 15, color: '#fff' },
  cancel: { marginTop: 8, padding: 12, alignItems: 'center', borderRadius: 12 },
});
