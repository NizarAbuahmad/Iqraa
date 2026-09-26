/**
 * Library upload — where Iqraa staff publish ready-made resources.
 *
 * Grade → subject → lesson (optional) → category → title, then a file (up to
 * 25 MB, straight to storage) or a link (long videos, online games). Below the
 * form, what is already published for the grade, with delete.
 *
 * Role-gated client-side for the UI only; the server enforces `system_admin`
 * on every write (api-server routes/library.ts).
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View, type TextStyle } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';

import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import { useAuth } from '@/context/AuthContext';
import { PickerField } from '@/components/ui/PickerField';
import { confirm } from '@/services/confirm';
import { goBack } from '@/services/navigation';
import { getLessonsForUnit, getUnitsForSubjectGrade } from '@/services/knowledgeBase';
import {
  LIBRARY_CATEGORIES,
  MAX_LIBRARY_FILE_BYTES,
  addLibraryLink,
  deleteLibraryItem,
  listLibrary,
  updateLibraryItem,
  uploadLibraryFile,
  type LibraryCategory,
  type LibraryItem,
} from '@/services/libraryApi';
import type { TranslationKey } from '@/services/i18n';
import { getSubjectsForGrade, getVisibleGrades } from '@workspace/curriculum';
import { palette } from '@/constants/colors';

const ACCENT = palette.primary;

const CATEGORY_LABEL: Record<LibraryCategory, TranslationKey> = {
  infographic: 'libraryCatInfographic',
  video: 'libraryCatVideo',
  audio: 'libraryCatAudio',
  game: 'libraryCatGame',
  worksheet: 'libraryCatWorksheet',
  template: 'libraryCatTemplate',
  presentation: 'libraryCatPresentation',
  document: 'libraryCatDocument',
  image: 'libraryCatImage',
};

type Picked = { name: string; mimeType: string; size: number; uri: string; file?: File };

export default function LibraryAdminScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { t, isRTL, lang } = useLanguage();
  const { user } = useAuth();
  const params = useLocalSearchParams<{ gradeId?: string }>();
  const align = isRTL ? 'right' : 'left';

  const grades = getVisibleGrades();
  const [gradeIdx, setGradeIdx] = useState(() => Math.max(0, grades.findIndex(g => g.id === params.gradeId)));
  const gradeId = grades[gradeIdx]?.id ?? '';
  const subjects = useMemo(() => getSubjectsForGrade(gradeId), [gradeId]);
  const [subjectIdx, setSubjectIdx] = useState(0);
  const subjectId = subjects[subjectIdx]?.id ?? '';
  const lessons = useMemo(
    () => getUnitsForSubjectGrade(subjectId, gradeId).flatMap(u => getLessonsForUnit(u.id)),
    [subjectId, gradeId],
  );
  const [scope, setScope] = useState<'all' | 'semester-1' | 'semester-2' | 'lesson'>('all');
  const [lessonIdx, setLessonIdx] = useState(0);
  const [category, setCategory] = useState<LibraryCategory>('infographic');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [thumbnailUrl, setThumbnailUrl] = useState('');
  const [mode, setMode] = useState<'file' | 'link'>('file');
  const [picked, setPicked] = useState<Picked | null>(null);
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [existing, setExisting] = useState<LibraryItem[]>([]);
  /** Item currently being edited — null means "add new". */
  const [editingId, setEditingId] = useState<string | null>(null);

  const reload = useCallback(() => {
    void listLibrary(gradeId).then(setExisting);
  }, [gradeId]);
  useEffect(reload, [reload]);

  // A lesson belongs to one subject; a subject list belongs to one grade.
  useEffect(() => { setSubjectIdx(0); }, [gradeId]);
  useEffect(() => { setLessonIdx(0); setScope('all'); }, [subjectId, gradeId]);

  if (user?.role !== 'system_admin') {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular' }}>{t('libraryAdminNotAllowed')}</Text>
      </View>
    );
  }

  const startEdit = (item: LibraryItem) => {
    setEditingId(item.id);
    setTitle(item.titleAr);
    setDescription(item.description ?? '');
    setCategory(item.category);
    setThumbnailUrl(item.thumbnailUrl ?? '');
    const s = item.semester;
    setScope(s === 1 ? 'semester-1' : s === 2 ? 'semester-2' : item.lessonId ? 'lesson' : 'all');
    setMode('link');
    setMessage(null);
    // Scroll to top handled by the ScrollView ref if needed — omit for now.
  };

  const cancelEdit = () => {
    setEditingId(null);
    setTitle('');
    setDescription('');
    setThumbnailUrl('');
    setPicked(null);
    setUrl('');
    setMessage(null);
  };

  const pickFile = async () => {
    const result = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true, multiple: false });
    if (result.canceled || !result.assets?.[0]) return;
    const a = result.assets[0];
    setPicked({ name: a.name, mimeType: a.mimeType ?? '', size: a.size ?? 0, uri: a.uri, file: a.file });
    if (!title.trim()) setTitle(a.name.replace(/\.[^.]+$/, ''));
    setMessage(null);
  };

  const save = async () => {
    setMessage(null);
    const meta = {
      gradeId,
      subjectId,
      lessonId: scope === 'lesson' ? (lessons[lessonIdx]?.id ?? null) : null,
      semester: scope === 'semester-1' ? (1 as const) : scope === 'semester-2' ? (2 as const) : null,
      category,
      titleAr: title.trim(),
      description: description.trim(),
      thumbnailUrl: thumbnailUrl.trim() || null,
    };
    if (!editingId && (!meta.gradeId || !meta.subjectId || !meta.titleAr || (mode === 'file' ? !picked : !url.trim()))) {
      setMessage({ ok: false, text: t('libraryAdminMissing') });
      return;
    }
    if (!editingId && mode === 'file' && picked && picked.size > MAX_LIBRARY_FILE_BYTES) {
      setMessage({ ok: false, text: t('libraryAdminTooBig') });
      return;
    }
    if (editingId && !meta.titleAr) {
      setMessage({ ok: false, text: t('libraryAdminMissing') });
      return;
    }
    setBusy(true);
    try {
      if (editingId) {
        await updateLibraryItem(editingId, {
          titleAr: meta.titleAr,
          description: meta.description,
          category: meta.category,
          thumbnailUrl: meta.thumbnailUrl ?? null,
          semester: meta.semester,
        });
        setEditingId(null);
      } else if (mode === 'file' && picked) {
        // Web hands back a File; native a file:// uri that fetch turns into a Blob.
        const blob = picked.file ?? (await (await fetch(picked.uri)).blob());
        await uploadLibraryFile(meta, blob, picked.mimeType || blob.type);
      } else {
        await addLibraryLink(meta, url.trim());
      }
      setMessage({ ok: true, text: t('libraryAdminSaved') });
      setTitle('');
      setDescription('');
      setPicked(null);
      setUrl('');
      setThumbnailUrl('');
      reload();
    } catch (err) {
      setMessage({ ok: false, text: err instanceof Error ? err.message : String(err) });
    } finally {
      setBusy(false);
    }
  };

  const remove = async (item: LibraryItem) => {
    const ok = await confirm({
      title: t('libraryAdminDeleteConfirm'),
      message: item.titleAr,
      confirmLabel: t('libraryAdminDelete'),
      cancelLabel: t('cancel'),
      destructive: true,
    });
    if (!ok) return;
    if (await deleteLibraryItem(item.id)) reload();
  };

  const input: TextStyle[] = [
    styles.input,
    { color: colors.foreground, backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius, textAlign: align },
  ];
  const label: TextStyle[] = [styles.label, { color: colors.foreground, textAlign: align }];

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ padding: 20, paddingTop: insets.top + 16, paddingBottom: 60, maxWidth: 720, width: '100%', alignSelf: 'center' }}
    >
      <View style={[styles.header, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
        <Pressable onPress={() => goBack()} hitSlop={10}>
          <Ionicons name={isRTL ? 'arrow-forward' : 'arrow-back'} size={22} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.title, { color: colors.foreground, textAlign: align }]}>{t('libraryAdminTitle')}</Text>
      </View>

      <PickerField
        label={t('libraryAdminGrade')}
        value={lang === 'ar' ? grades[gradeIdx]?.nameAr ?? '' : grades[gradeIdx]?.name ?? ''}
        options={grades.map(g => (lang === 'ar' ? g.nameAr : g.name))}
        onChange={setGradeIdx}
        colors={colors}
        isRTL={isRTL}
        accent={ACCENT}
      />
      <PickerField
        label={t('libraryAdminSubject')}
        value={lang === 'ar' ? subjects[subjectIdx]?.nameAr ?? '' : subjects[subjectIdx]?.name ?? ''}
        options={subjects.map(s => (lang === 'ar' ? s.nameAr : s.name))}
        onChange={setSubjectIdx}
        colors={colors}
        isRTL={isRTL}
        accent={ACCENT}
      />
      <Text style={label}>{t('libraryAdminScope')}</Text>
      <View style={[styles.chips, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
        {(['all', 'semester-1', 'semester-2', 'lesson'] as const).map(s => (
          <Pressable
            key={s}
            onPress={() => setScope(s)}
            accessibilityRole="button"
            accessibilityState={{ selected: s === scope }}
            style={[styles.chip, { backgroundColor: s === scope ? ACCENT : colors.muted }]}
          >
            <Text style={{ color: s === scope ? palette.primaryForeground : colors.mutedForeground, fontFamily: 'Cairo_600SemiBold', fontSize: 13 }}>
              {s === 'all' ? t('libraryAdminScopeAll') : s === 'semester-1' ? t('libraryAdminScopeS1') : s === 'semester-2' ? t('libraryAdminScopeS2') : t('libraryAdminScopeLesson')}
            </Text>
          </Pressable>
        ))}
      </View>
      {scope === 'lesson' ? (
        <PickerField
          label={t('libraryAdminLesson')}
          value={lessons[lessonIdx]?.titleAr ?? ''}
          options={lessons.map(l => l.titleAr)}
          onChange={setLessonIdx}
          colors={colors}
          isRTL={isRTL}
          accent={ACCENT}
          maxHeight={320}
        />
      ) : null}

      <Text style={label}>{t('libraryAdminCategory')}</Text>
      <View style={[styles.chips, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
        {LIBRARY_CATEGORIES.map(c => (
          <Pressable
            key={c}
            onPress={() => setCategory(c)}
            accessibilityRole="button"
            accessibilityState={{ selected: c === category }}
            style={[styles.chip, { backgroundColor: c === category ? ACCENT : colors.muted }]}
          >
            <Text style={{ color: c === category ? palette.primaryForeground : colors.mutedForeground, fontFamily: 'Cairo_600SemiBold', fontSize: 13 }}>
              {t(CATEGORY_LABEL[c])}
            </Text>
          </Pressable>
        ))}
      </View>

      <Text style={label}>{t('libraryAdminItemTitle')}</Text>
      <TextInput value={title} onChangeText={setTitle} style={input} maxLength={200} />
      <Text style={label}>{t('libraryAdminDescription')}</Text>
      <TextInput value={description} onChangeText={setDescription} style={[...input, { minHeight: 70 }]} multiline maxLength={1000} />
      <Text style={label}>{t('libraryAdminThumbnail')}</Text>
      <TextInput value={thumbnailUrl} onChangeText={setThumbnailUrl} style={input} autoCapitalize="none" keyboardType="url" placeholder="https://" />

      <View style={[styles.chips, { flexDirection: isRTL ? 'row-reverse' : 'row', marginTop: 8 }]}>
        {(['file', 'link'] as const).map(m => (
          <Pressable
            key={m}
            onPress={() => setMode(m)}
            style={[styles.chip, { backgroundColor: m === mode ? ACCENT : colors.muted }]}
          >
            <Text style={{ color: m === mode ? palette.primaryForeground : colors.mutedForeground, fontFamily: 'Cairo_600SemiBold', fontSize: 13 }}>
              {t(m === 'file' ? 'libraryAdminFile' : 'libraryAdminLink')}
            </Text>
          </Pressable>
        ))}
      </View>

      {mode === 'file' ? (
        <View style={{ gap: 6 }}>
          <Pressable onPress={pickFile} style={[styles.pickBtn, { borderColor: ACCENT, borderRadius: colors.radius, flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
            <Ionicons name="cloud-upload-outline" size={20} color={ACCENT} />
            <Text numberOfLines={1} style={{ color: ACCENT, fontFamily: 'Cairo_600SemiBold', flexShrink: 1 }}>
              {picked ? `${picked.name} · ${(picked.size / 1024 / 1024).toFixed(1)} MB` : t('libraryAdminPickFile')}
            </Text>
          </Pressable>
          <Text style={[styles.hint, { color: colors.mutedForeground, textAlign: align }]}>{t('libraryAdminFileHint')}</Text>
        </View>
      ) : (
        <>
          <Text style={label}>{t('libraryAdminUrl')}</Text>
          <TextInput value={url} onChangeText={setUrl} style={input} autoCapitalize="none" keyboardType="url" placeholder="https://" />
        </>
      )}

      {message ? (
        <Text style={[styles.hint, { color: message.ok ? colors.primary : '#B42318', textAlign: align, marginTop: 10 }]}>{message.text}</Text>
      ) : null}

      {editingId ? (
        <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', gap: 10, marginTop: 16, marginBottom: 28 }}>
          <Pressable
            onPress={save}
            disabled={busy}
            style={[styles.saveBtn, { flex: 1, margin: 0, backgroundColor: palette.hero, borderRadius: colors.radius, opacity: busy ? 0.7 : 1 }]}
          >
            {busy ? <ActivityIndicator color="#fff" /> : null}
            <Text style={{ color: '#fff', fontFamily: 'Cairo_700Bold', fontSize: 15 }}>
              {busy ? t('libraryAdminSaving') : t('libraryAdminEditSave')}
            </Text>
          </Pressable>
          <Pressable
            onPress={cancelEdit}
            style={[styles.saveBtn, { margin: 0, backgroundColor: colors.muted, borderRadius: colors.radius }]}
          >
            <Text style={{ color: colors.mutedForeground, fontFamily: 'Cairo_700Bold', fontSize: 15 }}>{t('cancel')}</Text>
          </Pressable>
        </View>
      ) : (
        <Pressable
          onPress={save}
          disabled={busy}
          style={[styles.saveBtn, { backgroundColor: palette.hero, borderRadius: colors.radius, opacity: busy ? 0.7 : 1 }]}
        >
          {busy ? <ActivityIndicator color="#fff" /> : null}
          <Text style={{ color: '#fff', fontFamily: 'Cairo_700Bold', fontSize: 15 }}>
            {busy ? t('libraryAdminSaving') : t('libraryAdminSave')}
          </Text>
        </Pressable>
      )}

      <Text style={[styles.sectionTitle, { color: colors.foreground, textAlign: align }]}>
        {t('libraryAdminExisting')} · {existing.length}
      </Text>
      {existing.map(item => (
        <View
          key={item.id}
          style={[styles.row, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius, flexDirection: isRTL ? 'row-reverse' : 'row' }]}
        >
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.foreground, fontFamily: 'Cairo_600SemiBold', textAlign: align }}>{item.titleAr}</Text>
            <Text style={[styles.hint, { color: colors.mutedForeground, textAlign: align }]}>
              {t(CATEGORY_LABEL[item.category] ?? 'libraryCatDocument')} · {item.subjectId}
              {item.lessonId ? ` · ${item.lessonId}` : ''}
            </Text>
          </View>
          <Pressable onPress={() => startEdit(item)} hitSlop={8} accessibilityLabel={t('libraryAdminEditSave')}>
            <Ionicons name="pencil-outline" size={18} color={ACCENT} />
          </Pressable>
          <Pressable onPress={() => remove(item)} hitSlop={8} accessibilityLabel={t('libraryAdminDelete')}>
            <Ionicons name="trash-outline" size={18} color="#B42318" />
          </Pressable>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  header: { alignItems: 'center', gap: 12, marginBottom: 18 },
  title: { flex: 1, fontSize: 20, fontFamily: 'Cairo_700Bold' },
  label: { fontSize: 14, fontFamily: 'Cairo_500Medium', marginBottom: 6, marginTop: 6 },
  input: { borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, fontFamily: 'Almarai_400Regular', marginBottom: 8 },
  chips: { flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  chip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20 },
  pickBtn: { alignItems: 'center', gap: 10, borderWidth: 1.5, borderStyle: 'dashed', padding: 16 },
  hint: { fontSize: 12, lineHeight: 18, fontFamily: 'Almarai_400Regular' },
  saveBtn: { flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', paddingVertical: 14, marginTop: 16, marginBottom: 28 },
  sectionTitle: { fontSize: 15, fontFamily: 'Cairo_700Bold', marginBottom: 10 },
  row: { alignItems: 'center', gap: 10, borderWidth: 1, padding: 12, marginBottom: 8 },
});
