import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useLanguage } from '@/context/LanguageContext';
import { ActivitySlide, ClassroomActivity } from '@/services/ai/AIService';
import { getPendingClassroomActivity, clearClassroomActivity } from '@/services/classroomStore';
import { timerColor } from '@/services/presentationUtils';

// ─── Color constants ──────────────────────────────────────────────────────────
const BG = '#0D0D14';
const CARD_BG = '#16171F';
const BORDER = '#2A2B38';
const TEXT_PRIMARY = '#F2F2F6';
const TEXT_MUTED = '#8B8CA4';
const ACCENT = '#4F46E5';
const TIMER_GREEN = '#22C55E';
const TIMER_AMBER = '#F59E0B';
const TIMER_RED = '#EF4444';

function slideTypeAccent(type: ActivitySlide['type']): string {
  if (type === 'challenge') return '#E67E22';
  if (type === 'reveal') return '#22C55E';
  if (type === 'summary') return ACCENT;
  if (type === 'bingo-call') return '#A855F7';
  if (type === 'relay-problem') return '#F43F5E';
  return '#8B8CA4';
}

// ─── Teacher Panel ────────────────────────────────────────────────────────────
function TeacherPanel({
  slide, isRTL, t, onClose,
}: {
  slide: ActivitySlide;
  isRTL: boolean;
  t: (k: any) => string;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const translateY = useRef(new Animated.Value(600)).current;

  useEffect(() => {
    Animated.spring(translateY, { toValue: 0, useNativeDriver: true, damping: 22, stiffness: 200 }).start();
  }, []);

  const close = () => {
    Animated.timing(translateY, { toValue: 600, duration: 220, useNativeDriver: true }).start(onClose);
  };

  const teacher = slide.teacher;
  if (!teacher) return null;

  const Section = ({ label, content }: { label: string; content: string }) => (
    <View style={panelStyles.section}>
      <Text style={[panelStyles.sectionLabel, { textAlign: isRTL ? 'right' : 'left' }]}>{label}</Text>
      <Text style={[panelStyles.sectionText, { textAlign: isRTL ? 'right' : 'left' }]}>{content}</Text>
    </View>
  );

  return (
    <Animated.View style={[panelStyles.overlay, { transform: [{ translateY }] }]}>
      <View style={[panelStyles.panel, { paddingBottom: insets.bottom + 16 }]}>
        {/* Handle */}
        <View style={panelStyles.handle} />
        {/* Header */}
        <View style={[panelStyles.header, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
          <Ionicons name="school-outline" size={18} color={ACCENT} />
          <Text style={[panelStyles.headerText, { fontFamily: 'Inter_700Bold' }]}>{t('teacherPanelTitle')}</Text>
          <Pressable onPress={close} style={panelStyles.closeBtn} hitSlop={12}>
            <Ionicons name="close" size={20} color={TEXT_MUTED} />
          </Pressable>
        </View>
        <ScrollView showsVerticalScrollIndicator={false}>
          <Section label={t('expectedAnswerLabel')} content={teacher.expectedAnswer} />
          {teacher.commonMisconceptions ? <Section label={t('misconceptionsLabel')} content={teacher.commonMisconceptions} /> : null}
          {teacher.teachingTips ? <Section label={t('teachingTipsLabel2')} content={teacher.teachingTips} /> : null}
          {teacher.suggestedQuestions?.length ? (
            <View style={panelStyles.section}>
              <Text style={[panelStyles.sectionLabel, { textAlign: isRTL ? 'right' : 'left' }]}>{t('suggestedQuestionsLabel')}</Text>
              {teacher.suggestedQuestions.map((q, i) => (
                <Text key={i} style={[panelStyles.bulletQ, { textAlign: isRTL ? 'right' : 'left' }]}>{'• '}{q}</Text>
              ))}
            </View>
          ) : null}
          {teacher.differentiationTips ? <Section label={t('differentiationLabel')} content={teacher.differentiationTips} /> : null}
        </ScrollView>
      </View>
    </Animated.View>
  );
}

// ─── Slide Content ────────────────────────────────────────────────────────────
function SlideView({ slide, isRTL }: { slide: ActivitySlide; isRTL: boolean }) {
  const accent = slideTypeAccent(slide.type);
  const lines = slide.content.split('\n');

  return (
    <View style={slideStyles.container}>
      {/* Slide type badge */}
      <View style={[slideStyles.badge, { backgroundColor: accent + '22', borderColor: accent + '44' }]}>
        <Text style={[slideStyles.badgeText, { color: accent, fontFamily: 'Inter_600SemiBold' }]}>
          {slide.type === 'intro' ? '🎯'
            : slide.type === 'challenge' ? '🔐'
            : slide.type === 'reveal' ? '🔓'
            : slide.type === 'bingo-call' ? '🎱'
            : slide.type === 'relay-problem' ? '🏃'
            : '🎉'}
          {'  '}{slide.title}
        </Text>
      </View>

      {/* Content lines */}
      {lines.map((line, i) => {
        const isEquation = /[=²³√±×÷]/.test(line) || /\d+x/.test(line);
        return (
          <Text
            key={i}
            style={[
              isEquation ? slideStyles.equation : slideStyles.bodyLine,
              { textAlign: isRTL ? 'right' : 'left', fontFamily: isEquation ? 'Inter_700Bold' : 'Inter_400Regular' },
            ]}
          >
            {line}
          </Text>
        );
      })}

      {/* Unlock code badge */}
      {slide.unlockCode && slide.type === 'reveal' && (
        <View style={slideStyles.codeBadge}>
          <Text style={[slideStyles.codeLabel, { fontFamily: 'Inter_500Medium' }]}>🔑</Text>
          <Text style={[slideStyles.codeValue, { fontFamily: 'Inter_700Bold' }]}>{slide.unlockCode}</Text>
        </View>
      )}
    </View>
  );
}

// ─── Main Presentation Screen ─────────────────────────────────────────────────
export default function PresentationScreen() {
  const { t, isRTL } = useLanguage();
  const insets = useSafeAreaInsets();

  const [activity, setActivity] = useState<ClassroomActivity | null>(null);
  const [slideIndex, setSlideIndex] = useState(0);
  const [hintVisible, setHintVisible] = useState(false);
  const [answerVisible, setAnswerVisible] = useState(false);
  const [teacherPanelOpen, setTeacherPanelOpen] = useState(false);
  const [timerSec, setTimerSec] = useState(0);
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerTotal, setTimerTotal] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Slide fade animation
  const fadeAnim = useRef(new Animated.Value(1)).current;

  // Load activity on mount
  useEffect(() => {
    const a = getPendingClassroomActivity();
    if (a) {
      setActivity(a);
      initSlide(a.slides[0]);
    }
  }, []);

  // Hide status bar while in presentation mode
  useFocusEffect(
    useCallback(() => {
      StatusBar.setHidden(true, 'fade');
      return () => {
        StatusBar.setHidden(false, 'fade');
        clearIntervalIfRunning();
        clearClassroomActivity();
      };
    }, []),
  );

  const clearIntervalIfRunning = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const initSlide = (slide: ActivitySlide) => {
    setHintVisible(false);
    setAnswerVisible(false);
    setTeacherPanelOpen(false);
    if (slide.durationSeconds > 0) {
      clearIntervalIfRunning();
      setTimerSec(slide.durationSeconds);
      setTimerTotal(slide.durationSeconds);
      setTimerRunning(true);
    } else {
      clearIntervalIfRunning();
      setTimerSec(0);
      setTimerTotal(0);
      setTimerRunning(false);
    }
  };

  // Timer tick
  useEffect(() => {
    if (timerRunning && timerSec > 0) {
      timerRef.current = setInterval(() => {
        setTimerSec(s => {
          if (s <= 1) {
            clearIntervalIfRunning();
            setTimerRunning(false);
            return 0;
          }
          return s - 1;
        });
      }, 1000);
    }
    return clearIntervalIfRunning;
  }, [timerRunning]);

  const goToSlide = (idx: number) => {
    if (!activity || idx < 0 || idx >= activity.slides.length) return;
    Animated.timing(fadeAnim, { toValue: 0, duration: 140, useNativeDriver: true }).start(() => {
      setSlideIndex(idx);
      initSlide(activity.slides[idx]);
      Animated.timing(fadeAnim, { toValue: 1, duration: 180, useNativeDriver: true }).start();
    });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const restartTimer = () => {
    if (!activity) return;
    const s = activity.slides[slideIndex];
    if (s.durationSeconds > 0) {
      clearIntervalIfRunning();
      setTimerSec(s.durationSeconds);
      setTimerTotal(s.durationSeconds);
      setTimerRunning(true);
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  if (!activity) {
    return (
      <View style={[styles.container, styles.centered]}>
        <StatusBar hidden />
        <Text style={[styles.noActivity, { fontFamily: 'Inter_400Regular' }]}>{t('noActivityLoaded')}</Text>
        <Pressable onPress={() => router.back()} style={styles.exitBtn}>
          <Text style={{ color: ACCENT, fontFamily: 'Inter_600SemiBold' }}>{t('exitPresentation')}</Text>
        </Pressable>
      </View>
    );
  }

  const slide = activity.slides[slideIndex];
  const totalSlides = activity.slides.length;
  const isFirst = slideIndex === 0;
  const isLast = slideIndex === totalSlides - 1;
  const hasTimer = timerTotal > 0;
  const timerPct = hasTimer ? timerSec / timerTotal : 0;
  const tColor = timerColor(timerPct);
  const hasTeacherNotes = !!slide.teacher;
  const challengeSlides = activity.slides.filter(s => s.type === 'challenge').length;

  // Format timer MM:SS
  const mm = Math.floor(timerSec / 60).toString().padStart(2, '0');
  const ss = (timerSec % 60).toString().padStart(2, '0');

  return (
    <View style={styles.container}>
      <StatusBar hidden />

      {/* ── Top Bar ── */}
      <View style={[styles.topBar, { paddingTop: insets.top + 8, flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
        {/* Exit */}
        <Pressable onPress={() => router.back()} style={styles.exitBtn} hitSlop={12}>
          <Ionicons name="close" size={22} color={TEXT_MUTED} />
        </Pressable>

        {/* Progress dots */}
        <View style={[styles.progressRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
          {activity.slides.map((s, i) => (
            <Pressable key={i} onPress={() => goToSlide(i)}>
              <View style={[
                styles.dot,
                {
                  width: i === slideIndex ? 20 : 6,
                  backgroundColor: i === slideIndex ? slideTypeAccent(s.type) : (i < slideIndex ? BORDER + 'aa' : BORDER),
                },
              ]} />
            </Pressable>
          ))}
        </View>

        {/* Timer */}
        {hasTimer ? (
          <View style={[styles.timerBox, { borderColor: tColor + '44', backgroundColor: tColor + '15' }]}>
            <Ionicons name="timer-outline" size={13} color={tColor} />
            <Text style={[styles.timerText, { color: tColor, fontFamily: 'Inter_700Bold' }]}>{mm}:{ss}</Text>
          </View>
        ) : (
          <View style={{ width: 76 }} />
        )}
      </View>

      {/* ── Timer Bar ── */}
      {hasTimer && (
        <View style={styles.timerBarTrack}>
          <View style={[styles.timerBarFill, { width: `${timerPct * 100}%` as any, backgroundColor: tColor }]} />
        </View>
      )}

      {/* ── Slide Content ── */}
      <Animated.View style={[styles.slideArea, { opacity: fadeAnim }]}>
        <ScrollView
          contentContainerStyle={[styles.slideScroll, { paddingTop: hasTimer ? 8 : 16 }]}
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          <SlideView slide={slide} isRTL={isRTL} />

          {/* Hint */}
          {slide.hint && (
            <View style={styles.revealSection}>
              <Pressable
                onPress={() => { setHintVisible(v => !v); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
                style={[styles.revealBtn, { borderColor: TIMER_AMBER + '60', backgroundColor: TIMER_AMBER + '12', flexDirection: isRTL ? 'row-reverse' : 'row' }]}
              >
                <Ionicons name="bulb-outline" size={16} color={TIMER_AMBER} />
                <Text style={[styles.revealBtnText, { color: TIMER_AMBER, fontFamily: 'Inter_600SemiBold' }]}>
                  {hintVisible ? t('hideHint') : t('revealHint')}
                </Text>
              </Pressable>
              {hintVisible && (
                <View style={[styles.revealContent, { borderColor: TIMER_AMBER + '40', backgroundColor: TIMER_AMBER + '10' }]}>
                  <Text style={[styles.revealText, { textAlign: isRTL ? 'right' : 'left', fontFamily: 'Inter_400Regular' }]}>
                    {slide.hint}
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* Answer */}
          {slide.answer && (
            <View style={styles.revealSection}>
              <Pressable
                onPress={() => { setAnswerVisible(v => !v); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); }}
                style={[styles.revealBtn, { borderColor: TIMER_GREEN + '60', backgroundColor: TIMER_GREEN + '12', flexDirection: isRTL ? 'row-reverse' : 'row' }]}
              >
                <Ionicons name="checkmark-circle-outline" size={16} color={TIMER_GREEN} />
                <Text style={[styles.revealBtnText, { color: TIMER_GREEN, fontFamily: 'Inter_600SemiBold' }]}>
                  {answerVisible ? t('hideAnswer') : t('revealAnswer')}
                </Text>
              </Pressable>
              {answerVisible && (
                <View style={[styles.revealContent, { borderColor: TIMER_GREEN + '40', backgroundColor: TIMER_GREEN + '10' }]}>
                  <Text style={[styles.revealText, { textAlign: isRTL ? 'right' : 'left', fontFamily: 'Inter_700Bold' }]}>
                    {slide.answer}
                  </Text>
                </View>
              )}
            </View>
          )}
        </ScrollView>
      </Animated.View>

      {/* ── Bottom Controls ── */}
      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 10, flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
        {/* Prev */}
        <Pressable
          onPress={() => goToSlide(slideIndex - 1)}
          disabled={isFirst}
          style={[styles.navBtn, { opacity: isFirst ? 0.3 : 1 }]}
        >
          <Ionicons name={isRTL ? 'chevron-forward' : 'chevron-back'} size={22} color={TEXT_PRIMARY} />
        </Pressable>

        {/* Action row */}
        <View style={[styles.actionRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
          {hasTimer && (
            <Pressable onPress={restartTimer} style={styles.actionBtn} hitSlop={8}>
              <Ionicons name="refresh-outline" size={18} color={TEXT_MUTED} />
              <Text style={[styles.actionLabel, { fontFamily: 'Inter_400Regular' }]}>{t('restartTimer')}</Text>
            </Pressable>
          )}
          {hasTeacherNotes && (
            <Pressable onPress={() => setTeacherPanelOpen(true)} style={[styles.actionBtn, { borderColor: ACCENT + '50', backgroundColor: ACCENT + '12' }]} hitSlop={8}>
              <Ionicons name="school-outline" size={18} color={ACCENT} />
              <Text style={[styles.actionLabel, { color: ACCENT, fontFamily: 'Inter_500Medium' }]}>{t('teacherPanelTitle')}</Text>
            </Pressable>
          )}
        </View>

        {/* Next */}
        <Pressable
          onPress={() => goToSlide(slideIndex + 1)}
          disabled={isLast}
          style={[styles.navBtn, { opacity: isLast ? 0.3 : 1, backgroundColor: isLast ? 'transparent' : ACCENT }]}
        >
          <Ionicons name={isRTL ? 'chevron-back' : 'chevron-forward'} size={22} color={isLast ? TEXT_MUTED : '#fff'} />
        </Pressable>
      </View>

      {/* ── Teacher Panel ── */}
      {teacherPanelOpen && slide.teacher && (
        <TeacherPanel slide={slide} isRTL={isRTL} t={t} onClose={() => setTeacherPanelOpen(false)} />
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  centered: { alignItems: 'center', justifyContent: 'center' },
  noActivity: { color: TEXT_MUTED, fontSize: 14, marginBottom: 16 },
  topBar: { alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 10 },
  exitBtn: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 19, backgroundColor: CARD_BG, borderWidth: 1, borderColor: BORDER },
  progressRow: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 4, paddingHorizontal: 12 },
  dot: { height: 6, borderRadius: 3 },
  timerBox: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20, borderWidth: 1 },
  timerText: { fontSize: 14 },
  timerBarTrack: { height: 3, backgroundColor: BORDER, marginHorizontal: 0 },
  timerBarFill: { height: 3 },
  slideArea: { flex: 1 },
  slideScroll: { paddingHorizontal: 24, paddingBottom: 20 },
  revealSection: { marginTop: 12, gap: 8 },
  revealBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 10, borderWidth: 1 },
  revealBtnText: { fontSize: 14 },
  revealContent: { padding: 14, borderRadius: 10, borderWidth: 1 },
  revealText: { fontSize: 14, color: TEXT_PRIMARY, lineHeight: 22 },
  bottomBar: { alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 12, borderTopWidth: 1, borderTopColor: BORDER, backgroundColor: CARD_BG },
  navBtn: { width: 46, height: 46, alignItems: 'center', justifyContent: 'center', borderRadius: 23 },
  actionRow: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, paddingHorizontal: 10 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: BORDER },
  actionLabel: { fontSize: 12, color: TEXT_MUTED },
});

const slideStyles = StyleSheet.create({
  container: { flex: 1, paddingTop: 20 },
  badge: { alignSelf: 'center', paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1, marginBottom: 28 },
  badgeText: { fontSize: 14 },
  bodyLine: { fontSize: 20, color: TEXT_PRIMARY, lineHeight: 32, marginBottom: 8 },
  equation: { fontSize: 30, color: TEXT_PRIMARY, textAlign: 'center', marginVertical: 20, lineHeight: 42 },
  codeBadge: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, marginTop: 28, backgroundColor: TIMER_GREEN + '15', borderRadius: 14, borderWidth: 1, borderColor: TIMER_GREEN + '40', padding: 20 },
  codeLabel: { fontSize: 28 },
  codeValue: { fontSize: 48, color: TIMER_GREEN },
});

const panelStyles = StyleSheet.create({
  overlay: { position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 10 },
  panel: { backgroundColor: '#1A1B26', borderTopLeftRadius: 20, borderTopRightRadius: 20, borderTopWidth: 1, borderColor: BORDER, paddingHorizontal: 20, paddingTop: 12, maxHeight: 480 },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: BORDER, alignSelf: 'center', marginBottom: 16 },
  header: { alignItems: 'center', gap: 8, marginBottom: 16 },
  headerText: { flex: 1, fontSize: 16, color: TEXT_PRIMARY },
  closeBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  section: { marginBottom: 16 },
  sectionLabel: { fontSize: 11, color: ACCENT, fontFamily: 'Inter_600SemiBold', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  sectionText: { fontSize: 13, color: TEXT_PRIMARY, lineHeight: 20 },
  bulletQ: { fontSize: 13, color: TEXT_PRIMARY, lineHeight: 20, marginBottom: 4 },
});
