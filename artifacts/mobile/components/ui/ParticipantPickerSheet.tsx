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
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import { getTeacherContacts, type ChatRole } from '@/services/messaging';

const ACCENT = '#8B5CF6';

interface Contact {
  userId: string;
  firstName: string;
  lastName: string;
  role: ChatRole;
  studentName: string;
}

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
  const { t, isRTL } = useLanguage();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [selected, setSelected] = useState<Map<string, Contact>>(new Map());

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    setSelected(new Map());
    setLoading(true);
    setFailed(false);
    void (async () => {
      try {
        const byStudent = await getTeacherContacts();
        const seen = new Map<string, Contact>();
        for (const s of byStudent) {
          for (const c of s.contacts) {
            if (!seen.has(c.userId)) seen.set(c.userId, { ...c, studentName: s.studentName });
          }
        }
        if (!cancelled) setContacts([...seen.values()]);
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

  const excluded = new Set(excludeUserIds);
  const visible_ = contacts.filter(c => !excluded.has(c.userId));
  const align = isRTL ? 'right' : 'left';

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
              style={{ maxHeight: 360 }}
              contentContainerStyle={{ paddingHorizontal: 16, gap: 6 }}
              ListEmptyComponent={
                <Text style={[styles.hint, { color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', textAlign: 'center' }]}>
                  {t('noStudentsYet')}
                </Text>
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
  row: { alignItems: 'center', gap: 10, paddingVertical: 11, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1 },
  actions: { justifyContent: 'flex-end', gap: 8, paddingHorizontal: 16, paddingVertical: 14 },
  btn: { paddingHorizontal: 16, paddingVertical: 11, borderRadius: 10 },
  confirmBtn: { alignItems: 'center' },
});
