import React, { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { KeyboardSafeView } from '@/components/ui/KeyboardSafeView';
import { RADIUS, SPACE, TYPE } from '@/constants/theme';
import { DECK_ACCENT, DECK_BORDER, DECK_CARD_BG, DECK_MUTED, DECK_TEXT } from '@/services/deckTheme';
import { MAX_TEXT_CHARS, cleanText, textDirection } from '@/services/whiteboardModel';

export type BoardTextDialogLabels = {
  addTitle: string;
  editTitle: string;
  fieldLabel: string;
  placeholder: string;
  add: string;
  save: string;
  remove: string;
  cancel: string;
};

/**
 * Types the board's text: opened by a tap with the text tool, empty for a new
 * text or holding the tapped one to edit it. Several lines are allowed (Enter
 * is a new line), so the dialog is confirmed with its button. Editing offers
 * Delete as well. A `<Modal>` is its own window, so it carries its own
 * `KeyboardSafeView`. What is typed shows in the dialog in its own direction,
 * whatever the app's language, so an English line on an Arabic board reads
 * left to right as it will on the page.
 */
export function BoardTextDialog({ visible, initialText, editing, isRTL, labels, onSubmit, onDelete, onCancel }: {
  visible: boolean;
  initialText: string;
  /** True when editing an existing text: the title says so and Delete is offered. */
  editing: boolean;
  isRTL: boolean;
  labels: BoardTextDialogLabels;
  onSubmit: (text: string) => void;
  onDelete: () => void;
  onCancel: () => void;
}) {
  const [text, setText] = useState(initialText);
  useEffect(() => {
    if (visible) setText(initialText);
  }, [visible, initialText]);
  const clean = cleanText(text);
  const rowDir = isRTL ? 'row-reverse' : 'row';
  const inputRtl = text.trim() ? textDirection(text) === 'rtl' : isRTL;
  const submit = () => {
    if (clean) onSubmit(clean);
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
              style={[
                styles.input,
                { textAlign: inputRtl ? 'right' : 'left', writingDirection: inputRtl ? 'rtl' : 'ltr', fontFamily: 'Almarai_400Regular' },
              ]}
            />
            <View style={[styles.buttons, { flexDirection: rowDir }]}>
              {editing ? (
                <Pressable onPress={onDelete} accessibilityRole="button" style={[styles.btn, styles.btnDelete]}>
                  <Text style={[styles.btnText, { color: '#B91C1C', fontFamily: 'Almarai_400Regular' }]}>{labels.remove}</Text>
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
                aria-disabled={!clean}
                style={[styles.btn, styles.btnPrimary, { opacity: clean ? 1 : 0.4 }]}
              >
                <Text style={[styles.btnText, { color: '#FFFFFF', fontFamily: 'ReadexPro_500Medium' }]}>
                  {editing ? labels.save : labels.add}
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
  backdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: SPACE.xxl, backgroundColor: 'rgba(0,0,0,0.4)' },
  card: {
    width: '100%', maxWidth: 480, padding: SPACE.xl, gap: SPACE.md, borderRadius: RADIUS.xl,
    backgroundColor: DECK_CARD_BG, borderWidth: 1, borderColor: DECK_BORDER,
  },
  heading: { fontSize: TYPE.bodyLg, color: DECK_TEXT },
  input: {
    minHeight: 110, maxHeight: 260, textAlignVertical: 'top',
    borderWidth: 1, borderColor: DECK_BORDER, borderRadius: RADIUS.md,
    paddingHorizontal: SPACE.md, paddingVertical: SPACE.md, fontSize: TYPE.bodyLg, color: DECK_TEXT,
  },
  buttons: { gap: SPACE.md, alignItems: 'center' },
  spacer: { flex: 1 },
  btn: { minHeight: 44, justifyContent: 'center', paddingHorizontal: SPACE.lg, paddingVertical: SPACE.sm, borderRadius: RADIUS.md },
  btnPrimary: { backgroundColor: DECK_ACCENT },
  btnDelete: { paddingHorizontal: SPACE.sm },
  btnText: { fontSize: TYPE.label },
});
