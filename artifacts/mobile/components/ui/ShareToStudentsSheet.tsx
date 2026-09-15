import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator, FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import { getClassThread, getTeacherContacts, sendMessage, startThread } from '@/services/messaging';
import {
  buildPickerContacts, matchesQuery, toggleClassSelection,
  type PickerClass, type PickerContact,
} from '@/services/participantPicker';

const TEAL = '#1B6B62';

type Props = {
  visible: boolean;
  onClose: () => void;
  /** The media-library item to send. The server resolves it — nothing is re-uploaded. */
  libraryItemId: string;
  /** Shown in the sheet so the teacher can see what they are about to send. */
  caption?: string;
  onSent?: (recipients: number) => void;
};

/**
 * Send one piece of media to the people it is for.
 *
 * Two kinds of recipient, and the difference matters: a **class** posts once
 * into that class's own thread, where every student in it sees the same
 * message, while picking **people** opens a direct thread with each one. So
 * sending to a class of thirty is one message, not thirty — and a teacher who
 * wants to reach one struggling student individually can, without the rest of
 * the class seeing it.
 *
 * Nothing is uploaded here. `libraryItemId` goes to the server, which reuses
 * the item's existing R2 object for an upload, or appends the link for a saved
 * video (see `shareFromLibrary` in routes/messaging.ts). Sending the same
 * photo to three classes copies no bytes at all.
 *
 * Whoever mounts this must check `useStudentAccountsEnabled()` first: with the
 * STUDENT_ACCOUNTS flag off, no thread can be created and every send here
 * fails.
 */
