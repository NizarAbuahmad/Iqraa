import React, { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { KeyboardSafeView } from '@/components/ui/KeyboardSafeView';
import { DECK_ACCENT, DECK_BORDER, DECK_CARD_BG, DECK_MUTED, DECK_TEXT } from '@/services/deckTheme';

export type BoardSaveDialogLabels = { title: string; nameLabel: string; save: string; cancel: string };

/**
 * Asks for the board's name, once, on the first save. A `<Modal>` is its own
 * window, so it carries its own `KeyboardSafeView` (the root Stack's wrapper
 * does not reach it). A name is required: Save stays disabled while it is blank.
 */
export function BoardSaveDialog({ visible, initialTitle, isRTL, labels, onSubmit, onCancel }: {
  visible: boolean;
  initialTitle: string;
  isRTL: boolean;
  labels: BoardSaveDialogLabels;
  onSubmit: (title: string) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(initialTitle);
  useEffect(() => {
    if (visible) setTitle(initialTitle);
  }, [visible, initialTitle]);
  const clean = title.trim();
  const rowDir = isRTL ? 'row-reverse' : 'row';
  const submit = () => {
    if (clean) onSubmit(clean);
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
              value={title}
              onChangeText={setTitle}
              onSubmitEditing={submit}
              autoFocus
              selectTextOnFocus
              maxLength={80}
              returnKeyType="done"
              accessibilityLabel={labels.nameLabel}
              placeholder={labels.nameLabel}
              placeholderTextColor={DECK_MUTED}
              style={[styles.input, { textAlign: isRTL ? 'right' : 'left', fontFamily: 'Almarai_400Regular' }]}
            />
            <View style={[styles.buttons, { flexDirection: rowDir }]}>
              <Pressable onPress={onCancel} accessibilityRole="button" style={styles.btn}>
                <Text style={[styles.btnText, { color: DECK_MUTED, fontFamily: 'Almarai_400Regular' }]}>{labels.cancel}</Text>
              </Pressable>
              <Pressable
                onPress={submit}
                disabled={!clean}
                accessibilityRole="button"
                style={[styles.btn, styles.btnPrimary, { opacity: clean ? 1 : 0.4 }]}
              >
                <Text style={[styles.btnText, { color: '#FFFFFF', fontFamily: 'ReadexPro_500Medium' }]}>{labels.save}</Text>
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
    width: '100%', maxWidth: 420, padding: 20, gap: 14, borderRadius: 20,
    backgroundColor: DECK_CARD_BG, borderWidth: 1, borderColor: DECK_BORDER,
  },
  heading: { fontSize: 17, color: DECK_TEXT },
  input: {
    borderWidth: 1, borderColor: DECK_BORDER, borderRadius: 12,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, color: DECK_TEXT,
  },
  buttons: { gap: 10, justifyContent: 'flex-end' },
  btn: { paddingHorizontal: 18, paddingVertical: 10, borderRadius: 12 },
  btnPrimary: { backgroundColor: DECK_ACCENT },
  btnText: { fontSize: 14 },
});
