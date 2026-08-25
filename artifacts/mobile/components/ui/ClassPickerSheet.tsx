/**
 * "Which class is this for?" — shown right after a material is saved.
 *
 * Asking here rather than adding a class field to every generator form: there
 * are seven save sites and they all have crowded layouts, but they all end the
 * same way, with an id in hand. One sheet, opened on that id, covers them all.
 *
 * Two behaviours worth knowing before reusing this:
 *
 * - **A teacher with no classes is never asked.** The sheet closes itself the
 *   moment it learns the list is empty, so a teacher who has not built a roster
 *   never sees a dialog offering nothing. That is why loading happens inside
 *   the sheet rather than in each caller — otherwise all seven would need to
 *   count classes before deciding whether to open it.
 * - **The roster is server-only** (see services/roster.ts), so offline there is
 *   nothing to choose from. That is also a silent close: the material is
 *   already saved, and a failure dialog about a question the teacher did not
 *   ask is worse than not asking.
 * - **Picking is multi-select and committed by a button.** A teacher teaching
 *   the same lesson to three sections was previously done the moment they
 *   touched a row — one class, sheet gone, no way back except attaching from
 *   inside each class. Selecting is now separate from confirming, so a
 *   mis-tap is recoverable and several sections are one trip.
 *
 * `saved_materials.class_group_id` holds ONE class, so what the caller does
 * with several is duplicate (see `attachToClasses` in services/workspace.ts).
 * That is why the confirm label and the toast both say copies rather than
 * implying one shared material.
 */
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import { listClasses, type ClassGroup } from '@/services/roster';
import { countStudents } from '@/services/i18n';

const ACCENT = '#1B6B62';

/** One chosen class, with its name already resolved for the active language. */
export type ClassPick = { id: string; name: string };

export function ClassPickerSheet({
  visible,
  onClose,
  onPick,
}: {
  visible: boolean;
  /** Dismissed, or nothing to choose from. The material stays unattached. */
  onClose: () => void;
  /**
   * The teacher confirmed their selection — never empty, and in the order they
   * appear in the roster. Display names come back resolved for the active
   * language so callers do not each repeat the nameAr fallback.
   */
  onPick: (picks: ClassPick[]) => void;
}) {
  const colors = useColors();
  const { t, isRTL, lang } = useLanguage();
  const [classes, setClasses] = useState<ClassGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string[]>([]);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    setLoading(true);
    // A fresh material is a fresh question: carrying the last one's ticks over
    // would attach this one to whatever the previous save happened to pick.
    setSelected([]);
    void (async () => {
      let loaded: ClassGroup[] = [];
      try {
        loaded = await listClasses();
      } catch {
        // Offline or roster storage missing — see the note at the top.
      }
      if (cancelled) return;
      setClasses(loaded);
      setLoading(false);
      if (loaded.length === 0) onClose();
    })();
    return () => {
      cancelled = true;
    };
  }, [visible, onClose]);

  const align = isRTL ? 'right' : 'left';

  // Nothing to offer yet: stay invisible rather than flashing an empty sheet
  // for as long as the request takes.
  if (!visible || (!loading && classes.length === 0)) return null;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <Text
            style={[
              styles.title,
              { color: colors.foreground, fontFamily: 'Cairo_600SemiBold', textAlign: align },
            ]}
          >
            {t('saveToClassTitle')}
          </Text>
          <Text
            style={[
              styles.hint,
              { color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', textAlign: align },
            ]}
          >
            {t('saveToClassHint')}
          </Text>

          {loading ? (
            <ActivityIndicator color={ACCENT} style={{ paddingVertical: 28 }} />
          ) : (
            <FlatList
              data={classes}
              keyExtractor={c => c.id}
              style={{ maxHeight: 300 }}
              contentContainerStyle={{ gap: 8 }}
              renderItem={({ item }) => {
                const on = selected.includes(item.id);
                return (
                <Pressable
                  onPress={() =>
                    setSelected(cur =>
                      cur.includes(item.id) ? cur.filter(id => id !== item.id) : [...cur, item.id],
                    )
                  }
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: on }}
                  style={[
                    styles.row,
                    {
                      borderColor: on ? ACCENT : colors.border,
                      backgroundColor: on ? ACCENT + '10' : 'transparent',
                      flexDirection: isRTL ? 'row-reverse' : 'row',
                    },
                  ]}
                >
                  <Ionicons
                    name={on ? 'checkbox' : 'square-outline'}
                    size={20}
                    color={on ? ACCENT : colors.mutedForeground}
                  />
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        color: colors.foreground,
                        fontFamily: 'Cairo_500Medium',
                        textAlign: align,
                      }}
                      numberOfLines={1}
                    >
                      {lang === 'ar' && item.nameAr ? item.nameAr : item.name}
                    </Text>
                    <Text
                      style={{
                        color: colors.mutedForeground,
                        fontFamily: 'Almarai_400Regular',
                        fontSize: 12,
                        textAlign: align,
                      }}
                    >
                      {countStudents(item.studentCount, lang)}
                    </Text>
                  </View>
                </Pressable>
                );
              }}
            />
          )}

          <View style={[styles.actions, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
            <Pressable onPress={onClose} style={styles.btn}>
              <Text style={{ color: colors.mutedForeground, fontFamily: 'Cairo_600SemiBold' }}>
                {t('notNow')}
              </Text>
            </Pressable>
            {/* Disabled rather than hidden: a button that appears once you tick
                a row gives no hint that ticking is what the sheet wants. */}
            <Pressable
              onPress={() => {
                const picks = classes
                  .filter(c => selected.includes(c.id))
                  .map(c => ({ id: c.id, name: lang === 'ar' && c.nameAr ? c.nameAr : c.name }));
                if (picks.length > 0) onPick(picks);
              }}
              disabled={selected.length === 0}
              accessibilityState={{ disabled: selected.length === 0 }}
              style={[
                styles.btn,
                styles.confirm,
                { backgroundColor: selected.length === 0 ? colors.border : ACCENT },
              ]}
            >
              <Text
                style={{
                  color: selected.length === 0 ? colors.mutedForeground : '#fff',
                  fontFamily: 'Cairo_600SemiBold',
                }}
              >
                {t('saveToClassesConfirm')}
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
  card: { width: '100%', maxWidth: 440, borderRadius: 16, padding: 20, gap: 12 },
  title: { fontSize: 18 },
  hint: { fontSize: 13 },
  row: {
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  actions: { justifyContent: 'flex-end', alignItems: 'center', gap: 8 },
  confirm: { minWidth: 120, alignItems: 'center' },
  btn: { paddingHorizontal: 18, paddingVertical: 11, borderRadius: 10 },
});
