/**
 * The two question types whose answer is a structure rather than a single value.
 *
 * Shared because both screens that collect an answer — the student sitting the
 * exam and the teacher transcribing a paper one — have to produce the exact
 * shape `questionTypes.ts` grades: `{pairs}` of ids for matching, a dense
 * `{blanks}` array for fill-blank. A second, independently written copy of
 * either picker is a second chance to save something that marks as zero, and
 * that failure is silent — the answer looks saved on screen either way.
 *
 * Multiple choice, true/false and the open-text types stay with their screens.
 * Their response is one value with nothing to get wrong, and the two screens
 * deliberately present them differently.
 */
import React, { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { countBlanks, showBlanks } from '@/services/evaluationBlanks';
import { isolateForeignRuns } from '@/services/mathRender';
import {
  MAX_RECORD_MS,
  blobToDataUrl,
  formatDuration,
  isRecordingSupported,
} from '@/services/readAloudRecorder';
import { uploadReadAloud } from '@/services/studentExam';
import { setBlankAt, setMatchPair, type MatchPair, type StudentResponse } from '@/services/studentAnswers';
import type { TranslationKey } from '@/services/i18n';

const ACCENT = '#1B6B62';

/** Mirrors MAX_TAKES_PER_QUESTION in api-server's lib/readAloudUpload.ts. */
const MAX_TAKES = 3;

interface Shared {
  body: Record<string, unknown>;
  response: StudentResponse;
  colors: ReturnType<typeof useColors>;
  align: 'left' | 'right';
}

type Item = { id: string; text?: string };

// `matching.validate` only counts the two lists, so a body of bare strings is
// a legal question. Read as objects it renders as blank rows with an empty
// dropdown, which is the same dead end as having no branch at all.
const items = (v: unknown): Item[] =>
  Array.isArray(v) ? v.map(i => (typeof i === 'string' ? { id: i, text: i } : (i as Item))) : [];

/**
 * Left items, each with a dropdown of the right ones.
 *
 * A dropdown rather than drag-and-drop: this is a phone held in a classroom,
 * and a drag that needs a steady hand turns into a wrong answer for a reason
 * that has nothing to do with the subject.
 */
export function MatchingInput({
  body, response, onChange, colors, isRTL, align, t,
}: Shared & {
  onChange: (r: StudentResponse) => void;
  isRTL: boolean;
  t: (key: TranslationKey) => string;
}) {
  const left = items(body['left']);
  const right = items(body['right']);
  const pairs = Array.isArray(response['pairs']) ? (response['pairs'] as MatchPair[]) : [];
  const [openFor, setOpenFor] = useState<string | null>(null);

  return (
    <View style={{ gap: 8 }}>
      {left.map(l => {
        const chosen = pairs.find(p => p.left === l.id)?.right;
        const chosenText = right.find(r => r.id === chosen)?.text ?? chosen;
        return (
          <View key={l.id}>
            <View style={[styles.matchRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
              <Text style={{ color: colors.foreground, fontFamily: 'Almarai_400Regular', fontSize: 13, flex: 1, textAlign: align }}>
                {isolateForeignRuns(l.text ?? l.id)}
              </Text>
              <Pressable
                onPress={() => setOpenFor(openFor === l.id ? null : l.id)}
                style={[styles.matchPicker, { borderColor: chosen ? ACCENT : colors.border, flexDirection: isRTL ? 'row-reverse' : 'row' }]}
              >
                <Text style={{ color: chosen ? ACCENT : colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: 12 }}>
                  {chosenText ? isolateForeignRuns(chosenText) : t('matchingPickPlaceholder')}
                </Text>
                <Ionicons name={openFor === l.id ? 'chevron-up' : 'chevron-down'} size={14} color={colors.mutedForeground} />
              </Pressable>
            </View>
            {openFor === l.id && (
              <View style={[styles.matchOptions, { borderColor: colors.border, backgroundColor: colors.card }]}>
                {right.map(r => (
                  <Pressable
                    key={r.id}
                    onPress={() => {
                      onChange({ pairs: setMatchPair(pairs, l.id, r.id) });
                      setOpenFor(null);
                    }}
                    style={{ paddingVertical: 8, paddingHorizontal: 10 }}
                  >
                    <Text style={{ color: colors.foreground, fontFamily: 'Almarai_400Regular', fontSize: 13, textAlign: align }}>
                      {isolateForeignRuns(r.text ?? r.id)}
                    </Text>
                  </Pressable>
                ))}
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
}

/**
 * The sentence with its blanks shown, and one input per blank.
 *
 * `onCommit` is a separate prop because the teacher screen persists on blur
 * while the student screen saves every change. Both send the same dense array.
 */
export function FillBlankInput({
  body, response, onChange, onCommit, colors, align, t,
}: Shared & {
  onChange: (r: StudentResponse) => void;
  onCommit: (r: StudentResponse) => void;
  t: (key: TranslationKey, ...args: any[]) => string;
}) {
  const template = (body['template'] as string) ?? '';
  const count = countBlanks(template);
  const blanks = Array.isArray(response['blanks']) ? (response['blanks'] as string[]) : [];

  return (
    <View>
      <Text
        style={{
          color: colors.foreground,
          fontFamily: 'Almarai_400Regular',
          fontSize: 14,
          lineHeight: 20,
          textAlign: align,
          writingDirection: align === 'right' ? 'rtl' : 'ltr',
          marginBottom: 10,
        }}
      >
        {isolateForeignRuns(showBlanks(template))}
      </Text>
      <View style={{ gap: 8 }}>
        {Array.from({ length: count }, (_, i) => (
          <TextInput
            key={i}
            value={blanks[i] ?? ''}
            onChangeText={v => onChange({ blanks: setBlankAt(blanks, i, v, count) })}
            onBlur={() => onCommit({ blanks: setBlankAt(blanks, i, blanks[i] ?? '', count) })}
            placeholder={t('fillBlankLabel', i + 1)}
            placeholderTextColor={colors.mutedForeground}
            style={[styles.textInput, { color: colors.foreground, borderColor: colors.border, textAlign: align }]}
          />
        ))}
      </View>
    </View>
  );
}

/**
 * Read a passage aloud, record it, hear it back.
 *
 * Web only, and that is a product fact rather than a temporary gap: this app
 * ships with `microphonePermission: false` on both native platforms, so there
 * is no microphone to ask for. Students open the exam link in a browser, which
 * is where this works; native shows the fallback below rather than a control
 * that would fail on tap.
 *
 * The passage renders LTR inside an otherwise RTL screen. It is English, and
 * an English sentence laid out right-to-left is not a styling nitpick — it is
 * unreadable, and this question asks the student to read it aloud.
 *
 * The server owns the transcript. What comes back is displayed so the student
 * can see what was heard and decide whether to spend one of their remaining
 * takes; the score is deliberately not returned, because releasing a mark here
 * would tell them their result before the teacher has the paper.
 */
export function ReadAloudInput({
  body,
  response,
  questionId,
  token,
  onSaved,
  colors,
  t,
}: {
  body: Record<string, unknown>;
  response: StudentResponse;
  questionId: string;
  token: string;
  onSaved: (response: StudentResponse) => void;
  colors: ReturnType<typeof useColors>;
  t: (key: TranslationKey, ...args: string[]) => string;
}) {
  const passage = typeof body['passage'] === 'string' ? body['passage'] : '';
  const transcript = typeof response['transcript'] === 'string' ? response['transcript'] : '';
  const takes = typeof response['takes'] === 'number' ? response['takes'] : 0;
  const takesLeft = Math.max(0, MAX_TAKES - takes);

  const [phase, setPhase] = useState<'idle' | 'recording' | 'uploading'>('idle');
  const [elapsedMs, setElapsedMs] = useState(0);
  const [error, setError] = useState('');
  const startedAtRef = useRef(0);
  const recorderRef = useRef<{ stop: () => Promise<Blob> } | null>(null);

  const supported = Platform.OS === 'web' && isRecordingSupported();

  // Tick the visible timer, and stop the recording at the ceiling rather than
  // letting the student talk into an upload that the server will reject.
  useEffect(() => {
    if (phase !== 'recording') return;
    const id = setInterval(() => {
      const ms = Date.now() - startedAtRef.current;
      setElapsedMs(ms);
      if (ms >= MAX_RECORD_MS) void finish();
    }, 250);
    return () => clearInterval(id);
    // `finish` is stable for the life of a recording; re-subscribing on every
    // tick would reset the interval and the timer would never advance.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  async function begin() {
    setError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/mp4',
      ].find(m => MediaRecorder.isTypeSupported(m));
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      const chunks: Blob[] = [];
      recorder.ondataavailable = e => {
        if (e.data.size > 0) chunks.push(e.data);
      };
      recorderRef.current = {
        stop: () =>
          new Promise<Blob>(resolve => {
            recorder.onstop = () => {
              recorder.stream.getTracks().forEach(track => track.stop());
              resolve(new Blob(chunks, { type: mimeType ?? recorder.mimeType ?? 'audio/webm' }));
            };
            recorder.stop();
          }),
      };
      recorder.start();
      startedAtRef.current = Date.now();
      setElapsedMs(0);
      setPhase('recording');
    } catch {
      // Almost always a denied permission prompt. Saying which is more use
      // than "something went wrong", because the fix is in the browser's UI.
      setError(t('readAloudNoMic'));
      setPhase('idle');
    }
  }

  async function finish() {
    const recorder = recorderRef.current;
    if (!recorder) return;
    recorderRef.current = null;
    const durationMs = Math.min(Date.now() - startedAtRef.current, MAX_RECORD_MS);
    setPhase('uploading');
    try {
      const blob = await recorder.stop();
      const dataUrl = await blobToDataUrl(blob);
      const result = await uploadReadAloud(token, questionId, dataUrl, durationMs);
      onSaved({ audioKey: 'saved', transcript: result.transcript, durationMs, takes: takes + 1 });
    } catch (err) {
      setError(err instanceof Error ? err.message : t('readAloudFailed'));
    } finally {
      setPhase('idle');
    }
  }

  return (
    <View style={{ marginTop: 12, gap: 12 }}>
      {/* The passage. LTR and left-aligned regardless of the screen's
          direction, because it is English and this is the thing being read. */}
      <View style={[styles.passage, { borderColor: colors.border, backgroundColor: colors.muted }]}>
        <Text
          style={{
            color: colors.foreground,
            fontSize: 17,
            lineHeight: 30,
            textAlign: 'left',
            writingDirection: 'ltr',
          }}
        >
          {passage}
        </Text>
      </View>

      {!supported ? (
        <Text style={{ color: colors.mutedForeground, fontSize: 14, lineHeight: 22 }}>
          {t('readAloudWebOnly')}
        </Text>
      ) : takesLeft <= 0 ? (
        <Text style={{ color: colors.mutedForeground, fontSize: 14 }}>{t('readAloudNoTakesLeft')}</Text>
      ) : (
        <Pressable
          onPress={() => (phase === 'recording' ? void finish() : void begin())}
          disabled={phase === 'uploading'}
          style={[
            styles.recordBtn,
            {
              backgroundColor: phase === 'recording' ? '#C2410C' : ACCENT,
              opacity: phase === 'uploading' ? 0.6 : 1,
            },
          ]}
        >
          <Ionicons
            name={phase === 'recording' ? 'stop' : phase === 'uploading' ? 'hourglass' : 'mic'}
            size={20}
            color="#fff"
          />
          <Text style={{ color: '#fff', fontFamily: 'Cairo_600SemiBold', fontSize: 15 }}>
            {phase === 'recording'
              ? t('readAloudStop', formatDuration(elapsedMs))
              : phase === 'uploading'
                ? t('readAloudUploading')
                : t('readAloudStart')}
          </Text>
        </Pressable>
      )}

      {!!error && <Text style={{ color: '#B91C1C', fontSize: 13 }}>{error}</Text>}

      {!!transcript && (
        <View style={{ gap: 4 }}>
          <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>{t('readAloudHeard')}</Text>
          <Text
            style={{ color: colors.foreground, fontSize: 15, textAlign: 'left', writingDirection: 'ltr' }}
          >
            {transcript}
          </Text>
        </View>
      )}

      {takes > 0 && takesLeft > 0 && (
        <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>
          {t('readAloudTakesLeft', String(takesLeft))}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  passage: { borderWidth: 1, borderRadius: 12, padding: 16 },
  recordBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderRadius: 12,
    paddingVertical: 14,
  },
  matchRow: { alignItems: 'center', gap: 8 },
  matchPicker: { alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7, minWidth: 120, justifyContent: 'space-between' },
  matchOptions: { borderWidth: 1, borderRadius: 8, marginTop: 4, overflow: 'hidden' },
  textInput: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14 },
});
