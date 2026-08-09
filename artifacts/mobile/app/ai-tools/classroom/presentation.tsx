import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Image,
  Linking,
  Platform,
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
import { geogebraCommandUrl, openGeogebraWithCommands } from '@/services/geogebra';
import { youtubeEmbedUrl } from '@/services/classMedia';

/** Open a media URL outside the app (native fallback — no WebView dep). */
async function openExternalMedia(url: string): Promise<void> {
  if (!url) return;
  try {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.open(url, '_blank', 'noopener,noreferrer');
      return;
    }
    await Linking.openURL(url);
  } catch {
    // ignore — nothing to project
  }
}

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
  if (type === 'question') return '#3B82F6';
  if (type === 'graph') return '#0EA5E9';
  if (type === 'media') return '#B45309';
  return '#8B8CA4';
}

// ─── Graph slide (GeoGebra) ───────────────────────────────────────────────────
// On web (the projector case) the calculator is embedded so the class sees the
// curve inside the deck; on native there's no WebView dependency, so we open
// GeoGebra full-screen instead.
function GraphView({ slide, isRTL, t }: { slide: ActivitySlide; isRTL: boolean; t: (k: any) => string }) {
  const commands = slide.graphCommands ?? [];
  const url = geogebraCommandUrl(commands);

  return (
    <View style={mediaStyles.wrap}>
      {commands.length > 0 ? (
        <View style={mediaStyles.cmdRow}>
          {commands.map((c, i) => (
            <View key={i} style={mediaStyles.cmdPill}>
              <Text style={[mediaStyles.cmdText, { fontFamily: 'Inter_700Bold' }]}>{c}</Text>
            </View>
          ))}
        </View>
      ) : (
        // A blank calculator with no explanation reads as a bug mid-lesson.
        <Text
          style={[
            mediaStyles.emptyHint,
            { fontFamily: 'Inter_400Regular', textAlign: isRTL ? 'right' : 'left' },
          ]}
        >
          {t('graphEmptyHint')}
        </Text>
      )}

      {Platform.OS === 'web' ? (
        <View style={mediaStyles.frame}>
          {React.createElement('iframe', {
            src: url,
            style: { width: '100%', height: '100%', border: '0', borderRadius: 14 },
            allowFullScreen: true,
            title: 'GeoGebra',
          })}
        </View>
      ) : (
        <Pressable
          onPress={() => { void openGeogebraWithCommands(commands); }}
          style={[mediaStyles.openBtn, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}
        >
          <Ionicons name="stats-chart" size={20} color="#fff" />
          <Text style={[mediaStyles.openBtnText, { fontFamily: 'Inter_700Bold' }]}>
            {t('openGraph')}
          </Text>
        </Pressable>
      )}
    </View>
  );
}

// ─── Media slide (image / YouTube) ────────────────────────────────────────────
function MediaView({ slide, isRTL, t }: { slide: ActivitySlide; isRTL: boolean; t: (k: any) => string }) {
  const url = slide.mediaUrl ?? '';
  const embed = slide.mediaKind === 'video' ? youtubeEmbedUrl(url) : null;

  return (
    <View style={mediaStyles.wrap}>
      {slide.mediaKind === 'image' ? (
        <Image
          source={{ uri: url }}
          style={mediaStyles.image}
          resizeMode="contain"
          accessibilityLabel={slide.mediaCaption || ''}
        />
      ) : Platform.OS === 'web' && embed ? (
        <View style={mediaStyles.frame}>
          {React.createElement('iframe', {
            src: embed,
            style: { width: '100%', height: '100%', border: '0', borderRadius: 14 },
            allow: 'accelerometer; clipboard-write; encrypted-media; picture-in-picture; fullscreen',
            allowFullScreen: true,
            title: slide.mediaCaption || 'video',
          })}
        </View>
      ) : (
        <Pressable
          onPress={() => { void openExternalMedia(url); }}
          style={[mediaStyles.openBtn, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}
        >
          <Ionicons name="play-circle" size={20} color="#fff" />
          <Text style={[mediaStyles.openBtnText, { fontFamily: 'Inter_700Bold' }]}>
            {t('openMedia')}
          </Text>
        </Pressable>
      )}
    </View>
  );
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

// ─── Question Slide (whole-class ABCD response) ──────────────────────────────
function QuestionOptions({
  slide, isRTL, t, revealed, onToggleReveal,
}: {
  slide: ActivitySlide;
  isRTL: boolean;
  t: (k: any) => string;
  revealed: boolean;
  onToggleReveal: () => void;
}) {
  const options = slide.options ?? [];
  if (options.length === 0) return null;
  // Arabic response letters mirror the printed أ ب ج د cards students hold up.
  const letters = isRTL ? ['أ', 'ب', 'ج', 'د', 'هـ'] : ['A', 'B', 'C', 'D', 'E'];

  return (
    <View style={qStyles.wrap}>
      {/* Routine reminder — projected so students see the rule, not just hear it */}
      <View style={[qStyles.respondBanner, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
        <Ionicons name="hand-left-outline" size={16} color="#3B82F6" />
        <Text style={[qStyles.respondText, { fontFamily: 'Inter_600SemiBold' }]}>
          {t('allStudentsAnswer')}
        </Text>
      </View>

      <View style={qStyles.grid}>
        {options.map((opt, i) => {
          const isCorrect = revealed && i === slide.correctIndex;
          const isDimmed = revealed && i !== slide.correctIndex;
          return (
            <View
              key={i}
              style={[
                qStyles.option,
                {
                  borderColor: isCorrect ? TIMER_GREEN : BORDER,
                  backgroundColor: isCorrect ? TIMER_GREEN + '18' : CARD_BG,
                  opacity: isDimmed ? 0.4 : 1,
                  flexDirection: isRTL ? 'row-reverse' : 'row',
                },
              ]}
            >
              <View style={[qStyles.letterBadge, { backgroundColor: isCorrect ? TIMER_GREEN : '#3B82F6' + '30' }]}>
                <Text style={[qStyles.letterText, { color: isCorrect ? '#fff' : '#3B82F6', fontFamily: 'Inter_700Bold' }]}>
                  {letters[i] ?? '•'}
                </Text>
              </View>
              <Text
                style={[
                  qStyles.optionText,
                  { textAlign: isRTL ? 'right' : 'left', fontFamily: isCorrect ? 'Inter_700Bold' : 'Inter_500Medium' },
                ]}
              >
                {opt}
              </Text>
              {isCorrect && <Ionicons name="checkmark-circle" size={26} color={TIMER_GREEN} />}
            </View>
          );
        })}
      </View>

      {/* Reveal control */}
      <Pressable
        onPress={onToggleReveal}
        style={[
          qStyles.revealBtn,
          {
            borderColor: revealed ? BORDER : TIMER_GREEN + '60',
            backgroundColor: revealed ? 'transparent' : TIMER_GREEN + '12',
            flexDirection: isRTL ? 'row-reverse' : 'row',
          },
        ]}
      >
        <Ionicons name={revealed ? 'eye-off-outline' : 'checkmark-circle-outline'} size={18} color={revealed ? TEXT_MUTED : TIMER_GREEN} />
        <Text style={[qStyles.revealBtnText, { color: revealed ? TEXT_MUTED : TIMER_GREEN, fontFamily: 'Inter_600SemiBold' }]}>
          {revealed ? t('hideAnswer') : t('revealAnswer')}
        </Text>
      </Pressable>

      {/* The trust moment: the projected proof that this key cannot be wrong */}
      {revealed && slide.verified && (
        <View style={[qStyles.verifiedBadge, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
          <Ionicons name="shield-checkmark" size={16} color={TIMER_GREEN} />
          <Text style={[qStyles.verifiedText, { fontFamily: 'Inter_600SemiBold' }]}>
            {t('verifiedAnswerBadge')}
          </Text>
        </View>
      )}
    </View>
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
            : slide.type === 'question' ? '🙋'
            : slide.type === 'graph' ? '📈'
            : slide.type === 'media' ? '🎬'
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
  const [celebrationVisible, setCelebrationVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const celebrationAnim = useRef(new Animated.Value(0)).current;
  const celebrationScale = useRef(new Animated.Value(0.5)).current;

  // Slide fade animation
  const fadeAnim = useRef(new Animated.Value(1)).current;

  // Load activity on mount — redirect back to hub if store is empty
  useEffect(() => {
    const a = getPendingClassroomActivity();
    if (a) {
      setActivity(a);
      initSlide(a.slides[0]);
    } else {
      router.replace({
        pathname: '/ai-tools/classroom',
        params: { noActivity: '1' },
      } as any);
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

  const showCelebration = () => {
    setCelebrationVisible(true);
    celebrationAnim.setValue(0);
    celebrationScale.setValue(0.5);
    Animated.parallel([
      Animated.spring(celebrationAnim,  { toValue: 1, useNativeDriver: true, damping: 14, stiffness: 180 }),
      Animated.spring(celebrationScale, { toValue: 1, useNativeDriver: true, damping: 14, stiffness: 180 }),
    ]).start();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setTimeout(() => {
      Animated.timing(celebrationAnim, { toValue: 0, duration: 400, useNativeDriver: true }).start(() => {
        setCelebrationVisible(false);
      });
    }, 2800);
  };

  const goToSlide = (idx: number) => {
    if (!activity || idx < 0 || idx >= activity.slides.length) return;
    const nextSlide = activity.slides[idx];
    Animated.timing(fadeAnim, { toValue: 0, duration: 140, useNativeDriver: true }).start(() => {
      setSlideIndex(idx);
      initSlide(nextSlide);
      Animated.timing(fadeAnim, { toValue: 1, duration: 180, useNativeDriver: true }).start();
    });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    // Trigger celebration on summary slides
    if (nextSlide.type === 'summary') {
      setTimeout(showCelebration, 350);
    }
  };

  // Keyboard + presentation-clicker control (web/projector). A teacher runs
  // the class from the front of the room, not from the laptop: clickers send
  // PageDown/PageUp or arrows, and Space is the universal "advance".
  // Arrow direction follows the on-screen buttons, which mirror in RTL.
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const onKey = (e: KeyboardEvent) => {
      const forwardKeys = ['PageDown', ' ', 'Spacebar', 'Enter', isRTL ? 'ArrowLeft' : 'ArrowRight'];
      const backKeys = ['PageUp', isRTL ? 'ArrowRight' : 'ArrowLeft'];
      if (forwardKeys.includes(e.key)) {
        e.preventDefault();
        setSlideIndexSafely(1);
      } else if (backKeys.includes(e.key)) {
        e.preventDefault();
        setSlideIndexSafely(-1);
      } else if (e.key === 'Escape') {
        router.back();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  /** Step relative to the CURRENT slide (read from state at call time). */
  const setSlideIndexSafely = (delta: number) => {
    setSlideIndex(current => {
      const next = current + delta;
      if (!activity || next < 0 || next >= activity.slides.length) return current;
      initSlide(activity.slides[next]!);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      if (activity.slides[next]!.type === 'summary') setTimeout(showCelebration, 350);
      return next;
    });
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

  // While redirecting (activity is null), render nothing
  if (!activity) return null;

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

        {/* Progress dots — each wrapped in a real touch target (the bare 6px
            dots were unhittable, which stranded teachers on slide 1). */}
        <View style={[styles.progressRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
          {activity.slides.map((s, i) => (
            <Pressable key={i} onPress={() => goToSlide(i)} hitSlop={8} style={styles.dotTarget}>
              <View style={[
                styles.dot,
                {
                  width: i === slideIndex ? 20 : 8,
                  height: i === slideIndex ? 8 : 8,
                  backgroundColor: i === slideIndex ? slideTypeAccent(s.type) : (i < slideIndex ? BORDER + 'aa' : BORDER),
                },
              ]} />
            </Pressable>
          ))}
        </View>

        {/* Position + what this slide is — orientation at a glance */}
        <View style={styles.counterBox}>
          <Text style={[styles.counterText, { fontFamily: 'Inter_700Bold' }]}>
            {slideIndex + 1}/{totalSlides}
          </Text>
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

          {/* Graph (GeoGebra) and media (image / YouTube) slides */}
          {slide.type === 'graph' && <GraphView slide={slide} isRTL={isRTL} t={t} />}
          {slide.type === 'media' && <MediaView slide={slide} isRTL={isRTL} t={t} />}

          {/* Whole-class ABCD options (question slides own their reveal) */}
          {slide.type === 'question' && (
            <QuestionOptions
              slide={slide}
              isRTL={isRTL}
              t={t}
              revealed={answerVisible}
              onToggleReveal={() => {
                setAnswerVisible(v => !v);
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              }}
            />
          )}

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

          {/* Answer (question slides reveal through their option grid instead) */}
          {slide.answer && slide.type !== 'question' && (
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
        {/* Prev — labelled: an unlabelled chevron in an RTL layout is a
            coin-flip for which way is "forward". */}
        <Pressable
          onPress={() => goToSlide(slideIndex - 1)}
          disabled={isFirst}
          style={[styles.navBtnWide, { opacity: isFirst ? 0.3 : 1, flexDirection: isRTL ? 'row-reverse' : 'row' }]}
          accessibilityRole="button"
          accessibilityLabel={t('prevSlide')}
        >
          <Ionicons name={isRTL ? 'chevron-forward' : 'chevron-back'} size={20} color={TEXT_PRIMARY} />
          <Text style={[styles.navLabel, { color: TEXT_PRIMARY, fontFamily: 'Inter_500Medium' }]}>
            {t('prevSlide')}
          </Text>
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
          style={[
            styles.navBtnWide,
            {
              opacity: isLast ? 0.3 : 1,
              backgroundColor: isLast ? 'transparent' : ACCENT,
              flexDirection: isRTL ? 'row-reverse' : 'row',
            },
          ]}
          accessibilityRole="button"
          accessibilityLabel={t('nextSlide')}
        >
          <Text style={[styles.navLabel, { color: isLast ? TEXT_MUTED : '#fff', fontFamily: 'Inter_700Bold' }]}>
            {t('nextSlide')}
          </Text>
          <Ionicons name={isRTL ? 'chevron-back' : 'chevron-forward'} size={20} color={isLast ? TEXT_MUTED : '#fff'} />
        </Pressable>
      </View>

      {/* ── Teacher Panel ── */}
      {teacherPanelOpen && slide.teacher && (
        <TeacherPanel slide={slide} isRTL={isRTL} t={t} onClose={() => setTeacherPanelOpen(false)} />
      )}

      {/* ── Celebration Overlay ── */}
      {celebrationVisible && (
        <Animated.View
          style={[
            styles.celebrationOverlay,
            { opacity: celebrationAnim, pointerEvents: 'none' },
          ]}
        >
          <Animated.View style={[styles.celebrationCard, { transform: [{ scale: celebrationScale }] }]}>
            <Text style={styles.celebrationEmoji}>🎉</Text>
            <Text style={[styles.celebrationTitle, { fontFamily: 'Inter_700Bold' }]}>
              {t('activityComplete' as any)}
            </Text>
          </Animated.View>
        </Animated.View>
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  centered: { alignItems: 'center', justifyContent: 'center' },
  noActivity: { color: TEXT_MUTED, fontSize: 14, marginBottom: 16 },
  celebrationOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', zIndex: 20, pointerEvents: 'none' },
  celebrationCard: { alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(22,23,31,0.92)', borderRadius: 24, paddingHorizontal: 40, paddingVertical: 32, borderWidth: 1, borderColor: TIMER_GREEN + '60', gap: 12 },
  celebrationEmoji: { fontSize: 64 },
  celebrationTitle: { fontSize: 22, color: TEXT_PRIMARY, textAlign: 'center', lineHeight: 30 },
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
  navBtnWide: { alignItems: 'center', justifyContent: 'center', gap: 6, minWidth: 110, height: 46, borderRadius: 23, paddingHorizontal: 16 },
  navLabel: { fontSize: 14 },
  dotTarget: { paddingVertical: 10, paddingHorizontal: 2, justifyContent: 'center' },
  counterBox: { minWidth: 54, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12, backgroundColor: CARD_BG, borderWidth: 1, borderColor: BORDER },
  counterText: { fontSize: 13, color: TEXT_PRIMARY },
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

// Graph + media slides: the frame is the star, sized for a projector.
const mediaStyles = StyleSheet.create({
  wrap: { marginTop: 10, gap: 12 },
  cmdRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' },
  cmdPill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#0EA5E9' + '18',
    borderWidth: 1,
    borderColor: '#0EA5E9' + '45',
  },
  cmdText: { fontSize: 20, color: TEXT_PRIMARY },
  emptyHint: { fontSize: 14, color: TEXT_MUTED, lineHeight: 22 },
  frame: {
    width: '100%',
    height: 460,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: BORDER,
  },
  image: { width: '100%', height: 460, borderRadius: 14, backgroundColor: CARD_BG },
  openBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: ACCENT,
    borderRadius: 14,
    paddingVertical: 18,
  },
  openBtnText: { fontSize: 17, color: '#fff' },
});

// Sized for projection: options readable from the back of a classroom.
const qStyles = StyleSheet.create({
  wrap: { marginTop: 8, gap: 14 },
  respondBanner: { alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 8, paddingHorizontal: 14, borderRadius: 10, backgroundColor: '#3B82F6' + '14', borderWidth: 1, borderColor: '#3B82F6' + '35', alignSelf: 'center' },
  respondText: { fontSize: 14, color: '#3B82F6' },
  grid: { gap: 12 },
  option: { alignItems: 'center', gap: 14, borderWidth: 2, borderRadius: 16, paddingVertical: 18, paddingHorizontal: 18 },
  letterBadge: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  letterText: { fontSize: 22 },
  optionText: { flex: 1, fontSize: 22, color: TEXT_PRIMARY, lineHeight: 32 },
  revealBtn: { alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 13, borderRadius: 12, borderWidth: 1 },
  revealBtnText: { fontSize: 15 },
  verifiedBadge: { alignItems: 'center', justifyContent: 'center', gap: 8, alignSelf: 'center', paddingVertical: 8, paddingHorizontal: 16, borderRadius: 20, backgroundColor: TIMER_GREEN + '12', borderWidth: 1, borderColor: TIMER_GREEN + '45' },
  verifiedText: { fontSize: 13.5, color: TIMER_GREEN },
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
