import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { KeyboardSafeView } from '@/components/ui/KeyboardSafeView';
import { RADIUS, TYPE } from '@/constants/theme';
import { DECK_ACCENT, DECK_BORDER, DECK_CARD_BG, DECK_MUTED, DECK_TEXT } from '@/services/deckTheme';
import { SOLUTION_LIMITS } from '@workspace/math-verify';

export type SolveDialogLabels = {
  title: string; fieldLabel: string; placeholder: string; submit: string; working: string; cancel: string;
  /** States the verification limit: what is and is not checked. */
  hint: string;
};

/** Tap-to-add maths characters the keyboard hides. They are appended to the field. */
const SYMBOLS = ['x²', '^', '√', '÷', '×', '(', ')', '='] as const;

/**
 * Asks for the problem. A `<Modal>` is its own window, so it carries its own
 * `KeyboardSafeView`. The dialog stays open on failure (the message sits under
 * the field) so the teacher can reword and try again; Cancel closes it and the
 * screen aborts any request in flight.
 */
export function SolveDialog({ visible, isRTL, busy, error, labels, onSubmit, onCancel }: {
  visible: boolean;
  isRTL: boolean;
  busy: boolean;
  /** Already translated; null when there is nothing to say. */
  error: string | null;
  labels: SolveDialogLabels;
  onSubmit: (problem: string) => void;
  onCancel: () => void;
}) {
  const [text, setText] = useState('');
  useEffect(() => {
    if (visible) setText('');
  }, [visible]);
  const clean = text.trim();
  const canSubmit = clean.length > 0 && !busy;
  const rowDir = isRTL ? 'row-reverse' : 'row';
  const submit = () => {
    if (canSubmit) onSubmit(clean);
  };
  return (
    <Modal visible={visible} transparent statusBarTranslucent animationType="fade" onRequestClose={onCancel}>
      <KeyboardSafeView>
        <View style={styles.backdrop}>
          <View style={styles.card}>
            <Text style={[styles.heading, { fontFamily: 'ReadexPro_500Medium', textAlign: isRTL ? 'right' : 'left' }]}>
              {labels.title}
            </Text>
            <TextInput
              value={text}
              onChangeText={setText}
              multiline
              autoFocus
              editable={!busy}
              maxLength={SOLUTION_LIMITS.problem}
              accessibilityLabel={labels.fieldLabel}
              placeholder={labels.placeholder}
              placeholderTextColor={DECK_MUTED}
              style={[styles.input, { textAlign: isRTL ? 'right' : 'left', fontFamily: 'Almarai_400Regular' }]}
            />
            <View style={[styles.symbols, { flexDirection: rowDir }]}>
              {SYMBOLS.map(sym => (
                <Pressable
                  key={sym}
                  onPress={() => setText(t => (t.length + sym.length <= SOLUTION_LIMITS.problem ? t + sym : t))}
                  disabled={busy}
                  accessibilityRole="button"
                  accessibilityLabel={sym}
                  style={styles.symbol}
                >
                  <Text style={[styles.symbolText, { fontFamily: 'Almarai_400Regular' }]}>{sym}</Text>
                </Pressable>
              ))}
            </View>
            <Text style={[styles.hint, { textAlign: isRTL ? 'right' : 'left', fontFamily: 'Almarai_400Regular' }]}>
              {labels.hint}
            </Text>
            {error ? (
              <Text accessibilityRole="alert" style={[styles.error, { textAlign: isRTL ? 'right' : 'left', fontFamily: 'Almarai_400Regular' }]}>
                {error}
              </Text>
            ) : null}
            <View style={[styles.buttons, { flexDirection: rowDir }]}>
              <Pressable onPress={onCancel} accessibilityRole="button" style={styles.btn}>
                <Text style={[styles.btnText, { color: DECK_MUTED, fontFamily: 'Almarai_400Regular' }]}>{labels.cancel}</Text>
              </Pressable>
              <Pressable
                onPress={submit}
                disabled={!canSubmit}
                accessibilityRole="button"
                style={[styles.btn, styles.btnPrimary, { opacity: canSubmit ? 1 : 0.4, flexDirection: rowDir }]}
              >
                {busy ? <ActivityIndicator color="#FFFFFF" size="small" /> : null}
                <Text style={[styles.btnText, { color: '#FFFFFF', fontFamily: 'ReadexPro_500Medium' }]}>
                  {busy ? labels.working : labels.submit}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </KeyboardSafeView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: 'rgba(0,0,0,0.4)' },
  card: {
    width: '100%', maxWidth: 460, padding: 20, gap: 12, borderRadius: RADIUS.xl,
    backgroundColor: DECK_CARD_BG, borderWidth: 1, borderColor: DECK_BORDER,
  },
  heading: { fontSize: TYPE.bodyLg, color: DECK_TEXT },
  input: {
    minHeight: 96, maxHeight: 180, textAlignVertical: 'top',
    borderWidth: 1, borderColor: DECK_BORDER, borderRadius: RADIUS.md,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: TYPE.bodyLg, color: DECK_TEXT,
  },
  symbols: { flexWrap: 'wrap', gap: 8 },
  symbol: {
    minWidth: 40, height: 36, paddingHorizontal: 10, alignItems: 'center', justifyContent: 'center',
    borderRadius: RADIUS.md, borderWidth: 1, borderColor: DECK_BORDER, backgroundColor: DECK_CARD_BG,
  },
  symbolText: { fontSize: TYPE.bodyLg, color: DECK_TEXT },
  hint: { fontSize: TYPE.caption, color: DECK_MUTED },
  error: { fontSize: TYPE.caption, color: '#B91C1C' },
  buttons: { gap: 10, justifyContent: 'flex-end' },
  btn: { paddingHorizontal: 18, paddingVertical: 10, borderRadius: RADIUS.md, alignItems: 'center', gap: 8 },
  btnPrimary: { backgroundColor: DECK_ACCENT },
  btnText: { fontSize: TYPE.label },
});
