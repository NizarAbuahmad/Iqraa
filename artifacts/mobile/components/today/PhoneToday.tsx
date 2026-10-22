/**
 * Today on a phone: what a teacher sees when the app opens. A navy leaf band
 * with the greeting and the lesson (Start class, Change lesson), then the prep
 * checklist, quick tools, an ask card that hands off to the chat, and the
 * teacher's classes.
 *
 * It shares `useTodayLesson` with the desktop workspace (app/(tabs)/index.tsx),
 * so the two layouts can never name two different lessons; only the layout is
 * its own. It pays `insets.top` itself because Today has no lesson bar above it
 * (see `showLessonBar`). Amber (`palette.live`) is only on Start class: it
 * means "now".
 */
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, StatusBar, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import { useAuth } from '@/context/AuthContext';
import { useTodayLesson } from '@/hooks/useTodayLesson';
import { palette } from '@/constants/colors';
import { RADIUS, SPACE, TYPE } from '@/constants/theme';
import { Band, BRAND_MOTIF_OPACITY } from '@/components/ui/Band';
import { Surface, useSurface } from '@/components/ui/Surface';
import { PressableScale } from '@/components/ui/PressableScale';
import { Entrance } from '@/components/ui/Entrance';
import { IqraaMark } from '@/components/ui/IqraaMark';
import { JordanFlag } from '@/components/ui/JordanFlag';
import { AiSourceBadge } from '@/components/ui/AiSourceBadge';
import { LessonPrepBoard } from '@/components/ui/LessonPrepBoard';
import { NotificationBell } from '@/components/ui/NotificationBell';
import { periodClassLabel } from '@/services/classSubjects';
import { className, classNameFor } from '@/services/materialClass';
import { todayLabel } from '@/services/dateLabels';
import { greetingKey } from '@/services/greeting';

const START_CLASS_COLOR = palette.live;
const ON_NAVY = '#FFFFFF';
const ON_NAVY_MUTED = 'rgba(255,255,255,0.78)';

