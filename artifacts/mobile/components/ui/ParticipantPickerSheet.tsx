/**
 * Multi-select contact picker for a teacher building or growing a custom
 * group. Same data source as the compose sheet in notifications.tsx
 * (getTeacherContacts, grouped by student) — a group can only ever contain
 * people the teacher is already connected to, same trust boundary the
 * server enforces on POST /messaging/threads/custom (see routes/messaging.ts).
 *
 * Not built on StudentPickerSheet: that one picks a single student two steps
 * deep (class, then name); this needs a flat, checkbox-multi-select list of
 * *contacts* (parents and students both), so the two share no useful shape.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import { getTeacherContacts } from '@/services/messaging';
import { useStudentAccountsEnabled } from '@/services/features';
import {
  buildPickerContacts,
  matchesQuery,
  toggleClassSelection,
  type PickerClass,
  type PickerContact,
} from '@/services/participantPicker';

const ACCENT = '#8B5CF6';

type Contact = PickerContact;
type ClassOption = PickerClass;

export function ParticipantPickerSheet({
  visible,
  onClose,
  onConfirm,
  excludeUserIds = [],
}: {
  visible: boolean;
  onClose: () => void;
  onConfirm: (picked: { userId: string; firstName: string; lastName: string }[]) => void;
  /** Already in the group — hidden from the list rather than shown pre-checked. */
  excludeUserIds?: string[];
}) {
  const colors = useColors();
  const { t, isRTL, lang } = useLanguage();
  const studentAccounts = useStudentAccountsEnabled();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [selected, setSelected] = useState<Map<string, Contact>>(new Map());

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    setSelected(new Map());
    setQuery('');
    setLoading(true);
    setFailed(false);
    void (async () => {
      try {
        const built = buildPickerContacts(await getTeacherContacts());
        if (!cancelled) {
          setContacts(built.contacts);
          setClasses(built.classes);
        }
      } catch {
        if (!cancelled) setFailed(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [visible]);

  const excluded = useMemo(() => new Set(excludeUserIds), [excludeUserIds]);
  const align = isRTL ? 'right' : 'left';

  /** Everyone addable, before the search box narrows it. Class selection works off this, not the filtered view. */
  const addable = useMemo(
    () => contacts.filter(c => !excluded.has(c.userId)),
    [contacts, excluded],
  );

  const visible_ = useMemo(
    () => (query ? addable.filter(c => matchesQuery(c, query)) : addable),
    [addable, query],
  );

  /**
   * A class chip selects everyone in that class, ignoring the search box: the
   * two controls answer different questions ("find one person" vs "add all of
   * 10-أ"), and intersecting them would silently add a subset while the chip
   * still read as the whole class.
   *
   * Empty classes are dropped — a chip that selects nobody looks broken. That
   * is common here, since a class only appears once one of its students or
   * parents holds an account.
   */
  const classChips = useMemo(
    () =>
      classes
        .map(cl => ({ ...cl, members: addable.filter(c => c.classIds.includes(cl.id)) }))
        .filter(cl => cl.members.length > 0),
    [classes, addable],
  );

  const toggleClass = (members: Contact[]) => {
    setSelected(prev => toggleClassSelection(prev, members));
  };

  const toggle = (c: Contact) => {
    setSelected(prev => {
      const next = new Map(prev);
      if (next.has(c.userId)) next.delete(c.userId);
      else next.set(c.userId, c);
      return next;
    });
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={[styles.sheet, { backgroundColor: colors.background }]} onPress={e => e.stopPropagation()}>
          <View style={[styles.head, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
            <Text style={[styles.title, { color: colors.foreground, fontFamily: 'Cairo_600SemiBold', flex: 1, textAlign: align }]}>
              {t('messagingPickMembers')}
            </Text>
            <Pressable onPress={onClose} hitSlop={10}>
              <Ionicons name="close" size={22} color={colors.mutedForeground} />
            </Pressable>
          </View>

          {/* Search and class chips only once there is a list worth narrowing —
              on an empty or failed load they would be controls over nothing. */}
          {!loading && !failed && addable.length > 0 ? (
            <View style={{ gap: 10 }}>
              <View
                style={[
                  styles.searchWrap,
                  { borderColor: colors.border, backgroundColor: colors.muted, flexDirection: isRTL ? 'row-reverse' : 'row' },
                ]}
              >
                <Ionicons name="search" size={16} color={colors.mutedForeground} />
                <TextInput
                  value={query}
                  onChangeText={setQuery}
                  placeholder={t('messagingSearchContacts')}
                  placeholderTextColor={colors.mutedForeground}
                  style={[styles.searchInput, { color: colors.foreground, textAlign: align }]}
                  autoCorrect={false}
                />
                {query ? (
                  <Pressable onPress={() => setQuery('')} hitSlop={8}>
                    <Ionicons name="close-circle" size={16} color={colors.mutedForeground} />
                  </Pressable>
                ) : null}
              </View>

              {classChips.length > 0 ? (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={[styles.chipRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}
                >
                  {classChips.map(cl => {
                    const allPicked = cl.members.every(m => selected.has(m.userId));
                    return (
                      <Pressable
                        key={cl.id}
                        onPress={() => toggleClass(cl.members)}
                        style={[
                          styles.chip,
                          {
                            borderColor: allPicked ? ACCENT : colors.border,
                            backgroundColor: allPicked ? `${ACCENT}14` : 'transparent',
                            flexDirection: isRTL ? 'row-reverse' : 'row',
                          },
                        ]}
                      >
                        <Ionicons
                          name={allPicked ? 'checkmark-circle' : 'add-circle-outline'}
                          size={14}
                          color={allPicked ? ACCENT : colors.mutedForeground}
                        />
                        <Text
                          style={{
                            color: allPicked ? ACCENT : colors.foreground,
                            fontFamily: 'Cairo_500Medium',
                            fontSize: 12,
                          }}
                          numberOfLines={1}
                        >
                          {(lang === 'ar' && cl.nameAr ? cl.nameAr : cl.name)} ({cl.members.length})
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              ) : null}
            </View>
          ) : null}

          {loading ? (
            <ActivityIndicator color={ACCENT} style={{ paddingVertical: 32 }} />
          ) : failed ? (
            <Text style={[styles.hint, { color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', textAlign: 'center' }]}>
              {t('rosterNeedsConnection')}
            </Text>
          ) : (
            <FlatList
              data={visible_}
              keyExtractor={c => c.userId}
              // flexShrink so the list yields first when the sheet hits its 75%
              // cap. Without it, adding the search box and class chips above
              // pushes the confirm button off the bottom on a short screen —
              // the sheet does not scroll as a whole, so it would just be gone.
              style={{ maxHeight: 360, flexShrink: 1 }}
              contentContainerStyle={{ paddingHorizontal: 16, gap: 6 }}
              /*
                This list is people who hold an account, not people on the
                roster. It used to say "no students in this class", which is
                false the moment a teacher has a roster — they do have
                students, those students just have not signed up. Read as
                "adding is broken" rather than "they need a code first", so it
                now says what is actually missing and where to get it.
              */
              ListEmptyComponent={
                // "Nobody has an account yet" and "your search matched nobody"
                // are opposite problems that both render as a blank list. Only
                // the first one is about claim codes; telling a teacher who
                // mistyped a name to go and mint a code sends them away from a
                // list that does contain the person they want.
                query ? (
                  <View style={{ paddingVertical: 24, paddingHorizontal: 16 }}>
                    <Text style={[styles.hint, { paddingVertical: 0, color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', textAlign: 'center' }]}>
                      {t('messagingNoSearchMatch')}
                    </Text>
                  </View>
                ) : (
                  <View style={{ paddingVertical: 24, paddingHorizontal: 16, gap: 6 }}>
                    <Text style={[styles.emptyTitle, { color: colors.foreground, fontFamily: 'Cairo_500Medium', textAlign: 'center' }]}>
                      {t('messagingNoContactsTitle')}
                    </Text>
                    <Text
                      style={[
                        styles.hint,
                        // styles.hint carries its own vertical padding for the
                        // failure message above; the wrapper supplies it here.
                        { paddingVertical: 0, lineHeight: 20, color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', textAlign: 'center' },
                      ]}
                    >
                      {studentAccounts ? t('messagingNoContactsDesc') : t('messagingDisabledDesc')}
                    </Text>
                  </View>
                )
              }
              renderItem={({ item }) => {
                const checked = selected.has(item.userId);
                return (
                  <Pressable
                    onPress={() => toggle(item)}
                    style={[
                      styles.row,
                      { borderColor: checked ? ACCENT : colors.border, backgroundColor: checked ? `${ACCENT}14` : 'transparent', flexDirection: isRTL ? 'row-reverse' : 'row' },
                    ]}
                  >
                    <Ionicons name={checked ? 'checkbox' : 'square-outline'} size={20} color={checked ? ACCENT : colors.mutedForeground} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: colors.foreground, fontFamily: 'Cairo_500Medium', textAlign: align }} numberOfLines={1}>
                        {item.firstName} {item.lastName}
                      </Text>
                      <Text style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: 12, textAlign: align }} numberOfLines={1}>
                        {item.role === 'student' ? t('roleStudent') : t('roleParent')} · {item.studentName}
                      </Text>
                    </View>
                  </Pressable>
                );
              }}
            />
          )}

          <View style={[styles.actions, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
            <Pressable onPress={onClose} style={styles.btn}>
              <Text style={{ color: colors.mutedForeground, fontFamily: 'Cairo_600SemiBold' }}>{t('cancel')}</Text>
            </Pressable>
            <Pressable
              onPress={() => onConfirm([...selected.values()])}
              disabled={selected.size === 0}
              style={[styles.btn, styles.confirmBtn, { backgroundColor: selected.size > 0 ? colors.primary : colors.muted }]}
            >
              <Text style={{ color: selected.size > 0 ? colors.primaryForeground : colors.mutedForeground, fontFamily: 'Cairo_600SemiBold' }}>
                {t('messagingAddSelected')} {selected.size > 0 ? `(${selected.size})` : ''}
              </Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: { maxHeight: '75%', borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingTop: 16, gap: 12 },
  head: { alignItems: 'center', paddingHorizontal: 16 },
  title: { fontSize: 17 },
  hint: { fontSize: 13, paddingVertical: 28, paddingHorizontal: 16 },
  emptyTitle: { fontSize: 14 },
  searchWrap: { alignItems: 'center', gap: 8, marginHorizontal: 16, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 10, borderWidth: 1 },
  // No explicit height: the row sizes to the input, and a fixed one clips
  // Cairo's Arabic descenders.
  searchInput: { flex: 1, fontFamily: 'Almarai_400Regular', fontSize: 14, padding: 0 },
  chipRow: { gap: 6, paddingHorizontal: 16 },
  chip: { alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 14, borderWidth: 1 },
  row: { alignItems: 'center', gap: 10, paddingVertical: 11, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1 },
  actions: { justifyContent: 'flex-end', gap: 8, paddingHorizontal: 16, paddingVertical: 14 },
  btn: { paddingHorizontal: 16, paddingVertical: 11, borderRadius: 10 },
  confirmBtn: { alignItems: 'center' },
});
