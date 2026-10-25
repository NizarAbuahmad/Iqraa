/**
 * «صور الكتاب» — the student books' figures as folders: grade → subject →
 * lesson → the pictures. Reached from the library's front row.
 *
 * One route, and the depth is in the params (`gradeId`, `subjectId`,
 * `lessonId`): opening a folder pushes the same screen one level deeper, so
 * the back button is the way up and every folder has its own URL.
 *
 * Grades and subjects are narrowed the way the library narrows them, and a
 * folder with no pictures is not shown. What a lesson's folder holds is
 * exactly what its slides and exports show (`bookFigureRefsForLesson`).
 */
import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { useLightStatusBar } from '@/hooks/useLightStatusBar';
import { useLanguage } from '@/context/LanguageContext';
import { isTeacherRole, useAuth } from '@/context/AuthContext';
import { getSubjectsForGrade, getVisibleGrades } from '@workspace/curriculum';
import { narrowSubjectsForGrade, narrowToSelection } from '@/services/teacherCatalogFilter';
import { imageCountByGrade, imageCountBySubject, imageLessons } from '@/services/bookImageFolders';
import { bookFigureRefsForLesson } from '@/services/bookFigureUri';
import { getLessonById } from '@/services/knowledgeBase';
import { palette } from '@/constants/colors';
import { CONTENT_MAX_WIDTH } from '@/constants/layout';
import { BackButton } from '@/components/ui/BackButton';
import { Band } from '@/components/ui/Band';
import { TapToEnlarge } from '@/components/ui/ImageViewer';

type Folder = { id: string; label: string; count: number; heading?: string };

const GAP = 12;