export function PhoneToday() {
  const colors = useColors();
  const surface = useSurface();
  const insets = useSafeAreaInsets();
  const { t, lang, isRTL } = useLanguage();
  const { user } = useAuth();
  const isAr = lang === 'ar';
  const today = useTodayLesson('today_phone');
  const {
    topic, periodLine, next, setup, nudgeDismissed, classes, board, summary, toggleSkip,
    gradeLabel, subjectLabel, toolParams, quickTools, suggestions, startingClass, startClassError,
    openLessonPicker,
  } = today;

  // The navy band sits under the status bar: light icons while Today is
  // showing, the default again on any other screen. (No-op on web.)
  useFocusEffect(useCallback(() => {
    if (Platform.OS === 'web') return;
    StatusBar.setBarStyle('light-content');
    return () => StatusBar.setBarStyle('default');
  }, []));

  const [draft, setDraft] = useState('');
  const sendDraft = () => {
    today.ask(draft);
    setDraft('');
  };

  const rowDir = isRTL ? 'row-reverse' as const : 'row' as const;
  const align = isRTL ? 'right' as const : 'left' as const;

  let section = 0;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ paddingBottom: 120 }}
      showsVerticalScrollIndicator={false}
      // Without this a tap on send or a suggestion only closes the keyboard.
      keyboardShouldPersistTaps="handled"
    >
      <Band
        color={colors.ink}
        motif="leaf"
        motifOpacity={BRAND_MOTIF_OPACITY}
        style={{
          paddingTop: insets.top + SPACE.md,
          paddingHorizontal: SPACE.lg,
          paddingBottom: SPACE.xl,
          gap: SPACE.md,
        }}
      >
        <View style={[s.topRow, { flexDirection: rowDir }]}>
          <View style={[s.rowCenter, { flexDirection: rowDir }]}>
            <Text style={[s.caption, { color: ON_NAVY_MUTED }]}>{todayLabel(lang as 'ar' | 'en')}</Text>
            <AiSourceBadge onDark isRTL={isRTL} />
          </View>
          <NotificationBell onDark />
        </View>

        <Text style={[s.greeting, { textAlign: align }]}>
          {t(greetingKey(new Date().getHours()), user?.firstName ?? '')}
        </Text>

        <View style={s.lessonPanel}>
          {periodLine ? (
            <View
              style={[
                s.periodPill,
                { backgroundColor: colors.accent, flexDirection: rowDir, alignSelf: isRTL ? 'flex-end' : 'flex-start' },
              ]}
            >
              <Ionicons
                name={next?.happeningNow ? 'radio-button-on' : 'time-outline'}
                size={13}
                color={colors.accentForeground}
              />
              <Text style={[s.periodText, { color: colors.accentForeground }]}>{periodLine}</Text>
            </View>
          ) : null}

          <View style={[s.rowCenter, { flexDirection: rowDir }]}>
            <JordanFlag width={17} />
            <Text style={[s.caption, { color: ON_NAVY_MUTED, textAlign: align }]}>
              {[subjectLabel, gradeLabel].filter(Boolean).join(' • ')}
            </Text>
          </View>

          <Text style={[s.lessonTitle, { textAlign: align }]}>{topic || t('homeNoLesson')}</Text>
          {!topic ? (
            <Text style={[s.hint, { color: ON_NAVY_MUTED, textAlign: align }]}>{t('homeNoLessonHint')}</Text>
          ) : null}

          <View style={[s.buttons, { flexDirection: rowDir }]}>
            <PressableScale
              onPress={today.startClass}
              disabled={!topic || startingClass}
              accessibilityLabel={t('startClass')}
              style={[
                s.btn,
                { backgroundColor: START_CLASS_COLOR, flexDirection: rowDir, opacity: !topic ? 0.45 : 1 },
              ]}
            >
              {startingClass
                ? <ActivityIndicator size="small" color={ON_NAVY} />
                : <Ionicons name="tv-outline" size={15} color={ON_NAVY} />}
              <Text style={s.btnText}>{t('startClass')}</Text>
            </PressableScale>
            <PressableScale
              onPress={openLessonPicker}
              style={[
                s.btn,
                s.btnGhost,
                { borderColor: 'rgba(255,255,255,0.28)', backgroundColor: 'rgba(255,255,255,0.06)', flexDirection: rowDir },
              ]}
            >
              <Ionicons name="swap-horizontal" size={15} color={ON_NAVY} />
              <Text style={s.btnText}>{t('changeLesson')}</Text>
            </PressableScale>
          </View>
        </View>
      </Band>

      <View style={s.content}>
        {/* One next thing to set up, as on the desktop: closable for good, and
            not shown to a teacher with no classes yet (the classes section below
            already asks for those). */}
        {setup && !nudgeDismissed && classes.length > 0 ? (
          <Entrance index={section++}>
            <View style={[s.nudge, { backgroundColor: colors.secondary, flexDirection: rowDir }]}>
              <Ionicons name="calendar-outline" size={16} color={colors.primary} />
              <Text style={[s.nudgeText, { color: colors.foreground, textAlign: align }]}>
                {setup.step === 'timetable'
                  ? t('homeSetupTimetable')
                  : t('homeSetupPlan', periodClassLabel(classNameFor(classes, setup.classGroupId, lang as 'ar' | 'en'), setup.subjectId, lang) ?? '')}
              </Text>
              <PressableScale
                onPress={() =>
                  setup.step === 'timetable'
                    ? router.push('/schedule' as never)
                    : router.push({
                        pathname: '/teaching-plans',
                        params: { classId: setup.classGroupId, ...(setup.subjectId ? { subjectId: setup.subjectId } : {}) },
                      } as never)
                }
                style={[s.nudgeBtn, { backgroundColor: colors.primary }]}
              >
                <Text style={[s.nudgeBtnText, { color: colors.primaryForeground }]}>
                  {t(setup.step === 'timetable' ? 'homeSetupTimetableCta' : 'homeSetupPlanCta')}
                </Text>
              </PressableScale>
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
          </Entrance>
        ) : null}

        {startClassError ? (
          <Entrance index={section++}>
            <View style={[s.errorRow, { backgroundColor: colors.destructive + '14', flexDirection: rowDir }]}>
              <Ionicons name="alert-circle-outline" size={14} color={colors.destructive} />
              <Text style={[s.errorText, { color: colors.destructive, textAlign: align }]}>{startClassError}</Text>
            </View>
          </Entrance>
        ) : null}

        <Entrance index={section++}>
          <Surface style={{ padding: SPACE.lg }}>
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
          </Surface>
        </Entrance>

        <Entrance index={section++}>
          <View style={s.group}>
            <Text style={[s.sectionTitle, { color: colors.foreground, textAlign: align }]}>{t('homeQuickTools')}</Text>
            <View style={[s.toolsRow, { flexDirection: rowDir }]}>
              {quickTools.map(tool => (
                <PressableScale
                  key={tool.id}
                  onPress={() => router.push({ pathname: tool.route as never, params: toolParams as never })}
                  style={[s.tool, surface]}
                >
                  <View style={[s.toolIcon, { backgroundColor: tool.color + '1A' }]}>
                    <Ionicons name={tool.icon} size={20} color={tool.color} />
                  </View>
                  <Text numberOfLines={2} style={[s.toolText, { color: colors.foreground }]}>
                    {t(tool.titleKey as never)}
                  </Text>
                </PressableScale>
              ))}
            </View>
          </View>
        </Entrance>

        <Entrance index={section++}>
          {/* Hands off rather than holding its own thread: one conversation per
              teacher, and it lives in the chat. Sending opens it with the
              question already sent. */}
          <Surface style={{ padding: SPACE.lg, gap: SPACE.md }}>
            <View style={[s.rowCenter, { flexDirection: rowDir }]}>
              <IqraaMark size={28} tone="soft" />
              <View style={{ flex: 1 }}>
                <Text style={[s.askTitle, { color: colors.foreground, textAlign: align }]}>{t('homeAssistant')}</Text>
                <Text numberOfLines={1} style={[s.askHint, { color: colors.mutedForeground, textAlign: align }]}>
                  {topic ? t('homeAssistantTiedToLesson') : t('homeNoLesson')}
                </Text>
              </View>
            </View>

            {suggestions.slice(0, 2).map(sug => (
              <PressableScale
                key={sug}
                onPress={() => today.ask(sug)}
                style={[s.sugg, { backgroundColor: colors.background }]}
              >
                <Text style={[s.suggText, { color: colors.foreground, textAlign: align }]}>{sug}</Text>
              </PressableScale>
            ))}

            <View style={[s.composer, { borderColor: colors.border, backgroundColor: colors.background, flexDirection: rowDir }]}>
              <TextInput
                value={draft}
                onChangeText={setDraft}
                onSubmitEditing={sendDraft}
                placeholder={t('homeAskPlaceholder')}
                placeholderTextColor={colors.mutedForeground}
                style={[s.composerInput, { color: colors.foreground, textAlign: align }]}
                accessibilityLabel={t('homeAskPlaceholder')}
                returnKeyType="send"
              />
              <PressableScale
                onPress={sendDraft}
                disabled={!draft.trim()}
                accessibilityLabel={t('iqraSend')}
                hitSlop={8}
                style={[s.send, { backgroundColor: draft.trim() ? colors.primary : colors.muted }]}
              >
                <Ionicons
                  name={isRTL ? 'arrow-back' : 'arrow-forward'}
                  size={16}
                  color={draft.trim() ? colors.primaryForeground : colors.mutedForeground}
                />
              </PressableScale>
            </View>

            <Pressable onPress={() => router.push('/iqra')} accessibilityRole="button">
              <Text style={[s.openChat, { color: colors.primary, textAlign: align }]}>
                {t('homeOpenChat')} {isRTL ? '←' : '→'}
              </Text>
            </Pressable>
          </Surface>
        </Entrance>

        <Entrance index={section++}>
          <View style={s.group}>
            <Text style={[s.sectionTitle, { color: colors.foreground, textAlign: align }]}>{t('homeMyClasses')}</Text>
            {classes.length === 0 ? (
              <Text style={[s.empty, { color: colors.mutedForeground, textAlign: align }]}>{t('homeNoClasses')}</Text>
            ) : (
              <View style={[s.chips, { flexDirection: rowDir }]}>
                {classes.slice(0, 6).map(group => (
                  <PressableScale
                    key={group.id}
                    onPress={() => router.push({ pathname: '/classes/[id]', params: { id: group.id } })}
                    style={[s.classChip, { backgroundColor: colors.secondary, borderColor: colors.primary + '2E' }]}
                  >
                    <Text style={[s.classChipText, { color: colors.primary }]}>
                      {className(group, lang as 'ar' | 'en')}
                    </Text>
                  </PressableScale>
                ))}
              </View>
            )}
          </View>
        </Entrance>
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  topRow: { minHeight: 44, alignItems: 'center', justifyContent: 'space-between' },
  rowCenter: { alignItems: 'center', gap: SPACE.sm },
  caption: { fontSize: TYPE.caption, lineHeight: 21, fontFamily: 'Almarai_400Regular' },
  greeting: { color: ON_NAVY, fontSize: TYPE.headline, lineHeight: 34, fontFamily: 'ReadexPro_700Bold' },

  lessonPanel: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderColor: 'rgba(255,255,255,0.16)',
    borderWidth: 1,
    borderRadius: RADIUS.lg,
    padding: SPACE.lg,
    gap: SPACE.sm,
  },
  periodPill: { alignItems: 'center', gap: SPACE.sm, borderRadius: RADIUS.pill, paddingHorizontal: SPACE.md, paddingVertical: SPACE.xs },
  periodText: { fontSize: TYPE.caption, fontFamily: 'ReadexPro_600SemiBold' },
  lessonTitle: { color: ON_NAVY, fontSize: TYPE.title, lineHeight: 30, fontFamily: 'ReadexPro_700Bold' },
  hint: { fontSize: TYPE.body, lineHeight: 24, fontFamily: 'Almarai_400Regular' },
  buttons: { gap: SPACE.sm, marginTop: SPACE.xs },
  btn: {
    flex: 1,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACE.sm,
    paddingHorizontal: SPACE.md,
    borderRadius: RADIUS.md,
  },
  btnGhost: { borderWidth: 1 },
  btnText: { color: ON_NAVY, fontSize: TYPE.caption, fontFamily: 'ReadexPro_600SemiBold' },

  content: { padding: SPACE.lg, gap: SPACE.lg },
  group: { gap: SPACE.md },
  sectionTitle: { fontSize: TYPE.body, fontFamily: 'ReadexPro_600SemiBold' },

  nudge: { alignItems: 'center', gap: SPACE.md, borderRadius: RADIUS.md, paddingVertical: SPACE.sm, paddingHorizontal: SPACE.md },
  nudgeText: { flex: 1, fontSize: TYPE.body, lineHeight: 23, fontFamily: 'Almarai_400Regular' },
  nudgeBtn: { borderRadius: RADIUS.pill, paddingHorizontal: SPACE.md, paddingVertical: SPACE.sm },
  nudgeBtnText: { fontSize: TYPE.caption, fontFamily: 'ReadexPro_600SemiBold' },
  nudgeClose: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  errorRow: { alignItems: 'center', gap: SPACE.sm, borderRadius: RADIUS.md, padding: SPACE.sm },
  errorText: { flex: 1, fontSize: TYPE.caption, lineHeight: 21, fontFamily: 'Almarai_400Regular' },

  toolsRow: { gap: SPACE.md },
  tool: { flex: 1, alignItems: 'center', gap: SPACE.sm, paddingVertical: SPACE.md, paddingHorizontal: SPACE.xs },
  toolIcon: { width: 40, height: 40, borderRadius: RADIUS.md, alignItems: 'center', justifyContent: 'center' },
  toolText: { fontSize: TYPE.caption, lineHeight: 19, fontFamily: 'ReadexPro_600SemiBold', textAlign: 'center' },

  askTitle: { fontSize: TYPE.body, fontFamily: 'ReadexPro_600SemiBold' },
  askHint: { fontSize: TYPE.caption, lineHeight: 20, fontFamily: 'Almarai_400Regular', marginTop: SPACE.xxs },
  sugg: { borderRadius: RADIUS.md, paddingHorizontal: SPACE.md, paddingVertical: SPACE.md },
  suggText: { fontSize: TYPE.body, lineHeight: 23, fontFamily: 'Almarai_400Regular' },
  composer: { alignItems: 'center', gap: SPACE.sm, borderWidth: 1, borderRadius: RADIUS.md, paddingHorizontal: SPACE.md, paddingVertical: SPACE.sm },
  composerInput: { flex: 1, minHeight: 32, fontSize: TYPE.body, fontFamily: 'Almarai_400Regular', outlineStyle: 'none' as never },
  send: { width: 32, height: 32, borderRadius: RADIUS.lg, alignItems: 'center', justifyContent: 'center' },
  openChat: { fontSize: TYPE.caption, fontFamily: 'ReadexPro_600SemiBold', paddingVertical: SPACE.xs },

  chips: { gap: SPACE.md, flexWrap: 'wrap' },
  classChip: { borderWidth: 1, borderRadius: RADIUS.md, paddingHorizontal: SPACE.lg, paddingVertical: SPACE.md },
  classChipText: { fontSize: TYPE.caption, fontFamily: 'ReadexPro_500Medium' },
  empty: { fontSize: TYPE.body, lineHeight: 24, fontFamily: 'Almarai_400Regular' },
});
