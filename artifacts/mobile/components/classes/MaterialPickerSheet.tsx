/**
 * «من ملفاتي» — the homework form's second attachment source: the teacher's own
 * saved materials (worksheets, quizzes, decks, plans). The sibling of
 * `LibraryPickerSheet`, with the same tap-to-add, stay-open behaviour and the
 * same look. Only what the server can serve is offered (`isAttachableMaterial`:
 * saved to the server, not a board); the class's students and parents then open
 * it read-only, without its answers.
 */
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { RADIUS, SPACE, TYPE } from '@/constants/theme';
import { useLanguage } from '@/context/LanguageContext';
import { MATERIAL_ICON, MATERIAL_LABEL_KEY } from '@/constants/materialKind';
import { getItems, type SavedMaterial } from '@/services/workspace';
import { isAttachableMaterial } from '@/services/homework';

export function MaterialPickerSheet({
  visible,
  added,
  onAdd,
  onClose,
}: {
  visible: boolean;
  /** Ids of the materials already attached. */
  added: ReadonlySet<string>;
  onAdd: (m: SavedMaterial) => void;
  onClose: () => void;
}) {
  const colors = useColors();
  const { t, isRTL } = useLanguage();
  const align = isRTL ? 'right' : 'left';
  const [items, setItems] = useState<SavedMaterial[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!visible) return;
    let live = true;
    setLoading(true);
    void getItems({})
      .catch(() => [] as SavedMaterial[])
      .then(all => {
        if (!live) return;
        setItems(all.filter(isAttachableMaterial));
        setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [visible]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <Text style={[styles.title, { color: colors.foreground, fontFamily: 'ReadexPro_600SemiBold', textAlign: align }]}>
            {t('hwAddMaterial')}
          </Text>
          {loading ? <ActivityIndicator color={colors.primary} /> : null}
          <FlatList
            data={items}
            keyExtractor={m => m.id}
            style={{ maxHeight: 420 }}
            contentContainerStyle={{ gap: SPACE.sm }}
            ListEmptyComponent={
              loading ? null : (
                <Text style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', textAlign: 'center', paddingVertical: SPACE.xxl }}>
                  {t('hwMaterialPickerEmpty')}
                </Text>
              )
            }
            renderItem={({ item }) => {
              const isAdded = added.has(item.id);
              return (
                <Pressable
                  onPress={() => onAdd(item)}
                  disabled={isAdded}
                  accessibilityRole="button"
                  style={[styles.row, { borderColor: colors.border, flexDirection: isRTL ? 'row-reverse' : 'row', opacity: isAdded ? 0.7 : 1 }]}
                >
                  <Ionicons name={MATERIAL_ICON[item.type] ?? 'document-outline'} size={20} color={colors.primary} />
                  <View style={{ flex: 1 }}>
                    <Text numberOfLines={2} style={{ color: colors.foreground, fontFamily: 'ReadexPro_500Medium', fontSize: TYPE.label, textAlign: align }}>
                      {item.title}
                    </Text>
                    <Text style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: TYPE.caption, textAlign: align }}>
                      {[MATERIAL_LABEL_KEY[item.type] ? t(MATERIAL_LABEL_KEY[item.type]) : '', item.subject, item.grade].filter(Boolean).join(' · ')}
                    </Text>
                  </View>
                  {isAdded ? (
                    <View style={{ alignItems: 'center', flexDirection: 'row', gap: SPACE.xs }}>
                      <Ionicons name="checkmark-circle" size={18} color={colors.mutedForeground} />
                      <Text style={{ color: colors.mutedForeground, fontFamily: 'ReadexPro_500Medium', fontSize: TYPE.caption }}>{t('resourceAdded')}</Text>
                    </View>
                  ) : (
                    <Ionicons name="add-circle-outline" size={24} color={colors.primary} />
                  )}
                </Pressable>
              );
            }}
          />
          <View style={styles.actions}>
            <Pressable onPress={onClose} style={styles.doneBtn} accessibilityRole="button">
              <Text style={{ color: colors.primary, fontFamily: 'ReadexPro_600SemiBold' }}>{t('libraryPickerDone')}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center', padding: SPACE.xxl },
  card: { width: '100%', maxWidth: 460, borderRadius: RADIUS.lg, padding: SPACE.xl, gap: SPACE.md },
  title: { fontSize: TYPE.bodyLg },
  row: { alignItems: 'center', gap: SPACE.md, paddingVertical: SPACE.md, paddingHorizontal: SPACE.md, borderRadius: RADIUS.md, borderWidth: 1 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end' },
  doneBtn: { paddingHorizontal: SPACE.lg, paddingVertical: SPACE.md, borderRadius: RADIUS.md },
});
