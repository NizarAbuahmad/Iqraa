/**
 * Landing route.
 *
 * A teacher lands on Today: the lesson that is loaded, what is still missing
 * from it, and one line to the assistant. On desktop web that is the two-column
 * `LessonWorkspace` below; on a phone it is `PhoneToday`
 * (components/today/PhoneToday.tsx), a one-column version over the same
 * `useTodayLesson` hook. Every other role keeps the old behaviour and forwards.
 *
 * Why Today exists at all: the chat was the landing, and a chat's empty state
 * can only ever ask "what do you want to say?" — while the question a teacher
 * actually arrives with is "what is still missing for third period?". Nothing
 * on the old screen answered it, even though the answer was already in the
 * workspace. The chat is still one tap away (Today's ask card, and on desktop
 * the sidebar), and still where the conversation happens; it is no longer the
 * thing you are made to look at before you can see the state of your own lesson.
 */
import React, { useState } from 'react';
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
import { Redirect, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import { useViewportWidth } from '@/hooks/useViewportWidth';
import { useTodayLesson } from '@/hooks/useTodayLesson';
import { DESKTOP_BREAKPOINT } from '@/constants/layout';
import { isStudentRole, isTeacherRole, useAuth } from '@/context/AuthContext';
import { IqraaMark } from '@/components/ui/IqraaMark';
import { JordanFlag } from '@/components/ui/JordanFlag';
import { AiSourceBadge } from '@/components/ui/AiSourceBadge';
import { LessonPrepBoard } from '@/components/ui/LessonPrepBoard';
import { Celebrate } from '@/components/ui/Celebrate';
import { Band } from '@/components/ui/Band';
import { useSurface } from '@/components/ui/Surface';
import { PressableScale } from '@/components/ui/PressableScale';
import { BRAND_BAND, subjectChipColor, subjectTheme } from '@/services/subjectTheme';
import { periodClassLabel } from '@/services/classSubjects';
import { className, classNameFor } from '@/services/materialClass';
import { todayLabel } from '@/services/dateLabels';
import { palette } from '@/constants/colors';
import { PhoneToday } from '@/components/today/PhoneToday';

const START_CLASS_COLOR = palette.live;
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
  // Signed out, the boot effect in _layout.tsx is already replacing this whole
  // stack with /onboarding or /login. Redirecting here too switches the active
  // tab inside the outgoing screen in the same frame, and on Android Fabric
  // that crashes the app on launch ("addViewAt: ... View already has a
  // parent", react-native-screens#4677). One navigation, not two.
  if (!user) return null;
  if (isTeacherRole(user.role)) {
    return isDesktop ? <LessonWorkspace /> : <PhoneToday />;
  }
  // Ordered teacher → student → everyone else, so an unknown or absent role
  // still lands on Messages. Same fail-closed reasoning as the `isLoading`
  // guard above: guessing "student" for a null role would send a cold-booting
  // parent to a curriculum browser.
  return <Redirect href={isStudentRole(user.role) ? '/(tabs)/curriculum' : '/notifications'} />;
}

