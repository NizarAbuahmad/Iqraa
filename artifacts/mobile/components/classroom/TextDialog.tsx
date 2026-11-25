import React, { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { KeyboardSafeView } from '@/components/ui/KeyboardSafeView';
import { RADIUS, SPACE, TYPE } from '@/constants/theme';
import { DECK_ACCENT, DECK_BORDER, DECK_CARD_BG, DECK_MUTED, DECK_TEXT, TIMER_RED } from '@/services/deckTheme';
import { MAX_TEXT_CHARS, MAX_TEXT_LINES, cleanText, textIsRtl } from '@/services/whiteboardModel';

export type TextDialogLabels = {
  addTitle: string;
  editTitle: string;
  fieldLabel: string;
  placeholder: string;
  add: string;
  save: string;
  remove: string;
  cancel: string;
  /** Shown when more than `MAX_TEXT_LINES` lines are typed: the rest is not kept. */
  tooManyLines: string;
};

/**
 * Types, or edits, one text on the board. A `<Modal>` is its own window, so it carries its own
 * `KeyboardSafeView` (the root Stack's wrapper does not reach it), like the save and solve dialogs.
 * Typing is in a box and not in place on the page: a phone's keyboard would cover the spot, and the
 * stage would have to resize under the teacher's finger. The text appears on the page the moment
 * it is added.
 *
 * Enter is a new line (the text is multi-line); Add / Save is the button. It stays disabled while
 * the text is empty after cleaning, because an empty text is not a text; editing has its own
 * «delete» for that. The field's alignment follows what is typed, as the text will on the page.
 */
export function TextDialog({ visible, isRTL, editing, initialText, labels, onSubmit, onRemove, onCancel }: {
  visible: boolean;
  isRTL: boolean;
  /** An existing text being changed (shows Delete, and the edit title) rather than a new one. */
  editing: boolean;
  initialText: string;
  labels: TextDialogLabels;
  onSubmit: (text: string) => void;
  onRemove: () => void;
  onCancel: () => void;
}) {
  const [text, setText] = useState(initialText);
  useEffect(() => {
    if (visible) setText(initialText);
  }, [visible, initialText]);
  const clean = cleanText(text);
  const lines = text.replace(/\r\n?/g, '\n').split('\n').length;
  const rowDir = isRTL ? 'row-reverse' : 'row';
  const submit = () => {
    if (clean) onSubmit(text);
  };
  return (
    <Modal visible={visible} transparent statusBarTranslucent animationType="fade" onRequestClose={onCancel}>
      <KeyboardSafeView>
        <View style={styles.backdrop}>
          <View style={styles.card}>
            <Text style={[styles.heading, { fontFamily: 'ReadexPro_500Medium', textAlign: isRTL ? 'right' : 'left' }]}>
              {editing ? labels.editTitle : labels.addTitle}
            </Text>
            <TextInput
              value={text}
              onChangeText={setText}
              autoFocus
              multiline
              maxLength={MAX_TEXT_CHARS}
              accessibilityLabel={labels.fieldLabel}
              placeholder={labels.placeholder}
              placeholderTextColor={DECK_MUTED}
              style={[styles.input, { textAlign: text ? (textIsRtl(text) ? 'right' : 'left') : isRTL ? 'right' : 'left', fontFamily: 'Almarai_400Regular' }]}
            />
            {lines > MAX_TEXT_LINES ? (
              <Text style={[styles.hint, { textAlign: isRTL ? 'right' : 'left', fontFamily: 'Almarai_400Regular' }]}>{labels.tooManyLines}</Text>
            ) : null}
            <View style={[styles.buttons, { flexDirection: rowDir }]}>
              {editing ? (
                <Pressable onPress={onRemove} accessibilityRole="button" style={styles.btn}>
                  <Text style={[styles.btnText, { color: TIMER_RED, fontFamily: 'Almarai_400Regular' }]}>{labels.remove}</Text>
                </Pressable>
              ) : null}
              <View style={styles.spacer} />
              <Pressable onPress={onCancel} accessibilityRole="button" style={styles.btn}>
                <Text style={[styles.btnText, { color: DECK_MUTED, fontFamily: 'Almarai_400Regular' }]}>{labels.cancel}</Text>
              </Pressable>
              <Pressable
                onPress={submit}
                disabled={!clean}
                accessibilityRole="button"
                style={[styles.btn, styles.btnPrimary, { opacity: clean ? 1 : 0.4 }]}
              >
                <Text style={[styles.btnText, { color: '#FFFFFF', fontFamily: 'ReadexPro_500Medium' }]}>{editing ? labels.save : labels.add}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </KeyboardSafeView>
    </Modal>
  );
}

// Sizes come from the theme's scales (constants/theme.ts), not literals: designScale.test.ts stops new
// off-scale values from creeping in.
const styles = StyleSheet.create({
  backdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: SPACE.xxl, backgroundColor: 'rgba(0,0,0,0.4)' },
  card: {
    width: '100%', maxWidth: 460, padding: SPACE.xl, gap: SPACE.md, borderRadius: RADIUS.lg,
    backgroundColor: DECK_CARD_BG, borderWidth: 1, borderColor: DECK_BORDER,
  },
  heading: { fontSize: TYPE.bodyLg, color: DECK_TEXT },
  input: {
    minHeight: 110, maxHeight: 220, textAlignVertical: 'top',
    borderWidth: 1, borderColor: DECK_BORDER, borderRadius: RADIUS.md,
    paddingHorizontal: SPACE.md, paddingVertical: SPACE.md, fontSize: TYPE.bodyLg, color: DECK_TEXT,
  },
  hint: { fontSize: TYPE.caption, color: DECK_MUTED },
  buttons: { gap: SPACE.md, alignItems: 'center' },
  spacer: { flex: 1 },
  btn: { paddingHorizontal: SPACE.lg, paddingVertical: SPACE.md, borderRadius: RADIUS.md },
  btnPrimary: { backgroundColor: DECK_ACCENT },
  btnText: { fontSize: TYPE.label },
});
