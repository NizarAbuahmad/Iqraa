/**
 * The class picker for one timetable cell — the 45ups-style dropdown:
 * tap a cell, the teacher's classes drop down right there, picking one
 * saves. A note row underneath edits the slot's note on blur.
 *
 * Saving is the screen's job (it owns the optimistic `slots` state and the
 * error banner); this only reports what was picked.
 */
import React, { useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { useColors } from '@/hooks/useColors';
import type { ClassGroup } from '@/services/roster';
import type { ScheduleSlot } from '@/services/schedule';
import type { TranslationKey } from '@/services/i18n';
import { Popover, type Anchor } from './Popover';

type T = (key: TranslationKey, ...args: any[]) => string;

export function SlotPopover({
  anchor, isDesktop, isRTL, colors, t, classes, current, title,
  nameOf, captionOf, colorOf, onPick, onNote, onClose,
}: {
  anchor: Anchor | null;
  isDesktop: boolean;
  isRTL: boolean;
  colors: ReturnType<typeof useColors>;
  t: T;
  classes: ClassGroup[];
  current: ScheduleSlot | null;
  /** "الأحد — الحصة 3", so a phone bottom sheet still says which cell this is. */
  title: string;
  nameOf: (c: ClassGroup) => string;
  captionOf: (c: ClassGroup) => string;
  colorOf: (c: ClassGroup) => string;
  onPick: (classGroupId: string | null) => void;
  onNote: (notes: string) => void;
  onClose: () => void;
}) {
  const [note, setNote] = useState(current?.notes ?? '');
  const align = isRTL ? 'right' as const : 'left' as const;
  const rowDir = isRTL ? 'row-reverse' as const : 'row' as const;
  const selected = current?.classGroupId ?? null;

  const commitNote = () => {
    const trimmed = note.trim();
    if (trimmed !== (current?.notes ?? '')) onNote(trimmed);
  };

  const Row = ({ active, color, label, caption, onPress }: {
    active: boolean; color: string | null; label: string; caption?: string; onPress: () => void;
  }) => (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: rowDir, alignItems: 'center', gap: 10, paddingVertical: 9, paddingHorizontal: 10,
        borderRadius: 10, backgroundColor: active ? colors.secondary : pressed ? colors.muted : 'transparent',
      })}
    >
      <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: color ?? colors.border }} />
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.foreground, fontFamily: active ? 'Cairo_600SemiBold' : 'Cairo_500Medium', fontSize: 13.5, textAlign: align }}>
          {label}
        </Text>
        {caption ? (
          <Text style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: 11, textAlign: align }}>{caption}</Text>
        ) : null}
      </View>
      {active ? <Ionicons name="checkmark" size={16} color={colors.primary} /> : null}
    </Pressable>
  );

  return (
    <Popover anchor={anchor} isDesktop={isDesktop} isRTL={isRTL} colors={colors} onClose={onClose}>
      <Text style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: 11.5, textAlign: align, paddingHorizontal: 10 }}>
        {title}
      </Text>
      <ScrollView style={{ maxHeight: isDesktop ? 260 : 320 }}>
        {classes.map(c => (
          <Row
            key={c.id}
            active={selected === c.id}
            color={colorOf(c)}
            label={nameOf(c)}
            caption={captionOf(c)}
            onPress={() => onPick(c.id)}
          />
        ))}
        <Row active={selected === null} color={null} label={t('planNoClass')} onPress={() => onPick(null)} />
      </ScrollView>
      <View style={{ borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 8 }}>
        <TextInput
          value={note}
          onChangeText={setNote}
          onBlur={commitNote}
          onSubmitEditing={commitNote}
          placeholder={t('scheduleSlotNotesPlaceholder')}
          placeholderTextColor={colors.mutedForeground}
          style={{
            borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9,
            color: colors.foreground, fontFamily: 'Almarai_400Regular', fontSize: 13, textAlign: align,
          }}
        />
      </View>
    </Popover>
  );
}
