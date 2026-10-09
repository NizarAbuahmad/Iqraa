/**
 * "Add from the Library" — opened from a class's «+» sheet.
 *
 * The same catalogue the Library screen shows (staff uploads, premade sheets,
 * book-QR codes), narrowed to this class's grade and subject by the existing,
 * tested `filterResources`, and ordered by the Library's own shelf order. One
 * tap adds an item and the sheet stays open, so a teacher can add several;
 * items already on the shelf read «مضاف».
 *
 * A compact row rather than the Library screen's cover cards, so that screen is
 * untouched. `listLibrary` already returns [] when the staff list cannot be
 * reached, so premade sheets and book codes still show and no error state is
 * needed here.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { allPremade } from '@workspace/curriculum/premade';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import { RESOURCE_KIND_ICON, RESOURCE_KIND_LABEL } from '@/constants/resourceKind';
import { listLibrary, type LibraryItem } from '@/services/libraryApi';
import { qrResourcesForGrade } from '@/services/bookQrLinks';
import {
  buildResourceCatalog,
  filterResources,
  groupIntoShelves,
  type ResourceItem,
} from '@/services/resourceCatalog';

function PickerRow({
  item,
  isAdded,
  isBusy,
  onAdd,
}: {
  item: ResourceItem;
  isAdded: boolean;
  isBusy: boolean;
  onAdd: () => void;
}) {
  const colors = useColors();
  const { t, isRTL, lang } = useLanguage();
  const align = isRTL ? 'right' : 'left';
  const title = lang === 'ar' ? item.titleAr : item.titleEn;
  const page =
    item.page === undefined ? null : lang === 'ar' ? item.page.toLocaleString('ar-EG') : String(item.page);
  const detail = [t(RESOURCE_KIND_LABEL[item.kind]), page ? t('qrOnPage', page) : null]
    .filter(Boolean)
    .join(' · ');

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
      <Ionicons name={RESOURCE_KIND_ICON[item.kind]} size={20} color={colors.primary} />
      <View style={{ flex: 1 }}>
        <Text
          numberOfLines={2}
          style={{ color: colors.foreground, fontFamily: 'ReadexPro_500Medium', fontSize: 14, textAlign: align }}
        >
          {title}
        </Text>
        <Text style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: 12, textAlign: align }}>
          {detail}
        </Text>
        {item.insecure ? (
          <Text style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: 11, textAlign: align }}>
            {t('qrInsecureRow')}
          </Text>
        ) : null}
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

export function LibraryPickerSheet({
  visible,
  group,
  added,
  busyKey,
  error,
  onAdd,
  onClose,
}: {
  visible: boolean;
  /** The class's grade and the subjects to show. An empty list means "any". */
  group: { gradeId: string; subjectIds: readonly string[] };
  /** `<source>:<nativeId>` of every item already on the class's shelf. */
  added: ReadonlySet<string>;
  /** The item currently being added, so its row can show a spinner. */
  busyKey: string | null;
  /** A failed add, shown inside the sheet: a toast on the screen would sit behind this Modal. */
  error?: string;
  onAdd: (item: ResourceItem) => void;
  onClose: () => void;
}) {
  const colors = useColors();
  const { t, isRTL } = useLanguage();
  const [uploaded, setUploaded] = useState<LibraryItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!visible || !group.gradeId) return;
    let live = true;
    setLoading(true);
    void listLibrary(group.gradeId).then(rows => {
      if (!live) return;
      setUploaded(rows);
      setLoading(false);
    });
    return () => {
      live = false;
    };
  }, [visible, group.gradeId]);

  const items = useMemo(() => {
    const all = buildResourceCatalog({
      uploaded,
      premade: allPremade().filter(sheet => sheet.gradeId === group.gradeId),
      qr: qrResourcesForGrade(group.gradeId),
    });
    const scoped = filterResources(all, {
      gradeId: group.gradeId,
      subjectIds: group.subjectIds,
    });
    return groupIntoShelves(scoped).flatMap(shelf => shelf.items);
    // The array is rebuilt each render by the caller; its contents are the key.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uploaded, group.gradeId, group.subjectIds.join(',')]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <Text style={[styles.title, { color: colors.foreground, fontFamily: 'ReadexPro_600SemiBold' }]}>
            {t('libraryPickerTitle')}
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
          {loading && items.length === 0 ? <ActivityIndicator color={colors.primary} /> : null}
          <FlatList
            data={items}
            keyExtractor={i => i.key}
            style={{ maxHeight: 420 }}
            contentContainerStyle={{ gap: 8 }}
            ListEmptyComponent={
              loading ? null : (
                <Text
                  style={{
                    color: colors.mutedForeground,
                    fontFamily: 'Almarai_400Regular',
                    textAlign: 'center',
                    paddingVertical: 24,
                  }}
                >
                  {t('libraryPickerEmpty')}
                </Text>
              )
            }
            renderItem={({ item }) => (
              <PickerRow
                item={item}
                isAdded={added.has(item.key)}
                isBusy={busyKey === item.key}
                onAdd={() => onAdd(item)}
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
