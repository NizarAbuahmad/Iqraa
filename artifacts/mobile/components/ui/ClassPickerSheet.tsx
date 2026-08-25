/**
 * "Which class is this for?" — the one place a material's class is chosen.
 *
 * Asking here rather than adding a class field to every generator form: there
 * are seven save sites and they all have crowded layouts, but they all end the
 * same way, with an id in hand. One sheet, opened on that id, covers them all.
 *
 * It used to be strictly one-shot: opened once on first save, no current
 * selection shown, no way to clear. So a teacher who picked the wrong class had
 * no route back — the sheet never reopened, the screen never said which class
 * the material went to, and the class screen's attach list deliberately hides
 * already-attached materials, so the other class could not claim it either. The
 * only exit was Remove, buried in the old class's الموارد tab. It now takes the
 * current selection and can clear it, and `MaterialClassField` reopens it.
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
 */
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import { listClasses, type ClassGroup } from '@/services/roster';
import { className } from '@/services/materialClass';
import { countStudents } from '@/services/i18n';

const ACCENT = '#1B6B62';

export function ClassPickerSheet({
  visible,
  onClose,
  onPick,
  selectedClassId = null,
  onClear,
}: {
  visible: boolean;
  /** Dismissed, or nothing to choose from. The material stays unattached. */
  onClose: () => void;
  /**
   * The teacher chose a class. The display name comes back resolved for the
   * active language so callers do not each repeat the nameAr fallback.
   */
  onPick: (classId: string, displayName: string) => void;
  /** The class this material is in already, ticked and named as the current one. */
  selectedClassId?: string | null;
  /**
   * Take the material out of its class. The row only appears when there is a
   * selection to undo — "remove from class" on an unfiled material is an
   * action with no effect, offered to someone who did not ask for it.
   */
  onClear?: () => void;
}) {
  const colors = useColors();
  const { t, isRTL, lang } = useLanguage();
  const [classes, setClasses] = useState<ClassGroup[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    setLoading(true);
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
            {selectedClassId ? t('changeClassTitle') : t('saveToClassTitle')}
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
                const current = item.id === selectedClassId;
                return (
                <Pressable
                  onPress={() => (current ? onClose() : onPick(item.id, className(item, lang)))}
                  style={[
                    styles.row,
                    {
                      borderColor: current ? ACCENT : colors.border,
                      backgroundColor: current ? ACCENT + '12' : 'transparent',
                      flexDirection: isRTL ? 'row-reverse' : 'row',
                    },
                  ]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: current }}
                >
                  <Ionicons
                    name={current ? 'checkmark-circle' : 'people-outline'}
                    size={18}
                    color={ACCENT}
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
                      {className(item, lang)}
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

          {/* Only with something to undo — see `onClear`. */}
          {!loading && selectedClassId && onClear ? (
            <Pressable
              onPress={onClear}
              style={[
                styles.row,
                { borderColor: colors.border, flexDirection: isRTL ? 'row-reverse' : 'row' },
              ]}
              accessibilityRole="button"
            >
              <Ionicons name="close-circle-outline" size={18} color={colors.mutedForeground} />
              <Text
                style={{
                  color: colors.mutedForeground,
                  fontFamily: 'Cairo_500Medium',
                  flex: 1,
                  textAlign: align,
                }}
              >
                {t('removeFromClass')}
              </Text>
            </Pressable>
          ) : null}

          <View style={styles.actions}>
            <Pressable onPress={onClose} style={styles.btn}>
              <Text style={{ color: colors.mutedForeground, fontFamily: 'Cairo_600SemiBold' }}>
                {t('notNow')}
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
  actions: { flexDirection: 'row', justifyContent: 'flex-end' },
  btn: { paddingHorizontal: 18, paddingVertical: 11, borderRadius: 10 },
});
