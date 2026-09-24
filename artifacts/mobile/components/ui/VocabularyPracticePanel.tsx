/**
 * Practise this lesson's words, from the book's own Word List.
 *
 * The second student-facing thing on the lesson page, and the first that works
 * on every English lesson rather than six: 730 words across 72 lessons, against
 * the three passages read-aloud practice has.
 *
 * Nothing is recorded. No attempt row, no mark, no server — the whole drill is
 * graded by `isDrillAnswerCorrect`, which is an index comparison. That is what
 * lets it ship over the air while `POST /practice/read-aloud` waits on a
 * deploy, and it is honest: a drill with no mark has no result to protect.
 *
 * Renders nothing when the lesson has fewer than four words, so it is inert on
 * every non-English lesson in the catalog rather than empty.
 */
import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import {
  drillsForLesson,
  isDrillAnswerCorrect,
  wordListForLesson,
  type VocabularyDrill,
} from '@/services/vocabularyDrill';

const RIGHT = '#15803D';
const WRONG = '#B91C1C';

function DrillCard({ drill, accent }: { drill: VocabularyDrill; accent: string }) {
  const colors = useColors();
  const { t, isRTL } = useLanguage();
  const [picked, setPicked] = useState<number | null>(null);
  const correct = picked !== null && isDrillAnswerCorrect(drill, picked);

  return (
    <View style={[styles.card, { borderColor: colors.border, backgroundColor: colors.card }]}>
      <Text style={[styles.kind, { color: colors.mutedForeground, textAlign: isRTL ? 'right' : 'left' }]}>
        {t(drill.kind === 'gap_fill' ? 'vocabGapFill' : 'vocabPartOfSpeech')}
        {drill.page ? ` · ${t('qrOnPage', String(drill.page))}` : ''}
      </Text>

      {/* The sentence is English and stays LTR inside an RTL screen — an English
          sentence laid out right-to-left is not a styling nitpick, it is the
          thing the student is being asked to read. */}
      <Text style={[styles.prompt, { color: colors.foreground }]}>{drill.prompt}</Text>

      <View style={{ gap: 8 }}>
        {drill.options.map((option, i) => {
          const isAnswer = i === drill.answerIndex;
          const chosen = picked === i;
          // Once answered, the right option is always marked — a student who
          // picked wrong has to be shown which one was right, or the drill
          // teaches only that they were wrong.
          const border = picked === null ? colors.border : isAnswer ? RIGHT : chosen ? WRONG : colors.border;
          return (
            <Pressable
              key={option}
              onPress={() => setPicked(i)}
              disabled={picked !== null}
              style={[styles.option, { borderColor: border, backgroundColor: colors.background }]}
            >
              <Text style={{ color: colors.foreground, fontSize: 15, flex: 1, textAlign: 'left' }}>
                {option}
              </Text>
              {picked !== null && isAnswer ? (
                <Ionicons name="checkmark-circle" size={18} color={RIGHT} />
              ) : null}
              {picked !== null && chosen && !isAnswer ? (
                <Ionicons name="close-circle" size={18} color={WRONG} />
              ) : null}
            </Pressable>
          );
        })}
      </View>

      {picked !== null ? (
        <View style={[styles.result, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
          <Text style={{ color: correct ? RIGHT : WRONG, fontFamily: 'Cairo_600SemiBold', fontSize: 14 }}>
            {t(correct ? 'vocabRight' : 'vocabWrong')}
          </Text>
          {/* The pronunciation is the part of the Word List a student cannot get
              from the sentence, so it is shown once the answer is settled. */}
          <Text style={{ color: colors.mutedForeground, fontSize: 13 }}>{drill.ipa}</Text>
          <Pressable onPress={() => setPicked(null)} style={{ marginInlineStart: 'auto' }}>
            <Text style={{ color: accent, fontFamily: 'Cairo_600SemiBold', fontSize: 13 }}>
              {t('practiceTryAgain')}
            </Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

export function VocabularyPracticePanel({ lessonId, accent }: { lessonId: string; accent: string }) {
  const colors = useColors();
  const { t, isRTL } = useLanguage();
  const drills = useMemo(() => drillsForLesson(lessonId), [lessonId]);
  const words = useMemo(() => wordListForLesson(lessonId), [lessonId]);
  const [showList, setShowList] = useState(false);

  if (drills.length === 0) return null;

  return (
    <View style={styles.section}>
      <View style={[styles.header, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
        <Ionicons name="book-outline" size={16} color={accent} />
        <Text style={[styles.title, { color: colors.foreground, fontFamily: 'Cairo_600SemiBold' }]}>
          {t('vocabTitle')}
        </Text>
        <View style={[styles.countPill, { backgroundColor: accent + '15' }]}>
          <Text style={[styles.countText, { color: accent, fontFamily: 'Cairo_600SemiBold' }]}>
            {t('vocabWordCount', words.length)}
          </Text>
        </View>
      </View>
      <Text style={[styles.intro, { color: colors.mutedForeground, textAlign: isRTL ? 'right' : 'left' }]}>
        {t('vocabIntro')}
      </Text>

      <View style={{ paddingHorizontal: 20, gap: 12 }}>
        {drills.map(d => <DrillCard key={`${d.kind}-${d.word}`} drill={d} accent={accent} />)}

        {/* The whole list, because a drill is practice and a list is reference,
            and a student revising before a test wants the second one. */}
        <Pressable
          onPress={() => setShowList(v => !v)}
          style={[styles.listToggle, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}
        >
          <Ionicons
            name={showList ? 'chevron-down' : isRTL ? 'chevron-back' : 'chevron-forward'}
            size={14}
            color={colors.mutedForeground}
          />
          <Text style={{ color: colors.mutedForeground, fontFamily: 'Cairo_500Medium', fontSize: 13 }}>
            {t(showList ? 'vocabHideList' : 'vocabShowList')}
          </Text>
        </Pressable>
        {showList ? (
          <View style={[styles.list, { borderColor: colors.border, backgroundColor: colors.card }]}>
            {words.map(w => (
              <View key={w.word} style={styles.listRow}>
                <Text style={{ color: colors.foreground, fontSize: 14, flex: 1, textAlign: 'left' }}>
                  {w.word}
                  {w.pos ? <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>{`  (${w.pos})`}</Text> : null}
                </Text>
                <Text style={{ color: colors.mutedForeground, fontSize: 12.5 }}>{w.ipa}</Text>
              </View>
            ))}
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: 18, gap: 8 },
  header: { alignItems: 'center', gap: 8, paddingHorizontal: 20 },
  title: { fontSize: 15 },
  countPill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  countText: { fontSize: 11.5 },
  intro: { fontSize: 12, lineHeight: 20, paddingHorizontal: 20, fontFamily: 'Almarai_400Regular' },
  card: { borderWidth: 1, borderRadius: 14, padding: 16, gap: 12 },
  kind: { fontSize: 11, lineHeight: 18, fontFamily: 'Almarai_400Regular' },
  prompt: { fontSize: 16, lineHeight: 26, textAlign: 'left', writingDirection: 'ltr' },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  result: { alignItems: 'center', gap: 10 },
  listToggle: { alignItems: 'center', gap: 6, paddingVertical: 4 },
  list: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 6 },
  listRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
});
