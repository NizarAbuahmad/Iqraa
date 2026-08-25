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
 * - **Picking is multi-select and committed by a button.** A teacher teaching
 *   the same lesson to three sections was previously finished the moment they
 *   touched a row, and had to save the material once per section. Selecting is
 *   now separate from confirming, and the material's current class starts
 *   ticked so the sheet still opens showing where it already is.
 *
 * Clearing stays its own row rather than "untick everything and confirm":
 * removing a material from its class is not the same gesture as choosing
 * classes, and an empty confirm reads as a no-op, not as a delete.
 *
 * `saved_materials.class_group_id` holds ONE class, so what the caller does
 * with several is duplicate (see `attachToClasses` in services/workspace.ts).
 * The first stays put and the rest become copies, which is why the toast says
 * copies rather than implying one shared material.
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

/** One chosen class, with its name already resolved for the active language. */
export type ClassPick = { id: string; name: string };

export function ClassPickerSheet({
  visible,
  onClose,
  onPick,
  selectedClassId = null,
  onClear,
  multiple = false,
}: {
  visible: boolean;
  /** Dismissed, or nothing to choose from. The material stays unattached. */
  onClose: () => void;
  /**
   * The teacher confirmed their selection — never empty, and in roster order.
   * Display names come back resolved for the active language so callers do not
   * each repeat the nameAr fallback.
   */
  onPick: (picks: ClassPick[]) => void;
  /** The class this material is in already, ticked and named as the current one. */
  selectedClassId?: string | null;
  /**
   * Let the teacher tick several classes and commit with a button.
   *
   * Off by default, and deliberately not everywhere: a *material* can be
   * copied into three sections (`attachToClasses` duplicates it), but an
   * *evaluation* has one class and no copy semantics — offering it checkboxes
   * would let a teacher tick three and silently keep one.
   */
  multiple?: boolean;
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
  const [selected, setSelected] = useState<string[]>([]);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    setLoading(true);
    // Seeded from the current class, not carried over: the sheet should open
    // showing where this material already is, and a fresh material must not
    // inherit whatever the previous one happened to pick.
    setSelected(selectedClassId ? [selectedClassId] : []);
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
                const on = selected.includes(item.id);
                return (
                <Pressable
                  onPress={() => {
                    if (!multiple) {
                      // Single-pick keeps the behaviour it had: tapping the
                      // class it is already in is a no-op, so just close.
                      if (current) onClose();
                      else onPick([{ id: item.id, name: className(item, lang) }]);
                      return;
                    }
                    setSelected(cur =>
                      cur.includes(item.id) ? cur.filter(id => id !== item.id) : [...cur, item.id],
                    );
                  }}
                  style={[
                    styles.row,
                    {
                      borderColor: (multiple ? on : current) ? ACCENT : colors.border,
                      backgroundColor: (multiple ? on : current) ? ACCENT + '12' : 'transparent',
                      flexDirection: isRTL ? 'row-reverse' : 'row',
                    },
                  ]}
                  accessibilityRole={multiple ? 'checkbox' : 'button'}
                  accessibilityState={multiple ? { checked: on } : { selected: current }}
                >
                  <Ionicons
                    name={multiple ? (on ? 'checkbox' : 'square-outline') : (current ? 'checkmark-circle' : 'people-outline')}
                    size={multiple ? 20 : 18}
                    color={!multiple || on ? ACCENT : colors.mutedForeground}
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
                        color: current ? ACCENT : colors.mutedForeground,
                        fontFamily: 'Almarai_400Regular',
                        fontSize: 12,
                        textAlign: align,
                      }}
                    >
                      {current
                        ? `${t('currentClassTag')} · ${countStudents(item.studentCount, lang)}`
                        : countStudents(item.studentCount, lang)}
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

          <View style={[styles.actions, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
            <Pressable onPress={onClose} style={styles.btn}>
              <Text style={{ color: colors.mutedForeground, fontFamily: 'Cairo_600SemiBold' }}>
                {t('notNow')}
              </Text>
            </Pressable>
            {/* Disabled rather than hidden: a button that appears once you tick
                a row gives no hint that ticking is what the sheet wants. */}
            {multiple ? (
            <Pressable
              onPress={() => {
                const picks = classes
                  .filter(c => selected.includes(c.id))
                  .map(c => ({ id: c.id, name: className(c, lang) }));
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
            ) : null}
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
