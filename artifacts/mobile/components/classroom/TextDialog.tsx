import React, { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { KeyboardSafeView } from '@/components/ui/KeyboardSafeView';
import { RADIUS, SPACE, TYPE } from '@/constants/theme';
import { DECK_ACCENT, DECK_BORDER, DECK_CARD_BG, DECK_MUTED, DECK_TEXT, TIMER_RED } from '@/services/deckTheme';
import { BOARD_PEN_COLORS } from '@/services/penColors';
import { MAX_TEXT_CHARS, MAX_TEXT_LINES, TEXT_SIZES, cleanText, textIsRtl } from '@/services/whiteboardModel';

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
  /** One per `BOARD_PEN_COLORS` entry. */
  colors: string[];
  /** One per `TEXT_SIZES` entry. */
  sizes: string[];
};

/** What the dialog hands back: the words, and the colour and size they are to have. */
export type TextDialogResult = { text: string; color: string; size: number };

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
 *
 * The colour and size are chosen here for THIS text, for a new one and a placed one alike; they start
 * at the text's own (or, for a new one, the toolbar's) and change nothing outside it. The caller must
 * give it a fresh `key` for each text it opens it for.
 */
export function TextDialog({ visible, isRTL, editing, initialText, initialColor, initialSize, labels, onSubmit, onRemove, onCancel }: {
  visible: boolean;
  isRTL: boolean;
  /** An existing text being changed (shows Delete, and the edit title) rather than a new one. */
  editing: boolean;
  initialText: string;
  initialColor: string;
  initialSize: number;
  labels: TextDialogLabels;
  onSubmit: (result: TextDialogResult) => void;
  onRemove: () => void;
  onCancel: () => void;
}) {
  // The screen gives this dialog a new `key` every time it opens, so these start from the props and
  // nothing is carried over from the last text. (An effect that reset them after opening showed the
  // old words for a frame: caught in a browser, after editing one text and tapping the page for another.)
  const [text, setText] = useState(initialText);
  const [color, setColor] = useState(initialColor);
  const [size, setSize] = useState(initialSize);
  const clean = cleanText(text);
  const lines = text.replace(/\r\n?/g, '\n').split('\n').length;
  const rowDir = isRTL ? 'row-reverse' : 'row';
  const submit = () => {
    if (clean) onSubmit({ text, color, size });
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
            <View style={[styles.choices, { flexDirection: rowDir }]}>
              {BOARD_PEN_COLORS.map((c, i) => (
                <Pressable
                  key={c}
                  onPress={() => setColor(c)}
                  hitSlop={6}
                  accessibilityRole="button"
                  accessibilityLabel={labels.colors[i]}
                  aria-selected={c.toUpperCase() === color.toUpperCase()}
                  style={[styles.swatch, { backgroundColor: c }, c.toUpperCase() === color.toUpperCase() && styles.swatchOn]}
                />
              ))}
            </View>
            <View style={[styles.choices, { flexDirection: rowDir }]}>
              {TEXT_SIZES.map((s, i) => (
                <Pressable
                  key={s}
                  onPress={() => setSize(s)}
                  accessibilityRole="button"
                  accessibilityLabel={labels.sizes[i]}
                  aria-selected={s === size}
                  style={[styles.sizeBtn, s === size && styles.sizeBtnOn]}
                >
                  <Text style={{ fontSize: TYPE.caption + i * 4, color: s === size ? DECK_ACCENT : DECK_MUTED, fontFamily: 'ReadexPro_500Medium' }}>
                    {isRTL ? 'أ' : 'A'}
                  </Text>
                </Pressable>
              ))}
            </View>
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
  choices: { gap: SPACE.md, alignItems: 'center' },
  swatch: { width: 28, height: 28, borderRadius: RADIUS.pill },
  swatchOn: { borderWidth: 3, borderColor: DECK_BORDER, transform: [{ scale: 1.15 }] },
  sizeBtn: {
    width: 44, height: 44, alignItems: 'center', justifyContent: 'center',
    borderRadius: RADIUS.md, borderWidth: 1, borderColor: DECK_BORDER,
  },
  sizeBtnOn: { borderColor: DECK_ACCENT, backgroundColor: DECK_ACCENT + '14' },
  buttons: { gap: SPACE.md, alignItems: 'center' },
  spacer: { flex: 1 },
  btn: { paddingHorizontal: SPACE.lg, paddingVertical: SPACE.md, borderRadius: RADIUS.md },
  btnPrimary: { backgroundColor: DECK_ACCENT },
  btnText: { fontSize: TYPE.label },
});