export function ShareToStudentsSheet({ visible, onClose, libraryItemId, caption, onSent }: Props) {
  const colors = useColors();
  const { lang, isRTL } = useLanguage();
  const isAr = lang === 'ar';

  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [note, setNote] = useState('');
  const [query, setQuery] = useState('');

  const [contacts, setContacts] = useState<PickerContact[]>([]);
  const [classes, setClasses] = useState<PickerClass[]>([]);
  const [selected, setSelected] = useState<Map<string, PickerContact>>(new Map());
  const [selectedClasses, setSelectedClasses] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!visible) return;
    setError('');
    setSelected(new Map());
    setSelectedClasses(new Set());
    setNote('');
    setLoading(true);
    void (async () => {
      try {
        const built = buildPickerContacts(await getTeacherContacts());
        setContacts(built.contacts);
        setClasses(built.classes);
      } catch (e) {
        setError(e instanceof Error ? e.message : isAr ? 'تعذّر تحميل جهات الاتصال' : 'Could not load contacts');
      } finally {
        setLoading(false);
      }
    })();
  }, [visible, isAr]);

  const shown = useMemo(
    () => (query.trim() ? contacts.filter(c => matchesQuery(c, query)) : contacts),
    [contacts, query],
  );

  const togglePerson = (c: PickerContact) => {
    setSelected(prev => {
      const next = new Map(prev);
      if (next.has(c.userId)) next.delete(c.userId);
      else next.set(c.userId, c);
      return next;
    });
  };

  /**
   * A class is picked as a class — one post to its own thread — so it does NOT
   * also select its members individually. Doing both would send every student
   * the same picture twice, once in the class thread and once in a direct one.
   */
  const toggleClass = (id: string) => {
    setSelectedClasses(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const total = selected.size + selectedClasses.size;

  const send = async () => {
    if (total === 0 || sending) return;
    setSending(true);
    setError('');
    let sent = 0;
    const failures: string[] = [];

    for (const classId of selectedClasses) {
      try {
        const thread = await getClassThread(classId);
        await sendMessage(thread.id, note.trim(), undefined, libraryItemId);
        sent += 1;
      } catch {
        const cl = classes.find(c => c.id === classId);
        failures.push(isAr ? cl?.nameAr || cl?.name || classId : cl?.name || classId);
      }
    }

    for (const person of selected.values()) {
      try {
        const thread = await startThread(person.userId);
        await sendMessage(thread.id, note.trim(), undefined, libraryItemId);
        sent += 1;
      } catch {
        failures.push(`${person.firstName} ${person.lastName}`.trim());
      }
    }

    setSending(false);
    // Partial success is reported as partial: the teacher needs to know
    // exactly who did not get it, not just that "something went wrong".
    if (failures.length > 0) {
      setError(
        (isAr ? 'لم تصل إلى: ' : 'Did not reach: ') + failures.join('، '),
      );
      if (sent > 0) onSent?.(sent);
      return;
    }
    onSent?.(sent);
    onClose();
  };

  const row = { flexDirection: isRTL ? 'row-reverse' : 'row' } as const;
  const text = { textAlign: isRTL ? 'right' : 'left' } as const;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={[styles.sheet, { backgroundColor: colors.background }]}>
          <View style={[styles.header, row]}>
            <Text style={[styles.title, { color: colors.text }]}>
              {isAr ? 'مشاركة مع الطلاب' : 'Share with students'}
            </Text>
            <Pressable onPress={onClose} hitSlop={12} accessibilityLabel={isAr ? 'إغلاق' : 'Close'}>
              <Ionicons name="close" size={24} color={colors.text} />
            </Pressable>
          </View>

          {caption ? (
            <Text numberOfLines={1} style={[styles.subject, text, { color: colors.mutedForeground }]}>
              {caption}
            </Text>
          ) : null}

          {error !== '' && <Text style={[styles.error, text]}>{error}</Text>}
          {loading && <ActivityIndicator color={TEAL} style={styles.spinner} />}

          {classes.length > 0 && (
            <>
              <Text style={[styles.sectionLabel, text, { color: colors.text }]}>
                {isAr ? 'الصفوف' : 'Classes'}
              </Text>
              <View style={[styles.chips, row]}>
                {classes.map(cl => {
                  const on = selectedClasses.has(cl.id);
                  return (
                    <Pressable
                      key={cl.id}
                      onPress={() => toggleClass(cl.id)}
                      style={[
                        styles.chip,
                        { borderColor: on ? TEAL : colors.border, backgroundColor: on ? `${TEAL}18` : 'transparent' },
                      ]}
                    >
                      <Text style={[styles.chipLabel, { color: on ? TEAL : colors.text }]}>
                        {isAr ? cl.nameAr || cl.name : cl.name}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </>
          )}

          <Text style={[styles.sectionLabel, text, { color: colors.text }]}>
            {isAr ? 'أشخاص' : 'People'}
          </Text>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={isAr ? 'ابحث بالاسم…' : 'Search by name…'}
            placeholderTextColor={colors.mutedForeground}
            style={[styles.input, text, { color: colors.text, borderColor: colors.border }]}
          />
          <FlatList
            style={styles.list}
            data={shown}
            keyExtractor={c => c.userId}
            ListEmptyComponent={
              loading ? null : (
                <Text style={[styles.empty, { color: colors.mutedForeground }]}>
                  {isAr ? 'لا أحد هنا بعد.' : 'Nobody here yet.'}
                </Text>
              )
            }
            renderItem={({ item }) => {
              const on = selected.has(item.userId);
              return (
                <Pressable onPress={() => togglePerson(item)} style={[styles.person, row]}>
                  <Ionicons
                    name={on ? 'checkbox' : 'square-outline'}
                    size={20}
                    color={on ? TEAL : colors.mutedForeground}
                  />
                  <View style={styles.grow}>
                    <Text style={[styles.personName, text, { color: colors.text }]}>
                      {`${item.firstName} ${item.lastName}`.trim()}
                    </Text>
                    <Text style={[styles.personSub, text, { color: colors.mutedForeground }]}>
                      {item.studentName}
                    </Text>
                  </View>
                </Pressable>
              );
            }}
          />

          <TextInput
            value={note}
            onChangeText={setNote}
            placeholder={isAr ? 'أضف ملاحظة (اختياري)' : 'Add a note (optional)'}
            placeholderTextColor={colors.mutedForeground}
            multiline
            style={[styles.input, styles.note, text, { color: colors.text, borderColor: colors.border }]}
          />

          <Pressable
            onPress={() => void send()}
            disabled={total === 0 || sending}
            style={[styles.send, { backgroundColor: total === 0 || sending ? colors.border : TEAL }]}
          >
            {sending
              ? <ActivityIndicator color="#fff" />
              : (
                <Text style={styles.sendLabel}>
                  {isAr
                    ? total === 0 ? 'اختر مستلمًا' : `إرسال (${total})`
                    : total === 0 ? 'Pick a recipient' : `Send (${total})`}
                </Text>
              )}
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: { height: '85%', borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 16 },
  header: { alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  title: { fontSize: 18, fontWeight: '700' },
  subject: { fontSize: 13, marginBottom: 8 },
  sectionLabel: { fontSize: 14, fontWeight: '700', marginTop: 12, marginBottom: 8 },
  chips: { flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6 },
  chipLabel: { fontSize: 13, fontWeight: '600' },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, fontSize: 14 },
  note: { marginTop: 12, minHeight: 60, textAlignVertical: 'top' },
  list: { flex: 1, marginTop: 8 },
  person: { alignItems: 'center', gap: 10, paddingVertical: 10 },
  personName: { fontSize: 14, fontWeight: '600' },
  personSub: { fontSize: 12 },
  grow: { flex: 1 },
  empty: { fontSize: 13, textAlign: 'center', paddingVertical: 24 },
  error: { color: '#C4302B', fontSize: 13, marginBottom: 8 },
  spinner: { marginVertical: 8 },
  send: { marginTop: 12, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  sendLabel: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