function LessonWorkspace() {
  const colors = useColors();
  const { t, lang, isRTL } = useLanguage();
  const isAr = lang === 'ar';
  const today = useTodayLesson('workspace');
  const {
    topic, periodLine, next, setup, nudgeDismissed, classes, board, summary, toggleSkip,
    gradeLabel, subjectLabel, toolParams, quickTools, startingClass, startClassError, openLessonPicker,
  } = today;

  const [ask, setAsk] = useState('');
  const sendAsk = () => {
    today.ask(ask);
    setAsk('');
  };

  const rowDir = isRTL ? 'row-reverse' as const : 'row' as const;
  const align = isRTL ? 'right' as const : 'left' as const;
  const surface = useSurface();
  // The band wears the lesson's subject: an English lesson and a maths lesson
  // no longer open on the same navy. No subject keeps the brand navy (`ink`).
  const theme = subjectTheme(today.active?.subjectId);
  const hero = theme === BRAND_BAND ? colors.ink : theme.hero;
  const readyPct = summary.total > 0 ? Math.min(1, summary.done / summary.total) : 0;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/*
        ─── Header band ───────────────────────────────────────────
        The logo's navy as a surface, so splash, login and the workspace read
        as one product. It carries the two things the screen is about — which
        lesson, and the one action that starts it — and the card below keeps
        only what is still missing.
      */}
      <Band color={hero} motif={theme.motif} motifOpacity={theme.motifOpacity} style={s.band}>
      <View style={[s.topbar, { flexDirection: rowDir }]}>
        <View style={[{ flexDirection: rowDir, alignItems: 'center', gap: 10 }]}>
          <Text style={[s.today, { color: 'rgba(255,255,255,0.78)' }]}>{todayLabel(lang as 'ar' | 'en')}</Text>
          <AiSourceBadge onDark isRTL={isRTL} />
        </View>
        <View style={[{ flexDirection: rowDir, alignItems: 'center', gap: 9 }]}>
          <Pressable
            onPress={today.startClass}
            disabled={!topic || startingClass}
            style={({ pressed }) => [
              s.btn,
              // The band is the lesson's colour now; on a warm one (English) amber alone
              // blends in, so the button keeps a light edge on every band.
              { backgroundColor: START_CLASS_COLOR, borderWidth: 1, borderColor: 'rgba(255,255,255,0.55)', opacity: !topic ? 0.45 : pressed ? 0.88 : 1, flexDirection: rowDir },
            ]}
            accessibilityRole="button"
            accessibilityLabel={t('startClass')}
          >
            {startingClass
              ? <ActivityIndicator size="small" color="#fff" />
              : <Ionicons name="tv-outline" size={16} color="#fff" />}
            <Text style={s.btnText}>{t('startClass')}</Text>
          </Pressable>
          <Pressable
            onPress={openLessonPicker}
            style={({ pressed }) => [
              s.btn,
              s.btnGhost,
              { borderColor: 'rgba(255,255,255,0.28)', backgroundColor: 'rgba(255,255,255,0.06)', opacity: pressed ? 0.8 : 1, flexDirection: rowDir },
            ]}
            accessibilityRole="button"
          >
            <Ionicons name="swap-horizontal" size={16} color="#fff" />
            <Text style={s.btnText}>{t('changeLesson')}</Text>
          </Pressable>
        </View>
      </View>

      {/* Which lesson this is */}
      <View style={s.bandLesson}>
        {periodLine ? (
          <View style={[s.periodPill, { backgroundColor: colors.accent, flexDirection: rowDir, alignSelf: isRTL ? 'flex-end' : 'flex-start' }]}>
            <Ionicons name={next?.happeningNow ? 'radio-button-on' : 'time-outline'} size={14} color={colors.accentForeground} />
            <Text style={[s.periodText, { color: colors.accentForeground }]}>{periodLine}</Text>
          </View>
        ) : null}
        <View style={[{ flexDirection: rowDir, alignItems: 'center', gap: 7 }]}>
          <JordanFlag width={17} />
          <Text style={[s.crumb, { color: 'rgba(255,255,255,0.78)', textAlign: align }]}>
            {[subjectLabel, gradeLabel].filter(Boolean).join(isAr ? ' • ' : ' • ')}
          </Text>
        </View>
        <Text style={[s.lessonTitle, { color: '#FFFFFF', textAlign: align }]}>
          {topic || t('homeNoLesson')}
        </Text>
        {!topic ? (
          <Text style={[s.hint, { color: 'rgba(255,255,255,0.78)', textAlign: align }]}>
            {t('homeNoLessonHint')}
          </Text>
        ) : summary.total > 0 ? (
          // How ready the lesson is, where the lesson is named.
          <View style={[s.bandProgress, { flexDirection: rowDir }]}>
            <View style={s.bandTrack}>
              <View style={[s.bandFill, { width: `${readyPct * 100}%`, alignSelf: isRTL ? 'flex-end' : 'flex-start' }]} />
            </View>
            <Text style={s.bandProgressText}>{t('homeReady', summary.done, summary.total)}</Text>
          </View>
        ) : null}
      </View>
      </Band>

      <View style={[s.body, { flexDirection: rowDir }]}>
        {/* ─── Main column ───────────────────────────────────────── */}
        <ScrollView style={{ flex: 1 }} contentContainerStyle={s.mainCol} showsVerticalScrollIndicator={false}>
          {/* Lesson + readiness */}
          <View style={[s.card, surface]}>
            {/*
              One next thing to set up so this card can follow the timetable —
              production had bell times but not a single class in a period.
              Not shown to a teacher with no classes yet (the «شُعَبي» section
              below already asks for those), and closable for good.
            */}
            {setup && !nudgeDismissed && classes.length > 0 ? (
              <View style={[s.nudge, { backgroundColor: colors.secondary, flexDirection: rowDir }]}>
                <Ionicons name="calendar-outline" size={16} color={colors.primary} />
                <Text style={[s.nudgeText, { color: colors.foreground, textAlign: align }]}>
                  {setup.step === 'timetable'
                    ? t('homeSetupTimetable')
                    : t('homeSetupPlan', periodClassLabel(classNameFor(classes, setup.classGroupId, lang as 'ar' | 'en'), setup.subjectId, lang) ?? '')}
                </Text>
                <Pressable
                  onPress={() =>
                    setup.step === 'timetable'
                      ? router.push('/schedule' as never)
                      : router.push({
                          pathname: '/teaching-plans',
                          params: { classId: setup.classGroupId, ...(setup.subjectId ? { subjectId: setup.subjectId } : {}) },
                        } as never)
                  }
                  style={({ pressed }) => [s.nudgeBtn, { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 }]}
                  accessibilityRole="button"
                >
                  <Text style={[s.nudgeBtnText, { color: colors.primaryForeground }]}>
                    {t(setup.step === 'timetable' ? 'homeSetupTimetableCta' : 'homeSetupPlanCta')}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={today.dismissNudge}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel={t('homeSetupDismiss')}
                  style={s.nudgeClose}
                >
                  <Ionicons name="close" size={16} color={colors.mutedForeground} />
                </Pressable>
              </View>
            ) : null}

            {startClassError ? (
              <View style={[s.errorRow, { backgroundColor: colors.destructive + '14', flexDirection: rowDir }]}>
                <Ionicons name="alert-circle" size={14} color={colors.destructive} />
                <Text style={[s.errorText, { color: colors.destructive, textAlign: align }]}>{startClassError}</Text>
              </View>
            ) : null}

            <View>
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
                onToggleSkip={toggleSkip}
                skipLabel={t('homePrepSkip')}
                skipShortLabel={t('homePrepSkipShort')}
                skippedLabel={t('homePrepSkipped')}
                restoreLabel={t('homePrepRestore')}
                classLabelFor={(id) => classNameFor(classes, id, lang as 'ar' | 'en')}
                onOpenAll={() => router.push({ pathname: '/workspace', params: { q: topic } })}
                allCopiesLabel={t('homePrepAllCopies')}
              />
            </View>
          </View>

          {/* Quick tools */}
          <Text style={[s.sectionTitle, { color: colors.foreground, textAlign: align }]}>{t('homeQuickTools')}</Text>
          <View style={[{ flexDirection: rowDir, gap: 12 }]}>
            {quickTools.map(tool => (
              <PressableScale
                key={tool.id}
                onPress={() => router.push({ pathname: tool.route as never, params: toolParams as never })}
                style={[s.tool, surface]}
                accessibilityLabel={t(tool.titleKey as never)}
              >
                <View style={[s.toolIcon, { backgroundColor: tool.color + '1F' }]}>
                  <Ionicons name={tool.icon} size={24} color={tool.color} />
                </View>
                <Text numberOfLines={1} style={[s.toolText, { color: colors.foreground }]}>
                  {t(tool.titleKey as never)}
                </Text>
              </PressableScale>
            ))}
          </View>

          {/* Classes */}
          <Text style={[s.sectionTitle, { color: colors.foreground, textAlign: align }]}>{t('homeMyClasses')}</Text>
          <View style={[{ flexDirection: rowDir, gap: 10, flexWrap: 'wrap' }]}>
            {classes.length === 0 ? (
              <Text style={[s.empty, { color: colors.mutedForeground }]}>{t('homeNoClasses')}</Text>
            ) : (
              classes.slice(0, 6).map(group => {
                // Each class in its subject's colour, so they tell apart at a glance.
                const tone = subjectChipColor(group.subjectId, colors.card);
                return (
                  <PressableScale
                    key={group.id}
                    onPress={() => router.push({ pathname: '/classes/[id]', params: { id: group.id } })}
                    style={[s.classChip, { backgroundColor: colors.card, borderColor: tone + '66', flexDirection: rowDir }]}
                  >
                    <View style={[s.classDot, { backgroundColor: tone }]} />
                    <Text style={[s.classChipText, { color: tone }]}>
                      {className(group, lang as 'ar' | 'en')}
                    </Text>
                  </PressableScale>
                );
              })
            )}
          </View>
        </ScrollView>

        {/* ─── Assistant panel ───────────────────────────────────── */}
        <View style={[s.side, surface]}>
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
            {today.suggestions.map(sug => (
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
            <Text style={[s.openChat, { color: colors.primary, textAlign: align }]}>{t('homeOpenChat')} {align === 'right' ? '←' : '→'}</Text>
          </Pressable>
        </View>
      </View>
      <Celebrate visible={today.prepJustReady} size="small" message={t('celebratePrepReady')} onDone={today.clearPrepJustReady} />
    </View>
  );
}

const s = StyleSheet.create({
  // The header band, in the lesson's subject colour (`subjectTheme`).
  band: { paddingHorizontal: 24, paddingTop: 14, paddingBottom: 26, gap: 14 },
  bandLesson: { gap: 8 },
  bandProgress: { alignItems: 'center', gap: 12, marginTop: 4 },
  bandTrack: { width: 220, height: 8, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.24)', overflow: 'hidden' },
  bandFill: { height: 8, borderRadius: 999, backgroundColor: '#FFFFFF' },
  bandProgressText: { color: '#FFFFFF', fontSize: 13, fontFamily: 'ReadexPro_600SemiBold' },
  topbar: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  today: { fontSize: 15, lineHeight: 23, fontFamily: 'Almarai_400Regular' },
  btn: { alignItems: 'center', gap: 7, paddingHorizontal: 16, paddingVertical: 11, minHeight: 44, borderRadius: 12 },
  btnGhost: { borderWidth: 1 },
  btnText: { color: '#fff', fontFamily: 'ReadexPro_600SemiBold', fontSize: 13 },

  body: { flex: 1, gap: 20, padding: 22 },
  mainCol: { gap: 16, paddingBottom: 40 },
  card: { padding: 22, gap: 14 },
  crumb: { fontSize: 13, lineHeight: 21, fontFamily: 'Almarai_400Regular' },
  periodPill: { alignItems: 'center', gap: 6, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5 },
  periodText: { fontSize: 13, fontFamily: 'ReadexPro_600SemiBold' },
  lessonTitle: { fontSize: 28, fontFamily: 'ReadexPro_700Bold', lineHeight: 40 },
  hint: { fontSize: 15, lineHeight: 24, fontFamily: 'Almarai_400Regular' },


  errorRow: { alignItems: 'center', gap: 7, borderRadius: 10, padding: 9 },
  nudge: { alignItems: 'center', gap: 10, borderRadius: 12, paddingVertical: 8, paddingHorizontal: 12 },
  nudgeText: { flex: 1, fontSize: 15, lineHeight: 23, fontFamily: 'Almarai_400Regular' },
  nudgeBtn: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  nudgeBtnText: { fontSize: 13, fontFamily: 'ReadexPro_600SemiBold' },
  nudgeClose: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  errorText: { fontSize: 13, lineHeight: 21, fontFamily: 'Almarai_400Regular', flex: 1 },

  sectionTitle: { fontSize: 15, fontFamily: 'ReadexPro_600SemiBold', marginTop: 6 },
  tool: { flex: 1, alignItems: 'center', gap: 10, paddingVertical: 18, paddingHorizontal: 10 },
  toolIcon: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  toolText: { fontSize: 13, fontFamily: 'ReadexPro_600SemiBold' },
  classChip: { alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 9 },
  classDot: { width: 8, height: 8, borderRadius: 4 },
  classChipText: { fontSize: 13, fontFamily: 'ReadexPro_600SemiBold' },
  empty: { fontSize: 15, lineHeight: 24, fontFamily: 'Almarai_400Regular' },

  side: {
    width: SIDE_PANEL_WIDTH,
    flexBasis: SIDE_PANEL_WIDTH,
    flexGrow: 0,
    flexShrink: 0,
    padding: 16,
  },
  sideTitle: { fontSize: 15, fontFamily: 'ReadexPro_600SemiBold' },
  sideHint: { fontSize: 13, lineHeight: 20, fontFamily: 'Almarai_400Regular', marginTop: 1 },
  sugg: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 },
  suggText: { fontSize: 15, fontFamily: 'Almarai_400Regular', lineHeight: 23 },
  composer: { alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 9 },
  composerInput: { flex: 1, fontSize: 15, fontFamily: 'Almarai_400Regular', outlineStyle: 'none' as never },
  send: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  openChat: { fontSize: 13, fontFamily: 'ReadexPro_600SemiBold' },
});
