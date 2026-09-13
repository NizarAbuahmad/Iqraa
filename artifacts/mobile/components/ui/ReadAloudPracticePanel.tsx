/**
 * Practise reading a passage aloud, on the lesson it belongs to.
 *
 * The counterpart to the exam version in `QuestionInputs.tsx`, and deliberately
 * unlike it: retry as often as you want, see the score straight away, and
 * nothing is recorded anywhere. Same recorder, same scoring, no marks.
 *
 * **This is the one student-facing thing on this page.** `/curriculum` is on the
 * non-teacher allowlist, so a student can reach a lesson — but there is no
 * student home screen and nothing here was ever for them. Which is also why the
 * page's teacher actions are now role-gated: shipping this next to a button
 * that hands students an invented lesson plan would have been half a job.
 *
 * Web only for now. The microphone needs `expo-audio` and a store release, and
 * the fingerprint runtime version means that cannot arrive over the air —
 * so native says so rather than offering a control that fails on tap.
 */
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  isPracticeAnswerCorrect,
  practicePassagesForLesson,
  practiceQuestionsForResource,
  type PracticePassage,
  type PracticeQuestion,
} from '@workspace/curriculum/practice';
import { getExternalResource } from '@workspace/curriculum';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import { useReadAloudRecorder } from '@/hooks/useReadAloudRecorder';
import { blobToDataUrl, formatDuration } from '@/services/readAloudRecorder';
import { scorePracticeReadAloud, type PracticeResult } from '@/services/practiceReadAloud';

/** Where a reading stops being worth repeating and starts being worth moving on from. */
const GOOD_ENOUGH = 0.9;

const RIGHT = '#15803D';
const WRONG = '#B91C1C';

/**
 * Did you understand what you just read?
 *
 * Graded in the browser, which is a deliberate departure from every other
 * question in this product. Marks are graded server-side because a client that
 * decides its own score decides its own mark — but practice records nothing, so
 * there is no mark here to protect, and for these two kinds the check is an
 * equality test that a round trip would not make more correct. It also has to
 * be this way to work at all right now: the API revision serving production
 * predates `/practice/read-aloud`, which is why the recorder above renders and
 * cannot score. A drill graded here ships over the air with everything else.
 *
 * Answer revealed as soon as one is picked, and changeable. This is the read
 * you just did out loud, not a test — being told immediately is the whole value,
 * and there is nothing to invigilate.
 */
