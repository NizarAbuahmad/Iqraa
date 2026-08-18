/**
 * Inline editing for generated material.
 *
 * Everything the generators produce is already structured — a lesson plan is
 * objectives, materials and named sections, not a paragraph — so a teacher can
 * change one objective without touching the rest. Before this, the only way to
 * alter anything was to regenerate, which meant losing the parts that were good
 * to fix the one that wasn't.
 *
 * Editing happens in place rather than behind an edit mode. Mode switches are
 * where people lose work: you forget which mode you are in, or you leave
 * without saving. Tap the text, change it, tap away.
 *
 * Every edit reports itself so the caller can record that a field is no longer
 * purely machine-written. What a teacher changes is also the most honest signal
 * this product can collect about generation quality — which objective always
 * gets rewritten, which question always gets deleted.
 */
import React, { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { MathParagraph } from './MathParagraph';

type Colors = {
  foreground: string;
  mutedForeground: string;
  card: string;
  border: string;
  primary: string;
  muted: string;
};

type BaseProps = {
  colors: Colors;
  isRTL: boolean;
  /** Shown while empty, e.g. "اكتب هنا…". */
  placeholder?: string;
};

/** A prose block: tap to edit, commits when focus leaves. */
export function EditableText({
  value,
  onChange,
  colors,
  isRTL,
  placeholder,
  edited,
}: BaseProps & {
  value: string;
  onChange: (next: string) => void;
  /** Marks the field as teacher-touched. */
  edited?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<TextInput>(null);

  // A regenerate replaces the value underneath; don't keep showing a stale draft.
  useEffect(() => {
    if (!editing) setDraft(value);
  }, [value, editing]);

  const commit = () => {
    setEditing(false);
    const next = draft.trim();
    // An accidental clear should not silently delete a section. Blanking a
    // block is almost never the intent of tapping into it.
    if (!next) {
      setDraft(value);
      return;
    }
    if (next !== value) onChange(next);
  };

  const align = isRTL ? 'right' : 'left';

  if (editing) {
    return (
      <TextInput
        ref={inputRef}
        value={draft}
        onChangeText={setDraft}
        onBlur={commit}
        autoFocus
        multiline
        placeholder={placeholder}
        placeholderTextColor={colors.mutedForeground}
        style={[
          styles.input,
          {
            color: colors.foreground,
            backgroundColor: colors.card,
            borderColor: colors.primary,
            fontFamily: 'Almarai_400Regular',
            textAlign: align,
          },
        ]}
      />
    );
  }

  return (
    <Pressable
      onPress={() => setEditing(true)}
      accessibilityRole="button"
      accessibilityLabel={value}
      accessibilityHint={placeholder}
      style={styles.readRow}
    >
      <MathParagraph
        text={value || placeholder || ''}
        style={{ fontSize: styles.body.fontSize, lineHeight: styles.body.lineHeight, color: colors.foreground, fontFamily: 'Almarai_400Regular', textAlign: align }}
        containerStyle={{ flex: 1 }}
        isRTL={isRTL}
      />
      <EditAffordance colors={colors} edited={edited} />
    </Pressable>
  );
}

/**
 * A list of short items — objectives, materials — each editable and removable,
 * with one row to add another.
 */
export function EditableList({
  items,
  onChange,
  colors,
  isRTL,
  placeholder,
  addLabel,
  editedIndexes,
}: BaseProps & {
  items: string[];
  onChange: (next: string[]) => void;
  addLabel: string;
  editedIndexes?: ReadonlySet<number>;
}) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState('');
  const rowDir = isRTL ? 'row-reverse' : 'row';

  const replaceAt = (i: number, next: string) => {
    const copy = [...items];
    copy[i] = next;
    onChange(copy);
  };

  const removeAt = (i: number) => onChange(items.filter((_, n) => n !== i));

  const commitAdd = () => {
    const next = draft.trim();
    setAdding(false);
    setDraft('');
    if (next) onChange([...items, next]);
  };

  return (
    <View style={{ gap: 4 }}>
      {items.map((item, i) => (
        <View key={`${i}-${item.slice(0, 12)}`} style={[styles.listRow, { flexDirection: rowDir }]}>
          <View style={[styles.bullet, { backgroundColor: colors.primary }]} />
          <View style={{ flex: 1 }}>
            <EditableText
              value={item}
              onChange={next => replaceAt(i, next)}
              colors={colors}
              isRTL={isRTL}
              placeholder={placeholder}
              edited={editedIndexes?.has(i)}
            />
          </View>
          <Pressable
            onPress={() => removeAt(i)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={`${item} — ✕`}
          >
            <Ionicons name="close" size={15} color={colors.mutedForeground} />
          </Pressable>
        </View>
      ))}

      {adding ? (
        <TextInput
          value={draft}
          onChangeText={setDraft}
          onBlur={commitAdd}
          autoFocus
          multiline
          placeholder={placeholder}
          placeholderTextColor={colors.mutedForeground}
          style={[
            styles.input,
            {
              color: colors.foreground,
              backgroundColor: colors.card,
              borderColor: colors.primary,
              fontFamily: 'Almarai_400Regular',
              textAlign: isRTL ? 'right' : 'left',
            },
          ]}
        />
      ) : (
        <Pressable
          onPress={() => setAdding(true)}
          accessibilityRole="button"
          style={[styles.addRow, { flexDirection: rowDir }]}
        >
          <Ionicons name="add" size={15} color={colors.mutedForeground} />
          <Text
            style={{
              color: colors.mutedForeground,
              fontFamily: 'Almarai_400Regular',
              fontSize: 12.5,
            }}
          >
            {addLabel}
          </Text>
        </Pressable>
      )}
    </View>
  );
}

/** Quiet pencil, plus a dot once the teacher has changed this field. */
function EditAffordance({ colors, edited }: { colors: Colors; edited?: boolean }) {
  return (
    <View style={styles.affordance}>
      {edited ? <View style={[styles.editedDot, { backgroundColor: colors.primary }]} /> : null}
      <Ionicons name="pencil" size={12} color={colors.mutedForeground} style={{ opacity: 0.5 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  readRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  body: { flex: 1, fontSize: 13.5, lineHeight: 22 },
  input: {
    fontSize: 13.5,
    lineHeight: 22,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    minHeight: 40,
  },
  listRow: { alignItems: 'flex-start', gap: 8 },
  bullet: { width: 5, height: 5, borderRadius: 3, marginTop: 9 },
  addRow: { alignItems: 'center', gap: 6, paddingVertical: 6 },
  affordance: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 5 },
  editedDot: { width: 5, height: 5, borderRadius: 3 },
});