export default function BookImagesScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  // The band sits under the status bar: its icons must be light on it.
  useLightStatusBar();
  const { t, isRTL, lang } = useLanguage();
  const isAr = lang === 'ar';
  const { user } = useAuth();
  const { width } = useWindowDimensions();
  const { gradeId, subjectId, lessonId } = useLocalSearchParams<{ gradeId?: string; subjectId?: string; lessonId?: string }>();
  const align = isRTL ? 'right' : 'left';
  const dir = isRTL ? 'row-reverse' : 'row';

  const grade = getVisibleGrades().find(g => g.id === gradeId);
  const subject = gradeId ? getSubjectsForGrade(gradeId).find(s => s.id === subjectId) : undefined;
  const lesson = lessonId ? getLessonById(lessonId) : undefined;
  const name = (x: { name: string; nameAr: string } | undefined) => (x ? (isAr ? x.nameAr : x.name) : '');

  // The folders at this depth; null at the lesson level, which shows pictures.
  const folders = useMemo((): Folder[] | null => {
    if (lessonId) return null;
    if (gradeId && subjectId) {
      return imageLessons(gradeId, subjectId).map(l => ({
        id: l.lesson.id,
        label: isAr ? l.lesson.titleAr : l.lesson.titleEn,
        count: l.count,
        heading: isAr ? l.unitTitleAr : l.unitTitleEn,
      }));
    }
    if (gradeId) {
      const counts = imageCountBySubject(gradeId);
      const all = getSubjectsForGrade(gradeId);
      const mine = isTeacherRole(user?.role)
        ? narrowSubjectsForGrade(all, gradeId, user?.teachingAssignments, user?.subjectIds)
        : all;
      return mine.filter(s => counts.has(s.id)).map(s => ({ id: s.id, label: name(s), count: counts.get(s.id)! }));
    }
    const counts = imageCountByGrade();
    return narrowToSelection(getVisibleGrades(), user?.gradeIds)
      .filter(g => counts.has(g.id))
      .map(g => ({ id: g.id, label: name(g), count: counts.get(g.id)! }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gradeId, subjectId, lessonId, isAr, user?.role, user?.gradeIds, user?.teachingAssignments, user?.subjectIds]);

  const figures = useMemo(() => (lessonId ? bookFigureRefsForLesson(lessonId, isAr) : []), [lessonId, isAr]);

  const open = (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const next = !gradeId ? { gradeId: id } : !subjectId ? { gradeId, subjectId: id } : { gradeId, subjectId, lessonId: id };
    router.push({ pathname: '/curriculum/book-images' as never, params: next });
  };

  const title = lesson ? (isAr ? lesson.titleAr : lesson.titleEn) : subject ? name(subject) : grade ? name(grade) : t('bookImagesTitle');
  const trail = [lesson || subject || grade ? t('bookImagesTitle') : null, lesson || subject ? name(grade) : null, lesson ? name(subject) : null]
    .filter(Boolean)
    .join(isRTL ? ' ‹ ' : ' › ');
  const total = folders ? folders.reduce((n, f) => n + f.count, 0) : figures.length;
  // Cells are sized from the grid's own measured width, which the desktop
  // sidebar and CONTENT_MAX_WIDTH make different from the window's.
  const [trackWidth, setTrackWidth] = useState(0);
  const track = trackWidth || Math.min(width, CONTENT_MAX_WIDTH) - 40;
  const cols = track >= 840 ? 4 : track >= 560 ? 3 : 2;
  const cellWidth = Math.floor((track - (cols - 1) * GAP) / cols);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Band color={palette.hero} motif="leaf" style={[styles.hero, { paddingTop: insets.top + 12 }]}>
        <BackButton color="#fff" style={[styles.backBtn, { alignSelf: isRTL ? 'flex-end' : 'flex-start' }]} />
        {trail ? <Text style={[styles.trail, { fontFamily: 'Almarai_400Regular', textAlign: align }]}>{trail}</Text> : null}
        <Text style={[styles.heroTitle, { fontFamily: 'ReadexPro_700Bold', textAlign: align }]}>{title}</Text>
        <Text style={[styles.trail, { fontFamily: 'Almarai_400Regular', textAlign: align }]}>{t('bookImagesCount', total)}</Text>
      </Band>

      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        {folders?.length === 0 || (!folders && figures.length === 0) ? (
          <View style={styles.empty}>
            <Ionicons name="images-outline" size={40} color={colors.mutedForeground} />
            <Text style={[styles.emptyText, { color: colors.mutedForeground, fontFamily: 'Almarai_400Regular' }]}>
              {t('bookImagesEmpty')}
            </Text>
          </View>
        ) : null}

        {folders?.map((f, i) => (
          <React.Fragment key={f.id}>
            {f.heading && f.heading !== folders[i - 1]?.heading ? (
              <Text style={[styles.heading, { color: colors.mutedForeground, fontFamily: 'ReadexPro_600SemiBold', textAlign: align }]}>
                {f.heading}
              </Text>
            ) : null}
            <Pressable
              onPress={() => open(f.id)}
              accessibilityRole="button"
              accessibilityLabel={`${f.label}, ${t('bookImagesCount', f.count)}`}
              style={({ pressed }) => [
                styles.folder,
                { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius, flexDirection: dir, opacity: pressed ? 0.85 : 1 },
              ]}
            >
              <Ionicons name="folder" size={24} color={colors.primary} />
              <View style={{ flex: 1 }}>
                <Text numberOfLines={2} style={[styles.folderName, { color: colors.foreground, fontFamily: 'ReadexPro_600SemiBold', textAlign: align }]}>
                  {f.label}
                </Text>
                <Text style={[styles.folderMeta, { color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', textAlign: align }]}>
                  {t('bookImagesCount', f.count)}
                </Text>
              </View>
              <Ionicons name={isRTL ? 'chevron-back' : 'chevron-forward'} size={20} color={colors.mutedForeground} />
            </Pressable>
          </React.Fragment>
        ))}

        {folders ? null : (
          <View style={[styles.grid, { flexDirection: dir }]} onLayout={e => setTrackWidth(e.nativeEvent.layout.width)}>
            {figures.map(f => (
              <View
                key={f.uri}
                style={[styles.cell, { width: cellWidth, backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}
              >
                {/* The figures are cut from white pages: keep them on white in dark mode too. */}
                <TapToEnlarge url={f.uri} caption={f.caption} whiteGround style={styles.tap}>
                  <Image source={{ uri: f.uri }} style={styles.image} contentFit="contain" accessibilityElementsHidden />
                </TapToEnlarge>
                <Text style={[styles.caption, { color: colors.mutedForeground, fontFamily: 'Almarai_400Regular' }]}>{f.caption}</Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { paddingHorizontal: 20, paddingBottom: 16, gap: 2 },
  backBtn: { padding: 4 },
  trail: { color: 'rgba(255,255,255,0.95)', fontSize: 14, lineHeight: 22 },
  heroTitle: { color: '#fff', fontSize: 24, lineHeight: 34 },
  body: { padding: 20, paddingBottom: 48, gap: 12, width: '100%', maxWidth: CONTENT_MAX_WIDTH, alignSelf: 'center' },
  heading: { fontSize: 14, marginTop: 8 },
  folder: { alignItems: 'center', gap: 12, padding: 16, borderWidth: 1, minHeight: 64 },
  folderName: { fontSize: 17, lineHeight: 25 },
  folderMeta: { fontSize: 13, lineHeight: 20 },
  grid: { flexWrap: 'wrap', gap: GAP },
  cell: { borderWidth: 1, padding: 8, alignItems: 'center', gap: 8 },
  tap: { width: '100%', backgroundColor: '#fff', borderRadius: 6 },
  image: { width: '100%', height: 140 },
  caption: { fontSize: 13, lineHeight: 18, textAlign: 'center' },
  empty: { alignItems: 'center', gap: 8, paddingTop: 48, paddingHorizontal: 40 },
  emptyText: { fontSize: 15, textAlign: 'center', lineHeight: 23 },
});
