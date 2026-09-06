/**
 * Pick a student — class first, then a name from that class's roster.
 *
 * Two steps rather than one long list of every student a teacher has: a
 * secondary teacher has a hundred and fifty names and three Omars, and the
 * class is what tells them apart.
 *
 * Deliberately not built on `ClassPickerSheet`, which looks similar. That one
 * closes itself when a teacher has no classes, because it appears uninvited
 * after a save and a dialog offering nothing is worse than no dialog. Here the
 * teacher asked to pick someone, so an empty roster has to be *said*. Same
 * list, opposite behaviour on empty — sharing it would mean a prop that flips
 * the component's whole point.
 */
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import { getClass, listClasses, type ClassGroup, type RosterStudent } from '@/services/roster';
import { countStudents } from '@/services/i18n';

const ACCENT = '#8B5CF6';

export function StudentPickerSheet({
  visible,
  onClose,
  onPick,
}: {
  visible: boolean;
  onClose: () => void;
  /** The chosen student, carrying whatever note the teacher has written. */
  onPick: (student: RosterStudent) => void;
}) {
  const colors = useColors();
  const { t, isRTL, lang } = useLanguage();
  const [classes, setClasses] = useState<ClassGroup[]>([]);
  const [students, setStudents] = useState<RosterStudent[]>([]);
  const [openClass, setOpenClass] = useState<ClassGroup | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  // Reset to the class step each time it opens, so reopening does not land the
  // teacher inside whichever class they browsed last.
  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    setOpenClass(null);
    setStudents([]);
    setFailed(false);
    setLoading(true);
    void (async () => {
      try {
        const loaded = await listClasses();
        if (!cancelled) setClasses(loaded);
      } catch {
        // The roster is server-only (see services/roster.ts) — offline there is
        // genuinely nothing to choose from, and the teacher asked, so say so.
        if (!cancelled) setFailed(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [visible]);

  const openRoster = async (group: ClassGroup) => {
    setOpenClass(group);
    setLoading(true);
    setFailed(false);
    try {
      const { students: roster } = await getClass(group.id);
      setStudents(roster);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  };

  const align = isRTL ? 'right' : 'left';
  const className = (c: ClassGroup) => (lang === 'ar' && c.nameAr ? c.nameAr : c.name);

  const emptyLine = (text: string) => (
    <Text
      style={[
        styles.hint,
        {
          color: colors.mutedForeground,
          fontFamily: 'Almarai_400Regular',
          textAlign: 'center',
          paddingVertical: 28,
        },
      ]}
    >
      {text}
    </Text>
  );

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <View style={[styles.head, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
            {openClass ? (
              <Pressable onPress={() => setOpenClass(null)} hitSlop={10}>
                <Ionicons
                  name={isRTL ? 'arrow-forward' : 'arrow-back'}
                  size={20}
                  color={colors.mutedForeground}
                />
              </Pressable>
            ) : null}
            <Text
              style={[
                styles.title,
                {
                  color: colors.foreground,
                  fontFamily: 'Cairo_600SemiBold',
                  flex: 1,
                  textAlign: align,
                },
              ]}
            >
              {openClass ? className(openClass) : t('pickClassFirst')}
            </Text>
          </View>

          {loading ? (
            <ActivityIndicator color={ACCENT} style={{ paddingVertical: 32 }} />
          ) : failed ? (
            emptyLine(t('rosterNeedsConnection'))
          ) : !openClass ? (
            <FlatList
              data={classes}
              keyExtractor={c => c.id}
              style={{ maxHeight: 320 }}
              contentContainerStyle={{ gap: 8 }}
              ListEmptyComponent={emptyLine(t('noClassesYet'))}
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => { void openRoster(item); }}
                  style={[
                    styles.row,
                    { borderColor: colors.border, flexDirection: isRTL ? 'row-reverse' : 'row' },
                  ]}
                >
                  <Ionicons name="people-outline" size={18} color={ACCENT} />
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        color: colors.foreground,
                        fontFamily: 'Cairo_500Medium',
                        textAlign: align,
                      }}
                      numberOfLines={1}
                    >
                      {className(item)}
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
              )}
            />
          ) : (
            <FlatList
              data={students}
              keyExtractor={s => s.id}
              style={{ maxHeight: 320 }}
              contentContainerStyle={{ gap: 8 }}
              ListEmptyComponent={emptyLine(t('noStudentsYet'))}
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => onPick(item)}
                  style={[
                    styles.row,
                    { borderColor: colors.border, flexDirection: isRTL ? 'row-reverse' : 'row' },
                  ]}
                >
                  <Ionicons name="person-outline" size={18} color={ACCENT} />
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        color: colors.foreground,
                        fontFamily: 'Cairo_500Medium',
                        textAlign: align,
                      }}
                      numberOfLines={1}
                    >
                      {item.displayName}
                    </Text>
                    {item.teacherNote ? (
                      <Text
                        style={{
                          color: colors.mutedForeground,
                          fontFamily: 'Almarai_400Regular',
                          fontSize: 12,
                          textAlign: align,
                        }}
                        numberOfLines={1}
                      >
                        {item.teacherNote}
                      </Text>
                    ) : null}
                  </View>
                </Pressable>
              )}
            />
          )}

          <View style={styles.actions}>
            <Pressable onPress={onClose} style={styles.btn}>
              <Text style={{ color: colors.mutedForeground, fontFamily: 'Cairo_600SemiBold' }}>
                {t('cancel')}
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
  head: { alignItems: 'center', gap: 10 },
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
