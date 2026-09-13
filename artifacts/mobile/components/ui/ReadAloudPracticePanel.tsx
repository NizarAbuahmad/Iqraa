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
import { practicePassagesForLesson, type PracticePassage } from '@workspace/curriculum/practice';
import { getExternalResource } from '@workspace/curriculum';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import { useReadAloudRecorder } from '@/hooks/useReadAloudRecorder';
import { blobToDataUrl, formatDuration } from '@/services/readAloudRecorder';
import { scorePracticeReadAloud, type PracticeResult } from '@/services/practiceReadAloud';

/** Where a reading stops being worth repeating and starts being worth moving on from. */
const GOOD_ENOUGH = 0.9;

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
});
