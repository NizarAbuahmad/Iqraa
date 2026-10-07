/**
 * "Add from the Lab" — opened from a class's «+» sheet, beside the Library.
 *
 * The lab catalogue is code, not a network call, so there is no loading state:
 * the list is the class's grade and subjects run through `labItemsForClass`.
 * One tap adds an item and the sheet stays open; items already on the shelf
 * read «مضاف». Spec: docs/superpowers/specs/2026-10-07-lab-class-workflow-design.md
 */
import React, { useMemo } from 'react';
import { ActivityIndicator, FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { LabItem } from '@workspace/curriculum/lab';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import { RESOURCE_KIND_ICON } from '@/constants/resourceKind';
import { labItemsForClass, labShelfKey } from '@/services/classResources';

function PickerRow({
  item,
  isAdded,
  isBusy,
  onAdd,
}: {
  item: LabItem;
  isAdded: boolean;
  isBusy: boolean;
  onAdd: () => void;
}) {
  const colors = useColors();
  const { t, isRTL, lang } = useLanguage();
  const align = isRTL ? 'right' : 'left';
  const title = lang === 'ar' ? item.titleAr : item.titleEn;
  const kindLabel =
    item.kind === 'interactive' ? t('labKindInteractive') : item.kind === 'law' ? t('labKindLaw') : t('labKindExternal');

  return (
    <Pressable
      onPress={onAdd}
      disabled={isAdded || isBusy}
      accessibilityRole="button"
      style={[
        styles.row,
        { borderColor: colors.border, flexDirection: isRTL ? 'row-reverse' : 'row', opacity: isAdded ? 0.7 : 1 },
      ]}
    >
      <Ionicons name={RESOURCE_KIND_ICON.lab} size={20} color={colors.primary} />
      <View style={{ flex: 1 }}>
        <Text
          numberOfLines={2}
          style={{ color: colors.foreground, fontFamily: 'ReadexPro_500Medium', fontSize: 14, textAlign: align }}
        >
          {title}
        </Text>
        <Text style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: 12, textAlign: align }}>
          {kindLabel}
        </Text>
      </View>
      {isBusy ? (
        <ActivityIndicator size="small" color={colors.primary} />
      ) : isAdded ? (
        <View style={{ alignItems: 'center', flexDirection: 'row', gap: 4 }}>
          <Ionicons name="checkmark-circle" size={18} color={colors.mutedForeground} />
          <Text style={{ color: colors.mutedForeground, fontFamily: 'ReadexPro_500Medium', fontSize: 12 }}>
            {t('resourceAdded')}
          </Text>
        </View>
      ) : (
        <Ionicons name="add-circle-outline" size={24} color={colors.primary} />
      )}
    </Pressable>
  );
}

export function LabPickerSheet({
  visible,
  group,
  added,
  busyId,
  error,
  onAdd,
  onClose,
}: {
  visible: boolean;
  group: { gradeId: string; subjectIds: readonly string[] };
  /** `lab:<itemId>` of every lab item already on the class's shelf. */
  added: ReadonlySet<string>;
  busyId: string | null;
  /** Shown inside the sheet: a toast on the screen would sit behind this Modal. */
  error?: string;
  onAdd: (itemId: string) => void;
  onClose: () => void;
}) {
  const colors = useColors();
  const { t, isRTL } = useLanguage();
  const items = useMemo(
    () => labItemsForClass(group.gradeId, group.subjectIds),
    // The array is rebuilt each render by the caller; its contents are the key.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [group.gradeId, group.subjectIds.join(',')],
  );

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <Text style={[styles.title, { color: colors.foreground, fontFamily: 'ReadexPro_600SemiBold' }]}>
            {t('labPickerTitle')}
          </Text>
          {error ? (
            <Text
              style={{
                color: colors.destructive,
                fontFamily: 'Almarai_400Regular',
                fontSize: 13,
                textAlign: isRTL ? 'right' : 'left',
              }}
            >
              {error}
            </Text>
          ) : null}
          <FlatList
            data={items}
            keyExtractor={i => i.id}
            style={{ maxHeight: 420 }}
            contentContainerStyle={{ gap: 8 }}
            ListEmptyComponent={
              <Text
                style={{
                  color: colors.mutedForeground,
                  fontFamily: 'Almarai_400Regular',
                  textAlign: 'center',
                  paddingVertical: 24,
                }}
              >
                {t('labPickerEmpty')}
              </Text>
            }
            renderItem={({ item }) => (
              <PickerRow
                item={item}
                isAdded={added.has(labShelfKey(item.id))}
                isBusy={busyId === item.id}
                onAdd={() => onAdd(item.id)}
              />
            )}
          />
          <View style={styles.actions}>
            <Pressable onPress={onClose} style={styles.doneBtn} accessibilityRole="button">
              <Text style={{ color: colors.primary, fontFamily: 'ReadexPro_600SemiBold' }}>
                {t('libraryPickerDone')}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: { width: '100%', maxWidth: 460, borderRadius: 16, padding: 20, gap: 12 },
  title: { fontSize: 18 },
  row: { alignItems: 'center', gap: 10, paddingVertical: 12, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end' },
  doneBtn: { paddingHorizontal: 18, paddingVertical: 11, borderRadius: 10 },
});
