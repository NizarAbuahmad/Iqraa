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
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { countBlanks, showBlanks } from '@/services/evaluationBlanks';
import { isolateForeignRuns } from '@/services/mathRender';
import { setBlankAt, setMatchPair, type MatchPair, type StudentResponse } from '@/services/studentAnswers';
import type { TranslationKey } from '@/services/i18n';

const ACCENT = '#1B6B62';

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

const styles = StyleSheet.create({
  matchRow: { alignItems: 'center', gap: 8 },
  matchPicker: { alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7, minWidth: 120, justifyContent: 'space-between' },
  matchOptions: { borderWidth: 1, borderRadius: 8, marginTop: 4, overflow: 'hidden' },
  textInput: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14 },
});