function PassageQuestions({ questions }: { questions: readonly PracticeQuestion[] }) {
  const colors = useColors();
  const { t, isRTL } = useLanguage();
  const [picked, setPicked] = useState<Record<number, number | boolean>>({});

  if (questions.length === 0) return null;

  const answered = Object.keys(picked).length;
  const right = questions.filter((q, i) => i in picked && isPracticeAnswerCorrect(q, picked[i])).length;

  return (
    <View style={{ gap: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, paddingTop: 14 }}>
      <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 8 }}>
        <Ionicons name="help-circle-outline" size={16} color={ACCENT} />
        <Text style={{ color: colors.foreground, fontFamily: 'Cairo_600SemiBold', fontSize: 14, flex: 1, textAlign: isRTL ? 'right' : 'left' }}>
          {t('practiceQuestionsTitle')}
        </Text>
        {answered > 0 ? (
          <Text style={{ color: colors.mutedForeground, fontFamily: 'Cairo_600SemiBold', fontSize: 12 }}>
            {t('practiceQuestionsScore', String(right), String(questions.length))}
          </Text>
        ) : null}
      </View>

      {questions.map((q, qi) => {
        const choice = picked[qi];
        const done = qi in picked;
        // The stem and the options are the passage's own language, so they are
        // LTR whatever the screen direction — same reason as the passage above.
        const choices: { key: string; label: string; value: number | boolean }[] =
          q.kind === 'true_false'
            ? [
                { key: 'true', label: t('practiceTrue'), value: true },
                { key: 'false', label: t('practiceFalse'), value: false },
              ]
            : (q.options ?? []).map((o, oi) => ({ key: String(oi), label: o, value: oi }));

        return (
          <View key={qi} style={{ gap: 6 }}>
            <Text style={{ color: colors.foreground, fontSize: 14, lineHeight: 22, textAlign: 'left', writingDirection: 'ltr' }}>
              {q.stem}
            </Text>
            <View style={{ gap: 6 }}>
              {choices.map(c => {
                const isPicked = done && choice === c.value;
                const isAnswer = isPracticeAnswerCorrect(q, c.value);
                // Once answered, the right option is marked whether or not it
                // was the one picked — being shown the answer is the point.
                const border = !done ? colors.border : isAnswer ? RIGHT : isPicked ? WRONG : colors.border;
                return (
                  <Pressable
                    key={c.key}
                    onPress={() => setPicked(p => ({ ...p, [qi]: c.value }))}
                    style={[
                      styles.choice,
                      { borderColor: border, backgroundColor: isPicked ? border + '12' : 'transparent' },
                    ]}
                  >
                    {done && (isAnswer || isPicked) ? (
                      <Ionicons
                        name={isAnswer ? 'checkmark-circle' : 'close-circle'}
                        size={15}
                        color={isAnswer ? RIGHT : WRONG}
                      />
                    ) : (
                      <View style={[styles.choiceDot, { borderColor: colors.border }]} />
                    )}
                    <Text style={{ color: colors.foreground, fontSize: 13.5, flex: 1, textAlign: 'left', writingDirection: 'ltr' }}>
                      {c.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        );
      })}
    </View>
  );
}

function PassageCard({ passage }: { passage: PracticePassage }) {
  const colors = useColors();
  const { t, isRTL } = useLanguage();
  const align = isRTL ? 'right' : 'left';
  const resource = getExternalResource(passage.resourceId);

  const [result, setResult] = useState<PracticeResult | null>(null);
  // Kept so a student can hear themselves back. This is also the whole reason
  // the server can get away with storing nothing: the useful part of a
  // recording lives here, in the browser, for as long as the page is open.
  const [playbackUrl, setPlaybackUrl] = useState<string | null>(null);

  const recorder = useReadAloudRecorder({
    micErrorMessage: t('readAloudNoMic'),
    failureMessage: t('practiceFailed'),
    onRecorded: async (audio, durationMs) => {
      setPlaybackUrl(prev => {
        // Release the previous object URL before replacing it; a student
        // retrying ten times would otherwise leak ten blobs.
        if (prev) URL.revokeObjectURL(prev);
        return URL.createObjectURL(audio);
      });
      const dataUrl = await blobToDataUrl(audio);
      setResult(await scorePracticeReadAloud(passage.resourceId, dataUrl, durationMs));
    },
  });
  const { phase, elapsedMs, error, supported } = recorder;

  const pct = result ? Math.round(result.accuracy * 100) : null;

  return (
    <View style={[styles.card, { borderColor: colors.border, backgroundColor: colors.card }]}>
      {/* LTR and left-aligned whatever the screen direction: this is English,
          and it is the thing being read out loud. */}
      <Text
        style={{
          color: colors.foreground,
          fontSize: 17,
          lineHeight: 30,
          textAlign: 'left',
          writingDirection: 'ltr',
        }}
      >
        {passage.passage}
      </Text>

      {!!resource?.attribution && (
        <Text style={[styles.credit, { color: colors.mutedForeground, textAlign: align }]}>
          {resource.attribution}
        </Text>
      )}

      {!supported ? (
        <Text style={[styles.note, { color: colors.mutedForeground, textAlign: align }]}>
          {t('readAloudWebOnly')}
        </Text>
      ) : (
        <Pressable
          onPress={recorder.toggle}
          disabled={phase === 'working'}
          style={[
            styles.recordBtn,
            {
              backgroundColor: phase === 'recording' ? '#C2410C' : ACCENT,
              opacity: phase === 'working' ? 0.6 : 1,
            },
          ]}
        >
          <Ionicons
            name={phase === 'recording' ? 'stop' : phase === 'working' ? 'hourglass' : 'mic'}
            size={20}
            color="#fff"
          />
          <Text style={{ color: '#fff', fontFamily: 'Cairo_600SemiBold', fontSize: 15 }}>
            {phase === 'recording'
              ? t('readAloudStop', formatDuration(elapsedMs))
              : phase === 'working'
                ? t('practiceScoring')
                : result
                  ? t('practiceTryAgain')
                  : t('readAloudStart')}
          </Text>
        </Pressable>
      )}

      {!!error && <Text style={{ color: '#B91C1C', fontSize: 13 }}>{error}</Text>}

      {/* Hearing it back is the part that actually teaches. Rendered as a real
          audio element on web; RN's Image-style API has no player. */}
      {!!playbackUrl && React.createElement('audio', { src: playbackUrl, controls: true, style: { width: '100%' } })}

      {result && pct !== null && (
        <View style={{ gap: 4 }}>
          <Text
            style={{
              color: pct >= GOOD_ENOUGH * 100 ? '#15803D' : colors.foreground,
              fontFamily: 'Cairo_600SemiBold',
              fontSize: 16,
              textAlign: align,
            }}
          >
            {t('practiceScore', String(pct))}
          </Text>
          <Text style={[styles.note, { color: colors.mutedForeground, textAlign: align }]}>
            {t('practiceWordsMatched', String(result.referenceWords - result.errors), String(result.referenceWords))}
          </Text>
          {/* What the microphone actually heard. The single most useful thing
              when a score looks wrong — it is usually the audio, not the
              reading, and this is what lets a student tell the difference. */}
          <Text style={[styles.note, { color: colors.mutedForeground, textAlign: 'left', writingDirection: 'ltr' }]}>
            {t('readAloudHeard')} {result.transcript}
          </Text>
        </View>
      )}

      {/* Comprehension, in the same card as the passage it asks about. Reading
          aloud and understanding are one activity; splitting them into two
          panels would let a student do the first and never see the second.
          Works today, unlike the recorder above — no server, so no deploy. */}
      <PassageQuestions questions={practiceQuestionsForResource(passage.resourceId)} />
    </View>
  );
}

const ACCENT = '#1B6B62';

export function ReadAloudPracticePanel({ lessonId, accent }: { lessonId: string; accent: string }) {
  const colors = useColors();
  const { t, isRTL } = useLanguage();
  const passages = practicePassagesForLesson(lessonId);
  if (passages.length === 0) return null;

  return (
    <View style={styles.section}>
      <View style={[styles.header, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
        <Ionicons name="mic-outline" size={16} color={accent} />
        <Text style={[styles.title, { color: colors.foreground, fontFamily: 'Cairo_600SemiBold' }]}>
          {t('practiceTitle')}
        </Text>
      </View>
      <Text
        style={[styles.note, { color: colors.mutedForeground, paddingHorizontal: 20, textAlign: isRTL ? 'right' : 'left' }]}
      >
        {t('practiceIntro')}
      </Text>
      <View style={{ paddingHorizontal: 20, gap: 14 }}>
        {passages.map(p => <PassageCard key={p.resourceId} passage={p} />)}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: 18, gap: 8 },
  header: { alignItems: 'center', gap: 8, paddingHorizontal: 20 },
  title: { fontSize: 15 },
  card: { borderWidth: 1, borderRadius: 14, padding: 16, gap: 12 },
  credit: { fontSize: 11, lineHeight: 18 },
  note: { fontSize: 12, lineHeight: 20, fontFamily: 'Almarai_400Regular' },
  recordBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderRadius: 12,
    paddingVertical: 14,
  },
  choice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 11,
    paddingVertical: 9,
  },
  choiceDot: { width: 13, height: 13, borderRadius: 7, borderWidth: 1.5 },
});
