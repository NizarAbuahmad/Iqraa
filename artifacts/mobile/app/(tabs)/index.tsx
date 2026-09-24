/**
 * Landing route.
 *
 * On desktop web a teacher gets the lesson workspace: the lesson that is
 * loaded, what is still missing from it, and one line to the assistant. Every
 * other case keeps the old behaviour and forwards.
 *
 * Why the workspace exists at all: the chat was the landing, and a chat's
 * empty state can only ever ask "what do you want to say?" — while the
 * question a teacher actually arrives with is "what is still missing for third
 * period?". Nothing on the old screen answered it, even though the answer was
 * already in the workspace. The chat is still one click away, and still where
 * the conversation happens; it is no longer the thing you are made to look at
 * before you can see the state of your own lesson.
 *
 * On a phone this route still redirects to the chat. The workspace is a
 * two-column desktop layout, and a phone has no room for a sixth tab to reach
 * a one-column version of it — so the part that answers the question travels
 * instead: the chat's empty state carries the same readiness board
 * (`LessonPrepBoard`, fed by the same `buildPrepBoard`), in the space that was
 * a logo and two chips.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import { useViewportWidth } from '@/hooks/useViewportWidth';
import { DESKTOP_BREAKPOINT } from '@/constants/layout';
import { isStudentRole, isTeacherRole, useAuth } from '@/context/AuthContext';
import { IqraaMark } from '@/components/ui/IqraaMark';
import { JordanFlag } from '@/components/ui/JordanFlag';
import { AiSourceBadge } from '@/components/ui/AiSourceBadge';
import { buildPrepBoard, prepSummary, withoutBoardTools, type PrepRow } from '@/services/lessonBoard';
import { LessonPrepBoard } from '@/components/ui/LessonPrepBoard';
import { getAllItems, type SavedMaterial } from '@/services/workspace';
import { listClasses } from '@/services/roster';
import type { ClassGroup } from '@/services/roster';
import { className } from '@/services/materialClass';
import { HomeLessonPick, loadLessonPick, subscribeLessonPick } from '@/services/lessonContext';
import { getPickerGrades, getPickerSubjects } from '@/services/curriculumData';
import { lessonPickerParams, resolveLessonPrepContext, scopePickerParams } from '@/services/lessonPrep';
import { DEFAULT_ACTIVE_LESSON_ID } from '@/services/lessonCopilot';
import { buildClassDeck } from '@/services/startClass';
import { setPendingClassroomActivity } from '@/services/classroomStore';
import { WORKFLOW } from '@/services/toolCatalog';
import { trackEvent } from '@/services/analytics';

const START_CLASS_COLOR = '#B45309';
const SIDE_PANEL_WIDTH = 356;

export default function Index() {
  const { user, isLoading } = useAuth();
  const viewportW = useViewportWidth();
  const isDesktop = Platform.OS === 'web' && viewportW >= DESKTOP_BREAKPOINT;

  // `user` is null for the whole of the session restore, and null is not a
  // teacher — so without this a teacher cold-booting was sent to Messages, and
  // nothing brought them back: the boot effect in _layout.tsx only re-routes
  // from an entry route or on a fresh sign-in, and /notifications is neither.
  // Rendering nothing here is invisible; the splash is still up until auth
  // resolves (see _layout.tsx).
  if (isLoading) return null;
  if (isTeacherRole(user?.role)) {
    return isDesktop ? <LessonWorkspace /> : <Redirect href="/iqra" />;
  }
  // Ordered teacher → student → everyone else, so an unknown or absent role
  // still lands on Messages. Same fail-closed reasoning as the `isLoading`
  // guard above: guessing "student" for a null role would send a cold-booting
  // parent to a curriculum browser.
  return <Redirect href={isStudentRole(user?.role) ? '/(tabs)/curriculum' : '/notifications'} />;
}

function LessonWorkspace() {
  const colors = useColors();
  const { t, lang, isRTL } = useLanguage();
  const isAr = lang === 'ar';
  const params = useLocalSearchParams<{ startClass?: string }>();

  const [pick, setPick] = useState<HomeLessonPick | null>(null);
  const [materials, setMaterials] = useState<SavedMaterial[]>([]);
  const [classes, setClasses] = useState<ClassGroup[]>([]);
  const [ask, setAsk] = useState('');
  const [startingClass, setStartingClass] = useState(false);
  const [startClassError, setStartClassError] = useState('');

  useEffect(() => {
    loadLessonPick().then(setPick);
    return subscribeLessonPick(setPick);
  }, []);

  /*
   * Saved materials are the only record of prep that outlives a chat session,
   * so they are what the board reads. Reloaded on focus rather than once on
   * mount: generating a worksheet leaves this screen and comes back, and a
   * board that still says "missing" after the teacher just made the thing is
   * worse than no board.
   */
  const reload = useCallback(() => {
    getAllItems().then(setMaterials).catch(() => {});
    listClasses().then(setClasses).catch(() => {});
  }, []);
  useEffect(() => {
    reload();
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    window.addEventListener('focus', reload);
    return () => window.removeEventListener('focus', reload);
  }, [reload]);

  /*
    A teacher who has never opened the lesson picker still has a lesson: the
    chat has always seeded one (`seedDefaultLessonMemory`) and shows it on its
    card. Falling back to the same one keeps the two screens saying the same
    thing — a home that said "no lesson picked" while the chat one click away
    showed «تركيب الاقترانات» would read as a bug in whichever was seen second.
  */
  const fallback = useMemo(
    () => resolveLessonPrepContext(DEFAULT_ACTIVE_LESSON_ID, lang as 'ar' | 'en'),
    [lang],
  );
  const active = pick?.topic?.trim()
    ? { topic: pick.topic.trim(), lessonId: pick.lessonId ?? null, gradeId: pick.gradeId, subjectId: pick.subjectId }
    : fallback
      ? { topic: fallback.topic, lessonId: fallback.lessonId, gradeId: fallback.gradeId, subjectId: fallback.subjectId }
      : null;

  const topic = active?.topic ?? '';
  const board = useMemo(() => buildPrepBoard(materials, topic), [materials, topic]);
  const summary = prepSummary(board);

  const grade = active?.gradeId ? getPickerGrades().find(g => g.id === active.gradeId) : undefined;
  const subject = active?.subjectId ? getPickerSubjects().find(s => s.id === active.subjectId) : undefined;
  const gradeLabel = grade ? (isAr ? grade.nameAr : grade.name) : '';
  const subjectLabel = subject ? (isAr ? subject.nameAr : subject.name) : '';

  /**
   * Params that open a generator on this lesson's own grade and subject.
   *
   * Never omitted and never hand-rolled: every `/ai-tools/*` screen defaults
   * `subjectIdx` to 0, so a tool opened with a bare topic generates the first
   * subject's material under this lesson's title — the trap CLAUDE.md
   * describes. `lessonPickerParams` computes both indices from the lesson's
   * own book; `scopePickerParams` is the fallback when the pick carries ids
   * but no lesson.
   */
  const toolParams = useMemo((): Record<string, string> => {
    const idx =
      lessonPickerParams(active?.lessonId, lang as 'ar' | 'en') ??
      scopePickerParams(active?.gradeId, active?.subjectId);
    return { ...(topic ? { topic } : {}), ...(idx ?? {}) };
  }, [active?.lessonId, active?.gradeId, active?.subjectId, topic, lang]);

  const openLessonPicker = useCallback(() => {
    router.push({ pathname: '/iqra', params: { openLessonPicker: String(Date.now()) } });
  }, []);

  const handleStartClass = useCallback(async () => {
    if (startingClass || !topic) return;
    setStartingClass(true);
    setStartClassError('');
    try {
      // The lesson's own subject, not the deck builder's maths default —
      // `isMathContext` reads the subject *name*, so a chemistry lesson
      // announced as "Mathematics" comes back as a deck of algebra questions
      // under the chemistry title.
      const activity = await buildClassDeck({
        topic,
        lang: lang as 'ar' | 'en',
        subjectId: active?.subjectId ?? undefined,
        subjectName: subject?.name,
        lessonId: active?.lessonId ?? null,
      });
      setPendingClassroomActivity(activity);
      trackEvent('class_started', { source: 'workspace' });
      router.push('/ai-tools/classroom/presentation' as never);
    } catch {
      setStartClassError(t('startClassFailed'));
    } finally {
      setStartingClass(false);
    }
  }, [startingClass, topic, lang, active?.subjectId, active?.lessonId, subject?.name, t]);

  // ⌘K → «ابدأ الحصة» arrives as a nonce param, so pressing it twice fires
  // twice (a plain flag would have been swallowed the second time).
  useEffect(() => {
    if (!params.startClass) return;
    void handleStartClass();
    // Intentionally keyed on the nonce alone: re-running when handleStartClass
    // is rebuilt would start a class the teacher never asked for.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.startClass]);

  const sendAsk = useCallback(() => {
    const text = ask.trim();
    if (!text) return;
    setAsk('');
    router.push({
      pathname: '/iqra',
      params: { initialMessage: text, askId: String(Date.now()) },
    });
  }, [ask]);

  const rowDir = isRTL ? 'row-reverse' as const : 'row' as const;
  const align = isRTL ? 'right' as const : 'left' as const;
  /*
    Everything the board does not already offer. The first version took the
    first four of BEFORE_CLASS, which put a «خطة درس» card directly under the
    «خطة الدرس» row and a «شرائح الدرس» card under «عرض الحصة» — the same two
    buttons twice, and the card was the worse of each pair because it cannot
    say whether the material already exists. What is left is the rest of the
    catalog: the tools that have no row.
  */
  const quickTools = withoutBoardTools(WORKFLOW.flatMap(section => section.tools)).slice(0, 4);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* ─── Top bar ─────────────────────────────────────────────── */}
      <View style={[s.topbar, { backgroundColor: colors.card, borderBottomColor: colors.border, flexDirection: rowDir }]}>
        <View style={[{ flexDirection: rowDir, alignItems: 'center', gap: 10 }]}>
          <Text style={[s.today, { color: colors.mutedForeground }]}>{todayLabel(lang as 'ar' | 'en')}</Text>
          <AiSourceBadge isRTL={isRTL} />
        </View>
        <View style={[{ flexDirection: rowDir, alignItems: 'center', gap: 9 }]}>
          <Pressable
            onPress={handleStartClass}
            disabled={!topic || startingClass}
            style={({ pressed }) => [
              s.btn,
              { backgroundColor: START_CLASS_COLOR, opacity: !topic ? 0.45 : pressed ? 0.88 : 1, flexDirection: rowDir },
            ]}
            accessibilityRole="button"
            accessibilityLabel={t('startClass')}
          >
            {startingClass
              ? <ActivityIndicator size="small" color="#fff" />
              : <Ionicons name="tv-outline" size={15} color="#fff" />}
            <Text style={s.btnText}>{t('startClass')}</Text>
          </Pressable>
          <Pressable
            onPress={openLessonPicker}
            style={({ pressed }) => [
              s.btn,
              s.btnGhost,
              { borderColor: colors.primary + '55', backgroundColor: colors.card, opacity: pressed ? 0.8 : 1, flexDirection: rowDir },
            ]}
            accessibilityRole="button"
          >
            <Ionicons name="swap-horizontal" size={15} color={colors.primary} />
            <Text style={[s.btnText, { color: colors.primary }]}>{t('changeLesson')}</Text>
          </Pressable>
        </View>
      </View>

      <View style={[s.body, { flexDirection: rowDir }]}>
        {/* ─── Main column ───────────────────────────────────────── */}
        <ScrollView style={{ flex: 1 }} contentContainerStyle={s.mainCol} showsVerticalScrollIndicator={false}>
          {/* Lesson + readiness */}
          <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[{ flexDirection: rowDir, alignItems: 'flex-start', gap: 16 }]}>
              <View style={{ flex: 1 }}>
                <View style={[{ flexDirection: rowDir, alignItems: 'center', gap: 7, marginBottom: 7 }]}>
                  <JordanFlag width={17} />
                  <Text style={[s.crumb, { color: colors.mutedForeground, textAlign: align }]}>
                    {[subjectLabel, gradeLabel].filter(Boolean).join(isAr ? ' • ' : ' • ')}
                  </Text>
                </View>
                <Text style={[s.lessonTitle, { color: colors.foreground, textAlign: align }]}>
                  {topic || t('homeNoLesson')}
                </Text>
                {!topic ? (
                  <Text style={[s.hint, { color: colors.mutedForeground, textAlign: align }]}>
                    {t('homeNoLessonHint')}
                  </Text>
                ) : null}
              </View>
            </View>

            {startClassError ? (
              <View style={[s.errorRow, { backgroundColor: START_CLASS_COLOR + '14', flexDirection: rowDir }]}>
                <Ionicons name="alert-circle-outline" size={14} color={START_CLASS_COLOR} />
                <Text style={[s.errorText, { color: START_CLASS_COLOR, textAlign: align }]}>{startClassError}</Text>
              </View>
            ) : null}

            <View style={{ marginTop: 16 }}>
              <LessonPrepBoard
                rows={board}
                colors={colors}
                isRTL={isRTL}
                isAr={isAr}
                disabled={!topic}
                title={t('homePrepTitle')}
                readyLabel={t('homeReady', summary.done, summary.total)}
                openLabel={t('homeOpen')}
                makeLabel={t('homePrepMake')}
                createLabel={t('homePrepCreate')}
                notYetLabel={t('homePrepNotYet')}
                doneLabel={t('homePrepDone')}
                onOpen={(row) => row.material && router.push({ pathname: '/workspace/view', params: { id: row.material.id } })}
                onMake={(row) => router.push({ pathname: row.route as never, params: toolParams as never })}
              />
            </View>
          </View>

          {/* Quick tools */}
          <Text style={[s.sectionTitle, { color: colors.foreground, textAlign: align }]}>{t('homeQuickTools')}</Text>
          <View style={[{ flexDirection: rowDir, gap: 12 }]}>
            {quickTools.map(tool => (
              <Pressable
                key={tool.id}
                onPress={() => router.push({ pathname: tool.route as never, params: toolParams as never })}
                style={({ pressed }) => [
                  s.tool,
                  { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.85 : 1 },
                ]}
              >
                <View style={[s.toolIcon, { backgroundColor: tool.color + '1A' }]}>
                  <Ionicons name={tool.icon} size={20} color={tool.color} />
                </View>
                <Text numberOfLines={1} style={[s.toolText, { color: colors.foreground }]}>
                  {t(tool.titleKey as never)}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Classes */}
          <Text style={[s.sectionTitle, { color: colors.foreground, textAlign: align }]}>{t('homeMyClasses')}</Text>
          <View style={[{ flexDirection: rowDir, gap: 10, flexWrap: 'wrap' }]}>
            {classes.length === 0 ? (
              <Text style={[s.empty, { color: colors.mutedForeground }]}>{t('homeNoClasses')}</Text>
            ) : (
              classes.slice(0, 6).map(group => (
                <Pressable
                  key={group.id}
                  onPress={() => router.push({ pathname: '/classes/[id]', params: { id: group.id } })}
                  style={({ pressed }) => [
                    s.classChip,
                    { backgroundColor: colors.secondary, borderColor: colors.primary + '2E', opacity: pressed ? 0.8 : 1 },
                  ]}
                >
                  <Text style={[s.classChipText, { color: colors.primary }]}>
                    {className(group, lang as 'ar' | 'en')}
                  </Text>
                </Pressable>
              ))
            )}
          </View>
        </ScrollView>

        {/* ─── Assistant panel ───────────────────────────────────── */}
        <View style={[s.side, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[{ flexDirection: rowDir, alignItems: 'center', gap: 9 }]}>
            <IqraaMark size={28} tone="soft" />
            <View style={{ flex: 1 }}>
              <Text style={[s.sideTitle, { color: colors.foreground, textAlign: align }]}>{t('homeAssistant')}</Text>
              <Text numberOfLines={1} style={[s.sideHint, { color: colors.mutedForeground, textAlign: align }]}>
                {topic ? t('homeAssistantTiedToLesson') : t('homeNoLesson')}
              </Text>
            </View>
          </View>

          {/*
            The panel hands off rather than holding its own thread: one
            conversation per teacher, and it lives on the chat tab. Typing here
            opens it with what was typed already sent, so the handoff costs the
            teacher nothing — and there is no second transcript to reconcile.
          */}
          <View style={{ gap: 8, marginTop: 14 }}>
            {suggestionsFor(board, topic, isAr).map(sug => (
              <Pressable
                key={sug}
                onPress={() => router.push({ pathname: '/iqra', params: { initialMessage: sug, askId: String(Date.now()) } })}
                style={({ pressed }) => [
                  s.sugg,
                  { borderColor: colors.border, backgroundColor: colors.background, opacity: pressed ? 0.8 : 1 },
                ]}
              >
                <Text style={[s.suggText, { color: colors.foreground, textAlign: align }]}>{sug}</Text>
              </Pressable>
            ))}
          </View>

          <View style={{ flex: 1 }} />

          <View style={[s.composer, { borderColor: colors.border, backgroundColor: colors.background, flexDirection: rowDir }]}>
            <TextInput
              value={ask}
              onChangeText={setAsk}
              onSubmitEditing={sendAsk}
              placeholder={t('homeAskPlaceholder')}
              placeholderTextColor={colors.mutedForeground}
              style={[s.composerInput, { color: colors.foreground, textAlign: align }]}
              accessibilityLabel={t('homeAskPlaceholder')}
            />
            <Pressable
              onPress={sendAsk}
              disabled={!ask.trim()}
              style={[s.send, { backgroundColor: ask.trim() ? colors.primary : colors.muted }]}
              accessibilityRole="button"
            >
              <Ionicons
                name={isRTL ? 'arrow-back' : 'arrow-forward'}
                size={16}
                color={ask.trim() ? colors.primaryForeground : colors.mutedForeground}
              />
            </Pressable>
          </View>
          <Pressable onPress={() => router.push('/iqra')} style={{ paddingTop: 10 }}>
            <Text style={[s.openChat, { color: colors.primary, textAlign: align }]}>{t('homeOpenChat')} ←</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

/** Ask the assistant for whatever the board says is missing, in the board's order. */
function suggestionsFor(board: PrepRow[], topic: string, isAr: boolean): string[] {
  if (!topic) return [];
  const missing = board.filter(r => !r.done).slice(0, 2);
  const asks = missing.map(row =>
    isAr ? `جهّز ${row.labelAr} عن «${topic}»` : `Prepare a ${row.labelEn.toLowerCase()} for “${topic}”`,
  );
  if (asks.length < 2) {
    asks.push(isAr ? `اشرح لي أصعب فكرة في «${topic}»` : `Explain the hardest idea in “${topic}”`);
  }
  return asks.slice(0, 3);
}

function todayLabel(lang: 'ar' | 'en'): string {
  try {
    return new Date().toLocaleDateString(lang === 'ar' ? 'ar-JO' : 'en-GB', {
      weekday: 'long', day: 'numeric', month: 'long',
    });
  } catch {
    return '';
  }
}

const s = StyleSheet.create({
  topbar: {
    height: 58,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    borderBottomWidth: 1,
  },
  today: { fontSize: 12.5, lineHeight: 20, fontFamily: 'Almarai_400Regular' },
  btn: { alignItems: 'center', gap: 7, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 12 },
  btnGhost: { borderWidth: 1 },
  btnText: { color: '#fff', fontFamily: 'Cairo_600SemiBold', fontSize: 13 },

  body: { flex: 1, gap: 20, padding: 22 },
  mainCol: { gap: 16, paddingBottom: 40 },
  card: { borderWidth: 1, borderRadius: 18, padding: 22 },
  crumb: { fontSize: 12, lineHeight: 19, fontFamily: 'Almarai_400Regular' },
  lessonTitle: { fontSize: 22, fontFamily: 'Cairo_700Bold', lineHeight: 34 },
  hint: { fontSize: 13, lineHeight: 21, fontFamily: 'Almarai_400Regular', marginTop: 6 },


  errorRow: { alignItems: 'center', gap: 7, borderRadius: 10, padding: 9, marginTop: 12 },
  errorText: { fontSize: 12, lineHeight: 19, fontFamily: 'Almarai_400Regular', flex: 1 },

  sectionTitle: { fontSize: 14.5, fontFamily: 'Cairo_600SemiBold', marginTop: 6 },
  tool: { flex: 1, alignItems: 'center', gap: 9, borderWidth: 1, borderRadius: 16, paddingVertical: 16, paddingHorizontal: 10 },
  toolIcon: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  toolText: { fontSize: 12.5, fontFamily: 'Cairo_600SemiBold' },
  classChip: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 9 },
  classChipText: { fontSize: 13, fontFamily: 'Cairo_500Medium' },
  empty: { fontSize: 13, lineHeight: 21, fontFamily: 'Almarai_400Regular' },

  side: {
    width: SIDE_PANEL_WIDTH,
    flexBasis: SIDE_PANEL_WIDTH,
    flexGrow: 0,
    flexShrink: 0,
    borderWidth: 1,
    borderRadius: 18,
    padding: 16,
  },
  sideTitle: { fontSize: 14.5, fontFamily: 'Cairo_600SemiBold' },
  sideHint: { fontSize: 11.5, lineHeight: 18, fontFamily: 'Almarai_400Regular', marginTop: 1 },
  sugg: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 },
  suggText: { fontSize: 12.5, fontFamily: 'Almarai_400Regular', lineHeight: 20 },
  composer: { alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 9 },
  composerInput: { flex: 1, fontSize: 13, fontFamily: 'Almarai_400Regular', outlineStyle: 'none' as never },
  send: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  openChat: { fontSize: 12.5, fontFamily: 'Cairo_600SemiBold' },
});
