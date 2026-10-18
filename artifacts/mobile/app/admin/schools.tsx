/**
 * Schools — create a school, see who is in it, move teachers in and out.
 *
 * Its own admin tab (it used to be a picker on each teacher row of
 * `admin/users.tsx`). Membership decides whose exam dates a teacher can read, so
 * like the API (`routes/admin.ts`, SCHOOL_ADMIN_ROLES) it is `system_admin` only;
 * the check here only hides the screen, the server is what enforces it.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import { useAuth } from '@/context/AuthContext';
import { apiJson } from '@/services/apiClient';
import { CONTENT_MAX_WIDTH } from '@/constants/layout';
import { BackButton } from '@/components/ui/BackButton';
import { TYPE } from '@/constants/theme';

const ACCENT = '#4F46E5';
const SCHOOL_ASSIGNERS = ['system_admin'];

type SchoolRow = { id: string; name: string; teacherCount: number };
type TeacherRow = { id: string; firstName: string; lastName: string; email: string | null; schoolId: string | null; schoolName: string | null };

const nameOf = (t: TeacherRow) => `${t.firstName} ${t.lastName}`.trim() || t.email || t.id;

export default function AdminSchoolsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { isRTL, lang } = useLanguage();
  const ar = lang === 'ar';
  const { user, isLoading: authLoading } = useAuth();
  const allowed = !!user && SCHOOL_ASSIGNERS.includes(user.role);

  const [schools, setSchools] = useState<SchoolRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [newName, setNewName] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const [members, setMembers] = useState<TeacherRow[]>([]);
  const [q, setQ] = useState('');
  const [found, setFound] = useState<TeacherRow[]>([]);
  const [busy, setBusy] = useState(false);

  const loadSchools = useCallback(async () => {
    const res = await apiJson<{ items: SchoolRow[] }>('/admin/schools');
    setSchools(res.items);
  }, []);

  const loadMembers = useCallback(async (schoolId: string) => {
    const res = await apiJson<{ items: TeacherRow[] }>(`/admin/users?role=teacher&schoolId=${schoolId}`);
    setMembers(res.items);
  }, []);

  useEffect(() => {
    if (!allowed) return;
    loadSchools()
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  }, [allowed, loadSchools]);

  // Search teachers to add. Debounced like the users screen; nothing is fetched for an empty box.
  useEffect(() => {
    if (!allowed || !openId || !q.trim()) {
      setFound([]);
      return;
    }
    const t = setTimeout(() => {
      apiJson<{ items: TeacherRow[] }>(`/admin/users?role=teacher&q=${encodeURIComponent(q.trim())}`)
        .then(res => setFound(res.items))
        .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
    }, 300);
    return () => clearTimeout(t);
  }, [allowed, openId, q]);

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError('');
    try {
      await fn();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const open = (id: string) => {
    setQ('');
    setFound([]);
    setMembers([]);
    if (openId === id) {
      setOpenId(null);
      return;
    }
    setOpenId(id);
    void run(() => loadMembers(id));
  };

  const createSchool = () =>
    run(async () => {
      const name = newName.trim();
      if (!name) return;
      await apiJson('/admin/schools', { method: 'POST', body: JSON.stringify({ name }) });
      setNewName('');
      await loadSchools();
    });

  const assign = (teacher: TeacherRow, schoolId: string | null) =>
    run(async () => {
      await apiJson(`/admin/users/${teacher.id}/school`, { method: 'PUT', body: JSON.stringify({ schoolId }) });
      setQ('');
      setFound([]);
      await Promise.all([loadSchools(), openId ? loadMembers(openId) : Promise.resolve()]);
    });

  if (authLoading) {
    return <View style={[styles.center, { backgroundColor: colors.background }]}><ActivityIndicator color={ACCENT} /></View>;
  }
  if (!allowed) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.foreground, fontFamily: 'ReadexPro_600SemiBold' }}>{ar ? 'هذه الصفحة لمدير النظام فقط' : 'This page is for the system admin only'}</Text>
      </View>
    );
  }

  const align = isRTL ? 'right' : 'left';
  const row = isRTL ? 'row-reverse' : 'row';
  const caption = { color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: TYPE.caption, textAlign: align } as const;
  const chipText = (color: string) => ({ color, fontFamily: 'ReadexPro_600SemiBold', fontSize: 13 }) as const;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 60, width: '100%', maxWidth: CONTENT_MAX_WIDTH, alignSelf: 'center' }}>
        <View style={[styles.header, { paddingTop: insets.top + 20, backgroundColor: ACCENT }]}>
          <BackButton color="#fff" style={{ alignSelf: isRTL ? 'flex-end' : 'flex-start', marginBottom: 8 }} />
          <Text style={{ color: '#fff', fontFamily: 'ReadexPro_700Bold', fontSize: 20, textAlign: align }}>
            {ar ? 'المدارس' : 'Schools'}
          </Text>
        </View>

        <View style={{ margin: 20, gap: 10 }}>
          <Text style={caption}>
            {ar ? 'يرى معلمو المدرسة الواحدة مواعيد امتحانات بعضهم.' : "Teachers in one school can see each other's exam dates."}
          </Text>
          <View style={{ flexDirection: row, gap: 8, alignItems: 'center' }}>
            <TextInput
              value={newName}
              onChangeText={setNewName}
              placeholder={ar ? 'اسم مدرسة جديدة' : 'New school name'}
              placeholderTextColor={colors.mutedForeground}
              maxLength={80}
              style={[styles.input, { flex: 1, borderColor: colors.border, borderRadius: colors.radius, color: colors.foreground, textAlign: align }]}
            />
            <Pressable
              onPress={() => void createSchool()}
              disabled={busy || !newName.trim()}
              style={[styles.chip, { borderRadius: colors.radius, borderColor: ACCENT, opacity: busy || !newName.trim() ? 0.5 : 1 }]}
            >
              <Text style={chipText(ACCENT)}>{ar ? 'إضافة مدرسة' : 'Add school'}</Text>
            </Pressable>
          </View>
          {!!error && <Text style={{ color: colors.destructive, fontFamily: 'Almarai_400Regular', textAlign: align }}>{error}</Text>}

          {loading ? <ActivityIndicator color={ACCENT} /> : schools.length === 0 ? (
            <Text style={caption}>{ar ? 'لا توجد مدارس بعد.' : 'No schools yet.'}</Text>
          ) : schools.map(sc => (
            <View key={sc.id} style={[styles.card, { backgroundColor: colors.card, borderColor: openId === sc.id ? ACCENT : colors.border, borderRadius: colors.radius }]}>
              <Pressable onPress={() => open(sc.id)} style={{ flexDirection: row, alignItems: 'center', gap: 8 }}>
                <Text style={{ flex: 1, color: colors.foreground, fontFamily: 'ReadexPro_600SemiBold', fontSize: 14, textAlign: align }}>{sc.name}</Text>
                <Text style={caption}>{ar ? `${sc.teacherCount} معلم` : `${sc.teacherCount} teachers`}</Text>
              </Pressable>

              {openId === sc.id && (
                <View style={{ gap: 8 }}>
                  {members.map(m => (
                    <View key={m.id} style={{ flexDirection: row, alignItems: 'center', gap: 8 }}>
                      <Text numberOfLines={1} style={{ flex: 1, color: colors.foreground, fontFamily: 'Almarai_400Regular', fontSize: 13, textAlign: align }}>
                        {nameOf(m)}{m.email ? ` · ${m.email}` : ''}
                      </Text>
                      <Pressable disabled={busy} onPress={() => void assign(m, null)} style={[styles.chip, { borderRadius: colors.radius, borderColor: colors.destructive }]}>
                        <Text style={chipText(colors.destructive)}>{ar ? 'إزالة' : 'Remove'}</Text>
                      </Pressable>
                    </View>
                  ))}
                  {members.length === 0 && !busy && <Text style={caption}>{ar ? 'لا يوجد معلمون في هذه المدرسة.' : 'No teachers in this school yet.'}</Text>}

                  <TextInput
                    value={q}
                    onChangeText={setQ}
                    placeholder={ar ? 'ابحث عن معلم بالاسم أو البريد' : 'Find a teacher by name or email'}
                    placeholderTextColor={colors.mutedForeground}
                    style={[styles.input, { borderColor: colors.border, borderRadius: colors.radius, color: colors.foreground, textAlign: align }]}
                  />
                  {found.filter(t => t.schoolId !== sc.id).map(t => (
                    <View key={t.id} style={{ flexDirection: row, alignItems: 'center', gap: 8 }}>
                      <View style={{ flex: 1 }}>
                        <Text numberOfLines={1} style={{ color: colors.foreground, fontFamily: 'Almarai_400Regular', fontSize: 13, textAlign: align }}>
                          {nameOf(t)}{t.email ? ` · ${t.email}` : ''}
                        </Text>
                        {!!t.schoolName && <Text numberOfLines={1} style={caption}>{ar ? `حاليًا في: ${t.schoolName}` : `Currently in: ${t.schoolName}`}</Text>}
                      </View>
                      <Pressable disabled={busy} onPress={() => void assign(t, sc.id)} style={[styles.chip, { borderRadius: colors.radius, borderColor: ACCENT }]}>
                        <Text style={chipText(ACCENT)}>{t.schoolId ? (ar ? 'نقل إلى هنا' : 'Move here') : (ar ? 'إضافة' : 'Add')}</Text>
                      </Pressable>
                    </View>
                  ))}
                </View>
              )}
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  header: { paddingHorizontal: 20, paddingBottom: 20 },
  card: { padding: 12, borderWidth: 1, gap: 10 },
  chip: { paddingHorizontal: 14, paddingVertical: 7, borderWidth: 1.5 },
  input: { borderWidth: 1, paddingHorizontal: 12, paddingVertical: 9, fontFamily: 'Almarai_400Regular', fontSize: 13 },
});
