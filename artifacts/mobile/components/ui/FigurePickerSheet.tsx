/**
 * Pick one of the lesson's book figures for a worksheet question.
 *
 * The teacher matches figure to question, by eye — the model that wrote the
 * question never saw the book's figures (see `BookFiguresPanel`). Every figure
 * the lesson has is offered, not the six the printed appendix caps at: the
 * one a question needs may be the seventh.
 */
import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';

import type { QuestionFigure } from '@/services/ai/AIService';

type Props = {
  visible: boolean;
  figures: readonly QuestionFigure[];
  /** The question's figure now, if it has one — marked, and «no figure» offered. */
  current?: QuestionFigure;
  onPick: (figure: QuestionFigure | null) => void;
  onClose: () => void;
  isRTL: boolean;
  accent: string;
  colors: { card: string; border: string; muted: string; foreground: string; mutedForeground: string };
  labels: { title: string; note: string; none: string; cancel: string };
};

export function FigurePickerSheet({ visible, figures, current, onPick, onClose, isRTL, accent, colors, labels }: Props) {
  const align = isRTL ? 'right' : 'left';
  return (
    <Modal transparent visible={visible} animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <View
          style={[styles.sheet, { backgroundColor: colors.card, borderTopColor: colors.border }]}
          onStartShouldSetResponder={() => true}
        >
          <View style={[styles.handle, { backgroundColor: colors.border }]} />
          <Text style={[styles.title, { color: colors.foreground, fontFamily: 'ReadexPro_600SemiBold', textAlign: align }]}>
            {labels.title}
          </Text>
          <Text style={[styles.note, { color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', textAlign: align }]}>
            {labels.note}
          </Text>
          <ScrollView contentContainerStyle={[styles.grid, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
            {figures.map(f => {
              const on = current?.uri === f.uri;
              return (
                <Pressable
                  key={f.uri}
                  accessibilityRole="button"
                  aria-selected={on}
                  accessibilityLabel={f.caption}
                  onPress={() => onPick(f)}
                  style={[styles.card, { borderColor: on ? accent : colors.border, backgroundColor: colors.muted, borderWidth: on ? 2 : StyleSheet.hairlineWidth }]}
                >
                  <Image source={{ uri: f.uri }} style={styles.image} contentFit="contain" />
                  <Text style={[styles.caption, { color: colors.mutedForeground, fontFamily: 'Almarai_400Regular' }]}>
                    {f.caption}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
          {current ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => onPick(null)}
              style={[styles.row, { borderColor: colors.border, flexDirection: isRTL ? 'row-reverse' : 'row' }]}
            >
              <Ionicons name="close-circle-outline" size={18} color={colors.mutedForeground} />
              <Text style={[styles.rowText, { color: colors.foreground, fontFamily: 'ReadexPro_500Medium' }]}>{labels.none}</Text>
            </Pressable>
          ) : null}
          <Pressable onPress={onClose} style={[styles.cancel, { backgroundColor: colors.muted }]}>
            <Text style={[styles.rowText, { color: colors.foreground, fontFamily: 'ReadexPro_500Medium' }]}>{labels.cancel}</Text>
          </Pressable>
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: { maxHeight: '85%', borderTopLeftRadius: 24, borderTopRightRadius: 24, borderTopWidth: 1, padding: 20, paddingBottom: 32 },
  handle: { width: 40, height: 4, borderRadius: 4, alignSelf: 'center', marginBottom: 16 },
  title: { fontSize: 17, marginBottom: 4 },
  note: { fontSize: 13, lineHeight: 20, marginBottom: 12 },
  grid: { flexWrap: 'wrap', gap: 12, paddingBottom: 8 },
  card: { width: '47%', borderRadius: 8, padding: 8, alignItems: 'center' },
  image: { width: '100%', height: 120, marginBottom: 8 },
  caption: { fontSize: 11, textAlign: 'center', lineHeight: 16 },
  row: { alignItems: 'center', gap: 8, paddingVertical: 12, borderTopWidth: 1, marginTop: 8 },
  rowText: { fontSize: 15 },
  cancel: { marginTop: 12, padding: 12, alignItems: 'center', borderRadius: 12 },
});
