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
import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useLanguage } from '@/context/LanguageContext';
import { ActivitySlide, ClassroomActivity } from '@/services/ai/AIService';
import { getPendingClassroomActivity, clearClassroomActivity } from '@/services/classroomStore';
import { timerColor } from '@/services/presentationUtils';
import Svg, { Line, Polyline, Rect } from 'react-native-svg';
import { plotGeometry, visualForSlide } from '@/services/deckVisuals';
import { geogebraCommandUrl, openGeogebraWithCommands } from '@/services/geogebra';
import { youtubeEmbedUrl } from '@/services/classMedia';
import {
  createGame, podium, resetScores, setAwards, toggleAward, type GameState,
} from '@/services/classGame';
import { AwardRow, PodiumView, ScoreStrip, ScoreboardView } from '@/components/classroom/GameBoard';
import { MathText } from '@/components/classroom/MathText';
import { hasRenderableMath, prettifySymPy } from '@/services/mathRender';

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
// Light, warm, print-like. A projected deck sits next to a whiteboard in a lit
// room, where a near-black background washes out and reads as "a screen someone
// forgot to close". Cream + teal + magenta is the deck palette; the chrome
// borrows the same tokens so nothing looks bolted on.
const BG = '#FDF1EC';
const CARD_BG = '#FFFFFF';
const BORDER = '#EFDCD4';
const TEXT_PRIMARY = '#22303C';
const TEXT_MUTED = '#7C6A65';
const ACCENT = '#1E8E8E';
/** Second accent — section rules, kickers, the "look here" mark. */
const PINK = '#D6206B';
/** The soft shapes behind the slide. Low-contrast on purpose. */
const BLOB = '#F8DCD2';
const TIMER_GREEN = '#16A34A';
const TIMER_AMBER = '#D97706';
const TIMER_RED = '#DC2626';

function slideTypeAccent(type: ActivitySlide['type']): string {
  if (type === 'challenge') return '#C2410C';
  if (type === 'reveal') return TIMER_GREEN;
  if (type === 'summary') return PINK;
  if (type === 'bingo-call') return '#7E22CE';
  if (type === 'relay-problem') return '#BE123C';
  if (type === 'question') return '#1D4ED8';
  if (type === 'graph') return '#0E7490';
  if (type === 'media') return '#B45309';
  if (type === 'scoreboard') return '#B45309';
  if (type === 'podium') return '#A16207';
  if (type === 'divider') return ACCENT;
  return '#8B8CA4';
}

// ─── Visual block (plot / chart) ──────────────────────────────────────────────
// Draws the same spec the PDF and PPTX draw, via react-native-svg, so the three
// surfaces cannot drift into showing different pictures of the same data.
function VisualView({ slide }: { slide: ActivitySlide }) {
  const visual = visualForSlide(slide);
  if (!visual) return null;

  const W = 640;
  const H = 320;

  if (visual.kind === 'chart') {
    const { categories, values } = visual;
    const max = Math.max(...values, 0);
    if (!categories.length || max <= 0) return null;
    const pad = 30;
    const w = W - pad * 2;
    const h = H - pad * 2;
    const slot = w / categories.length;
    const barW = slot * 0.6;
    return (
      <View style={styles.visualWrap}>
        <Svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H}>
          {values.map((v, i) => {
            const bh = (Math.max(0, v) / max) * h;
            return (
              <Rect
                key={i}
                x={pad + i * slot + (slot - barW) / 2}
                y={pad + h - bh}
                width={barW}
                height={bh}
                rx={3}
                fill={VISUAL_COLORS[i % VISUAL_COLORS.length]}
              />
            );
          })}
        </Svg>
      </View>
    );
  }

  const g = plotGeometry(visual, W, H);
  if (!g) return null;
  return (
    <View style={styles.visualWrap}>
      <Svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H}>
        {g.axisX !== null && <Line x1={0} y1={g.axisX} x2={W} y2={g.axisX} stroke="#9CA3AF" strokeWidth={1} />}
        {g.axisY !== null && <Line x1={g.axisY} y1={0} x2={g.axisY} y2={H} stroke="#9CA3AF" strokeWidth={1} />}
        {g.series.map((sr, i) => (
          <Polyline
            key={i}
            points={sr.points.map(pt => `${pt.x},${pt.y}`).join(' ')}
            fill="none"
            stroke={VISUAL_COLORS[i % VISUAL_COLORS.length]}
            strokeWidth={2.5}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        ))}
      </Svg>
    </View>
  );
}

const VISUAL_COLORS = ['#1B6B62', '#C2410C', '#4F46E5', '#B91C1C'];

// ─── Graph slide (GeoGebra) ───────────────────────────────────────────────────
// On web (the projector case) the calculator is embedded so the class sees the
// curve inside the deck; on native there's no WebView dependency, so we open
// GeoGebra full-screen instead.
function GraphView({ slide, isRTL, t }: { slide: ActivitySlide; isRTL: boolean; t: (k: any, arg?: any) => string }) {
  const commands = slide.graphCommands ?? [];
  const url = geogebraCommandUrl(commands);

  return (
    <View style={mediaStyles.wrap}>
      {commands.length > 0 ? (
        <View style={mediaStyles.cmdRow}>
          {commands.map((c, i) => (
            <View key={i} style={mediaStyles.cmdPill}>
              <Text style={[mediaStyles.cmdText, { fontFamily: 'Cairo_700Bold' }]}>{c}</Text>
            </View>
          ))}
        </View>
      ) : (
        // A blank calculator with no explanation reads as a bug mid-lesson.
        <Text
          style={[
            mediaStyles.emptyHint,
            { fontFamily: 'Almarai_400Regular', textAlign: isRTL ? 'right' : 'left' },
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
          <Text style={[mediaStyles.openBtnText, { fontFamily: 'Cairo_700Bold' }]}>
            {t('openGraph')}
          </Text>
        </Pressable>
      )}
    </View>
  );
}

// ─── Media slide (image / YouTube) ────────────────────────────────────────────
function MediaView({ slide, isRTL, t }: { slide: ActivitySlide; isRTL: boolean; t: (k: any, arg?: any) => string }) {
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
          <Text style={[mediaStyles.openBtnText, { fontFamily: 'Cairo_700Bold' }]}>
            {t('openMedia')}
          </Text>
        </Pressable>
      )}
    </View>
  );
}

// ─── Hero slide (title background + section dividers) ────────────────────────
// Full-bleed instead of the generic badge+content layout SlideView gives every
// other slide type — a pacing break for dividers, a real opener for the title.
// Falls back to a flat accent panel (no Image/gradient) when there's no photo
// to show, e.g. Unsplash unconfigured — never a blank or broken slide.
function HeroSlideView({ slide, accent }: { slide: ActivitySlide; accent: string }) {
  const hasPhoto = !!slide.mediaUrl;
  const body = (
    <View style={heroStyles.textWrap}>
      <Text style={[heroStyles.title, { fontFamily: 'Cairo_700Bold' }]}>{slide.title}</Text>
      {!!slide.content && (
        <Text style={[heroStyles.subtitle, { fontFamily: 'Almarai_400Regular' }]}>{slide.content}</Text>
      )}
    </View>
  );

  if (!hasPhoto) {
    return <View style={[heroStyles.wrap, { backgroundColor: accent }]}>{body}</View>;
  }

  return (
    <View style={heroStyles.wrap}>
      <Image source={{ uri: slide.mediaUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" />
      <LinearGradient
        colors={['rgba(13,13,20,0.35)', 'rgba(13,13,20,0.92)']}
        style={StyleSheet.absoluteFill}
      />
      {body}
    </View>
  );
}

// ─── Teacher Panel ────────────────────────────────────────────────────────────
function TeacherPanel({
  slide, isRTL, t, onClose,
}: {
  slide: ActivitySlide;
  isRTL: boolean;
  t: (k: any, arg?: any) => string;
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
          <Text style={[panelStyles.headerText, { fontFamily: 'Cairo_700Bold' }]}>{t('teacherPanelTitle')}</Text>
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
  t: (k: any, arg?: any) => string;
  revealed: boolean;
  onToggleReveal: () => void;
}) {
  const options = slide.options ?? [];
  if (options.length === 0) return null;
  // Response letters students answer with by holding up that many fingers
  // (أ = 1, ب = 2, …). No printed cards — the app never had a way to make them.
  const letters = isRTL ? ['أ', 'ب', 'ج', 'د', 'هـ'] : ['A', 'B', 'C', 'D', 'E'];

  return (
    <View style={qStyles.wrap}>
      {/* Routine reminder — projected so students see the rule, not just hear it */}
      <View style={[qStyles.respondBanner, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
        <Ionicons name="hand-left-outline" size={16} color="#3B82F6" />
        <Text style={[qStyles.respondText, { fontFamily: 'Cairo_600SemiBold' }]}>
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
                <Text style={[qStyles.letterText, { color: isCorrect ? '#fff' : '#3B82F6', fontFamily: 'Cairo_700Bold' }]}>
                  {letters[i] ?? '•'}
                </Text>
              </View>
              <Text
                style={[
                  qStyles.optionText,
                  { textAlign: isRTL ? 'right' : 'left', fontFamily: isCorrect ? 'Cairo_700Bold' : 'Cairo_500Medium' },
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
        <Text style={[qStyles.revealBtnText, { color: revealed ? TEXT_MUTED : TIMER_GREEN, fontFamily: 'Cairo_600SemiBold' }]}>
          {revealed ? t('hideAnswer') : t('revealAnswer')}
        </Text>
      </Pressable>

      {/* The trust moment — but the badge states only what actually happened.
          'symbolic' means SymPy re-derived and compared; 'bank' means a
          hand-authored reviewed item, which is NOT machine verification. */}
      {revealed && slide.verified && (
        <View style={{ gap: 6 }}>
          <View style={[qStyles.verifiedBadge, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
            <Ionicons
              name={slide.verifiedBy === 'symbolic' ? 'shield-checkmark' : 'library-outline'}
              size={16}
              color={slide.verifiedBy === 'symbolic' ? TIMER_GREEN : TEXT_MUTED}
            />
            <Text
              style={[
                qStyles.verifiedText,
                {
                  fontFamily: 'Cairo_600SemiBold',
                  color: slide.verifiedBy === 'symbolic' ? TIMER_GREEN : TEXT_MUTED,
                },
              ]}
            >
              {slide.verifiedBy === 'symbolic' ? t('verifiedBySymbolic') : t('verifiedByBank')}
            </Text>
          </View>
          {slide.verifiedBy === 'symbolic' && slide.computedAnswer && (
            <Text
              style={[
                qStyles.verifiedText,
                { fontFamily: 'Almarai_400Regular', color: TEXT_MUTED, textAlign: 'center' },
              ]}
            >
              {t('verifiedComputed', prettifySymPy(slide.computedAnswer))}
            </Text>
          )}
        </View>
      )}
    </View>
  );
}

// ─── Slide Content ────────────────────────────────────────────────────────────
/**
 * Pull a leading emoji off a deck heading.
 *
 * The builders write titles like "🎯 نتاجات التعلم" — the glyph is a section
 * marker, not part of the sentence, so it belongs in a chip beside the heading
 * rather than inline, where it sets the line height for the whole title.
 * Codepoint ranges rather than \p{Extended_Pictographic}: unicode property
 * escapes are not safe to assume across Hermes versions.
 */
function splitEmoji(title: string): [glyph: string, heading: string] {
  const text = (title ?? '').trim();
  const cp = text.codePointAt(0) ?? 0;
  const isEmoji = cp >= 0x1f300 || (cp >= 0x2190 && cp <= 0x27bf);
  if (!isEmoji) return ['', text];
  const glyph = String.fromCodePoint(cp);
  return [glyph, text.slice(glyph.length).replace(/^\uFE0F/, '').trim()];
}

function SlideView({ slide, isRTL }: { slide: ActivitySlide; isRTL: boolean }) {
  const accent = slideTypeAccent(slide.type);
  const align = isRTL ? ('right' as const) : ('left' as const);
  const edge = isRTL ? ('flex-end' as const) : ('flex-start' as const);
  const lines = slide.content.split('\n').map(l => l.trim()).filter(Boolean);
  const [glyph, heading] = splitEmoji(slide.title);

  // Slide 1 is the deck's cover: the title *is* the slide, so it gets a display
  // treatment instead of the heading-plus-body grid every other slide uses.
  // (A first slide carrying a photo goes to HeroSlideView instead and never
  // reaches here.) Without this every slide in the deck looks identical, which
  // is the actual complaint about the old renderer.
  if (slide.slideNumber === 1 && slide.type === 'intro') {
    return (
      <View style={slideStyles.cover}>
        <Text style={[slideStyles.coverTitle, { textAlign: align, fontFamily: 'Cairo_700Bold' }]}>
          {heading}
        </Text>
        <View style={[slideStyles.rule, { alignSelf: edge }]} />
        {lines.map((line, i) => (
          <Text
            key={i}
            style={[slideStyles.coverSub, { textAlign: align, fontFamily: 'Almarai_400Regular' }]}
          >
            {line}
          </Text>
        ))}
      </View>
    );
  }

  return (
    <View style={slideStyles.container}>
      {/* Heading — on the reading edge, not centred. A centred pill gives the
          eye no starting point in a room reading right-to-left. */}
      <View style={[slideStyles.headRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
        {!!glyph && (
          <View style={[slideStyles.glyphChip, { backgroundColor: accent + '18', borderColor: accent + '33' }]}>
            <Text style={slideStyles.glyph}>{glyph}</Text>
          </View>
        )}
        <Text style={[slideStyles.title, { color: accent, textAlign: align, fontFamily: 'Cairo_700Bold' }]}>
          {heading}
        </Text>
      </View>
      <View style={[slideStyles.rule, { alignSelf: edge }]} />

      {/* Body. Bullets become cards and equations become a boxed formula: the
          content already carries that structure as "• " prefixes and maths
          glyphs, it was just being flattened into identical paragraphs. */}
      <View style={slideStyles.body}>
        {lines.map((line, i) => {
          const isBullet = /^[•\-–]\s+/.test(line);
          const text = isBullet ? line.replace(/^[•\-–]\s+/, '') : line;
          const isEquation =
            !isBullet
            && (/[=²³√±×÷^]/.test(text) || /\d+x/.test(text) || /\/[0-9٠-٩]/.test(text));

          if (isBullet) {
            return (
              <View key={i} style={[slideStyles.card, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                <View style={[slideStyles.cardBar, { backgroundColor: accent }]} />
                <Text style={[slideStyles.cardText, { textAlign: align, fontFamily: 'Almarai_400Regular' }]}>
                  {text}
                </Text>
              </View>
            );
          }

          // Structured math layout (stacked fractions, raised exponents, real
          // radicals) only when the parser actually found a construct. It keeps
          // its own renderer — the box around it is the only thing that changed.
          if (isEquation && hasRenderableMath(text)) {
            return (
              <View key={i} style={slideStyles.formulaBox}>
                <MathText
                  text={text}
                  fontSize={30}
                  color={TEXT_PRIMARY}
                  fontFamily="Cairo_700Bold"
                  isRTL={isRTL}
                  centered
                />
              </View>
            );
          }

          if (isEquation) {
            return (
              <View key={i} style={slideStyles.formulaBox}>
                <Text style={[slideStyles.formula, { fontFamily: 'Cairo_700Bold' }]}>{text}</Text>
              </View>
            );
          }

          return (
            <Text
              key={i}
              style={[
                slideStyles.bodyLine,
                {
                  // Media slides centre their content: the image/player below is
                  // itself centred and width-capped, so a margin-aligned caption
                  // floats away from the thing it describes.
                  textAlign: slide.type === 'media' ? 'center' : align,
                  fontFamily: 'Almarai_400Regular',
                },
              ]}
            >
              {text}
            </Text>
          );
        })}
      </View>

      {/* Unlock code badge */}
      {slide.unlockCode && slide.type === 'reveal' && (
        <View style={slideStyles.codeBadge}>
          <Text style={[slideStyles.codeLabel, { fontFamily: 'Cairo_500Medium' }]}>🔑</Text>
          <Text style={[slideStyles.codeValue, { fontFamily: 'Cairo_700Bold' }]}>{slide.unlockCode}</Text>
        </View>
      )}
    </View>
  );
}

// ─── Main Presentation Screen ─────────────────────────────────────────────────
export default function PresentationScreen() {
  const { t, isRTL, lang } = useLanguage();
  const insets = useSafeAreaInsets();

  const [activity, setActivity] = useState<ClassroomActivity | null>(null);
  // Non-null only for Class Challenge decks (`activity.game` present). Kept
  // here rather than in a store because a game is one run of one deck: leaving
  // the presentation ends it, and resuming a half-scored game the teacher has
  // already walked away from would be worse than starting clean.
  const [game, setGame] = useState<GameState | null>(null);
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
  const celebrationExit = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Slide fade animation
  const fadeAnim = useRef(new Animated.Value(1)).current;

  // Load activity on mount — redirect back to hub if store is empty
  useEffect(() => {
    const a = getPendingClassroomActivity();
    if (a) {
      setActivity(a);
      if (a.game) setGame(createGame(a.game.teamCount, a.game.questionCount, lang === 'ar'));
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
    // Held in a ref so leaving the slide can cancel it — see the effect below.
    celebrationExit.current = setTimeout(() => {
      Animated.timing(celebrationAnim, { toValue: 0, duration: 400, useNativeDriver: true }).start(() => {
        setCelebrationVisible(false);
      });
    }, 2800);
  };

  /**
   * The celebration belongs to the slide that earned it.
   *
   * It used to be fired imperatively from both navigation paths — `goToSlide`
   * and the keyboard handler — each scheduling a fire-and-forget 2.8s
   * timeout with nothing cancelling it. Advance before it faded and the
   * overlay rode along onto the next slide: «أحسنتم! اكتمل النشاط» sitting
   * on top of the exit ticket.
   *
   * That was harmless while the summary was the last slide, because there was
   * nowhere to advance to. Putting the exit ticket after the summary made
   * passing through that 2.8s window the normal case. Driving the overlay off
   * the current slide instead of off the transition means it cannot outlive
   * the slide it belongs to, and it removes the duplicated trigger.
   */
  useEffect(() => {
    const current = activity?.slides[slideIndex];
    const closesARun = current?.type === 'summary' || current?.type === 'podium';
    if (!closesARun) {
      setCelebrationVisible(false);
      return;
    }
    const enter = setTimeout(showCelebration, 350);
    return () => {
      clearTimeout(enter);
      if (celebrationExit.current) clearTimeout(celebrationExit.current);
      setCelebrationVisible(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slideIndex, activity]);

  const goToSlide = (idx: number) => {
    if (!activity || idx < 0 || idx >= activity.slides.length) return;
    const nextSlide = activity.slides[idx];
    Animated.timing(fadeAnim, { toValue: 0, duration: 140, useNativeDriver: true }).start(() => {
      setSlideIndex(idx);
      initSlide(nextSlide);
      Animated.timing(fadeAnim, { toValue: 1, duration: 180, useNativeDriver: true }).start();
    });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
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

      {/* Soft background shapes. First in the tree so they sit behind
          everything, and non-interactive so they never eat a tap. */}
      <View pointerEvents="none" style={[styles.blob, styles.blobTop]} />
      <View pointerEvents="none" style={[styles.blob, styles.blobBottom]} />

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
          <Text style={[styles.counterText, { fontFamily: 'Cairo_700Bold' }]}>
            {slideIndex + 1}/{totalSlides}
          </Text>
        </View>

        {/* Timer */}
        {hasTimer ? (
          <View style={[styles.timerBox, { borderColor: tColor + '44', backgroundColor: tColor + '15' }]}>
            <Ionicons name="timer-outline" size={13} color={tColor} />
            <Text style={[styles.timerText, { color: tColor, fontFamily: 'Cairo_700Bold' }]}>{mm}:{ss}</Text>
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

      {/* ── Live scoreboard (Class Challenge only) ── */}
      {game && <ScoreStrip state={game} isRTL={isRTL} isAr={lang === 'ar'} />}

      {/* ── Slide Content ── */}
      <Animated.View style={[styles.slideArea, { opacity: fadeAnim }]}>
        <ScrollView
          contentContainerStyle={[styles.slideScroll, { paddingTop: hasTimer ? 8 : 16 }]}
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          {slide.type === 'divider' || (isFirst && slide.mediaUrl)
            ? <HeroSlideView slide={slide} accent={slideTypeAccent(slide.type)} />
            : <SlideView slide={slide} isRTL={isRTL} />}

          {/* Graph (GeoGebra) and media (image / YouTube) slides */}
          {slide.type === 'graph' && <GraphView slide={slide} isRTL={isRTL} t={t} />}
          {/* An explicit visual — a finance chart, a stats bar. Graph slides
              keep GeoGebra above instead: live, a curve the teacher can drag
              beats a static drawing, and only the exports need the static one. */}
          {slide.type !== 'graph' && <VisualView slide={slide} />}
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

          {/* Award control — after the reveal only, so the class cannot read
              "who got it right?" as a signal while still deciding. */}
          {game && slide.type === 'question' && slide.questionIndex !== undefined && answerVisible && (
            <AwardRow
              state={game}
              questionIndex={slide.questionIndex}
              isRTL={isRTL}
              onToggle={teamId => setGame(g => (g ? toggleAward(g, slide.questionIndex!, teamId) : g))}
              onAll={() => setGame(g => {
                if (!g) return g;
                const everyone = g.teams.every(team => (g.awards[slide.questionIndex!] ?? []).includes(team.id));
                return setAwards(g, slide.questionIndex!, everyone ? [] : g.teams.map(team => team.id));
              })}
              labels={{ prompt: t('gameWhoScored'), all: t('gameAwardAll') }}
            />
          )}

          {/* Standings break */}
          {game && slide.type === 'scoreboard' && (
            <ScoreboardView
              state={game}
              isRTL={isRTL}
              isAr={lang === 'ar'}
              labels={{ points: t('gamePoints'), streak: (n: number) => t('gameStreak', n) }}
            />
          )}

          {/* Final podium */}
          {game && slide.type === 'podium' && (
            <PodiumView
              groups={podium(game)}
              isRTL={isRTL}
              isAr={lang === 'ar'}
              labels={{ points: t('gamePoints'), empty: t('gameNoScores'), playAgain: t('gamePlayAgain') }}
              onPlayAgain={() => {
                setGame(g => (g ? resetScores(g) : g));
                // Jump back to the first question rather than slide 0: the
                // rules slide has already been read to this class once.
                const firstQuestion = activity.slides.findIndex(s => s.type === 'question');
                goToSlide(firstQuestion >= 0 ? firstQuestion : 0);
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
                <Text style={[styles.revealBtnText, { color: TIMER_AMBER, fontFamily: 'Cairo_600SemiBold' }]}>
                  {hintVisible ? t('hideHint') : t('revealHint')}
                </Text>
              </Pressable>
              {hintVisible && (
                <View style={[styles.revealContent, { borderColor: TIMER_AMBER + '40', backgroundColor: TIMER_AMBER + '10' }]}>
                  <Text style={[styles.revealText, { textAlign: isRTL ? 'right' : 'left', fontFamily: 'Almarai_400Regular' }]}>
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
                <Text style={[styles.revealBtnText, { color: TIMER_GREEN, fontFamily: 'Cairo_600SemiBold' }]}>
                  {answerVisible ? t('hideAnswer') : t('revealAnswer')}
                </Text>
              </Pressable>
              {answerVisible && (
                <View style={[styles.revealContent, { borderColor: TIMER_GREEN + '40', backgroundColor: TIMER_GREEN + '10' }]}>
                  {hasRenderableMath(slide.answer) ? (
                    <MathText
                      text={slide.answer}
                      fontSize={18}
                      color={TEXT_PRIMARY}
                      fontFamily="Cairo_700Bold"
                      isRTL={isRTL}
                    />
                  ) : (
                    <Text style={[styles.revealText, { textAlign: isRTL ? 'right' : 'left', fontFamily: 'Cairo_700Bold' }]}>
                      {slide.answer}
                    </Text>
                  )}
                  {/* Same trust moment as question slides: state only what
                      actually happened. 'symbolic' = SymPy re-derived and
                      agreed; 'bank' = reviewed by a human, not a machine. */}
                  {slide.verified && (
                    <View style={{ gap: 4, marginTop: 10 }}>
                      <View style={[qStyles.verifiedBadge, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                        <Ionicons
                          name={slide.verifiedBy === 'symbolic' ? 'shield-checkmark' : 'library-outline'}
                          size={15}
                          color={slide.verifiedBy === 'symbolic' ? TIMER_GREEN : TEXT_MUTED}
                        />
                        <Text style={[qStyles.verifiedText, {
                          fontFamily: 'Cairo_600SemiBold',
                          color: slide.verifiedBy === 'symbolic' ? TIMER_GREEN : TEXT_MUTED,
                        }]}>
                          {slide.verifiedBy === 'symbolic' ? t('verifiedBySymbolic') : t('verifiedByBank')}
                        </Text>
                      </View>
                      {slide.verifiedBy === 'symbolic' && slide.computedAnswer && (
                        <Text style={[qStyles.verifiedText, {
                          fontFamily: 'Almarai_400Regular', color: TEXT_MUTED, textAlign: 'center',
                        }]}>
                          {t('verifiedComputed', prettifySymPy(slide.computedAnswer))}
                        </Text>
                      )}
                    </View>
                  )}
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
          <Text style={[styles.navLabel, { color: TEXT_PRIMARY, fontFamily: 'Cairo_500Medium' }]}>
            {t('prevSlide')}
          </Text>
        </Pressable>

        {/* Action row */}
        <View style={[styles.actionRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
          {hasTimer && (
            <Pressable onPress={restartTimer} style={styles.actionBtn} hitSlop={8}>
              <Ionicons name="refresh-outline" size={18} color={TEXT_MUTED} />
              <Text style={[styles.actionLabel, { fontFamily: 'Almarai_400Regular' }]}>{t('restartTimer')}</Text>
            </Pressable>
          )}
          {hasTeacherNotes && (
            <Pressable onPress={() => setTeacherPanelOpen(true)} style={[styles.actionBtn, { borderColor: ACCENT + '50', backgroundColor: ACCENT + '12' }]} hitSlop={8}>
              <Ionicons name="school-outline" size={18} color={ACCENT} />
              <Text style={[styles.actionLabel, { color: ACCENT, fontFamily: 'Cairo_500Medium' }]}>{t('teacherPanelTitle')}</Text>
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
          <Text style={[styles.navLabel, { color: isLast ? TEXT_MUTED : '#fff', fontFamily: 'Cairo_700Bold' }]}>
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
            <Text style={[styles.celebrationTitle, { fontFamily: 'Cairo_700Bold' }]}>
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
  visualWrap: { width: '100%', maxWidth: 900, alignSelf: 'center', marginTop: 12 },
  container: { flex: 1, backgroundColor: BG },
  centered: { alignItems: 'center', justifyContent: 'center' },
  noActivity: { color: TEXT_MUTED, fontSize: 14, marginBottom: 16 },
  celebrationOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', zIndex: 20, pointerEvents: 'none' },
  celebrationCard: { alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.96)', borderRadius: 24, paddingHorizontal: 40, paddingVertical: 32, borderWidth: 1, borderColor: TIMER_GREEN + '60', gap: 12 },
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
  blob: { position: 'absolute', borderRadius: 999, backgroundColor: BLOB },
  blobTop: { width: 260, height: 260, top: -96, left: -84 },
  blobBottom: { width: 330, height: 330, bottom: -132, right: -116 },
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
  container: { paddingTop: 8 },
  cover: { paddingTop: 48, paddingBottom: 32 },
  coverTitle: { fontSize: 40, lineHeight: 62, color: ACCENT },
  coverSub: { fontSize: 20, lineHeight: 34, color: TEXT_MUTED, marginBottom: 6 },
  rule: { width: 64, height: 5, borderRadius: 3, backgroundColor: PINK, marginTop: 14, marginBottom: 24 },
  headRow: { alignItems: 'center', gap: 12 },
  glyphChip: { width: 44, height: 44, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  glyph: { fontSize: 21 },
  title: { flex: 1, fontSize: 31, lineHeight: 48 },
  body: { gap: 12 },
  bodyLine: { fontSize: 21, color: TEXT_PRIMARY, lineHeight: 36 },
  card: { alignItems: 'center', gap: 14, backgroundColor: CARD_BG, borderRadius: 14, borderWidth: 1, borderColor: BORDER, paddingVertical: 15, paddingHorizontal: 16 },
  cardBar: { width: 5, alignSelf: 'stretch', borderRadius: 3 },
  cardText: { flex: 1, fontSize: 21, color: TEXT_PRIMARY, lineHeight: 34 },
  formulaBox: { backgroundColor: CARD_BG, borderRadius: 16, borderWidth: 1, borderColor: BORDER, paddingVertical: 22, paddingHorizontal: 18, alignItems: 'center' },
  formula: { fontSize: 30, color: TEXT_PRIMARY, textAlign: 'center', lineHeight: 46 },
  codeBadge: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, marginTop: 28, backgroundColor: TIMER_GREEN + '12', borderRadius: 14, borderWidth: 1, borderColor: TIMER_GREEN + '40', padding: 20 },
  codeLabel: { fontSize: 28 },
  codeValue: { fontSize: 48, color: TIMER_GREEN },
});

const heroStyles = StyleSheet.create({
  wrap: { flex: 1, minHeight: 420, borderRadius: 20, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', padding: 32 },
  textWrap: { alignItems: 'center', maxWidth: 560 },
  title: { fontSize: 34, color: '#fff', textAlign: 'center', lineHeight: 46 },
  subtitle: { fontSize: 16, color: 'rgba(255,255,255,0.85)', textAlign: 'center', marginTop: 12, lineHeight: 24 },
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
    // 16:9, not a fixed height: a YouTube embed letterboxes itself inside
    // whatever box it is given, so a fixed 460px on a wide projector left a
    // band of dead black under the video. maxWidth keeps it from growing
    // taller than the slide area on very wide screens.
    maxWidth: 900,
    aspectRatio: 16 / 9,
    alignSelf: 'center',
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
  verifiedBadge: { alignItems: 'center', justifyContent: 'center', gap: 8, alignSelf: 'center', paddingVertical: 8, paddingHorizontal: 16, borderRadius: 20, backgroundColor: CARD_BG, borderWidth: 1, borderColor: BORDER },
  verifiedText: { fontSize: 13.5, color: TIMER_GREEN },
});

const panelStyles = StyleSheet.create({
  overlay: { position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 10 },
  panel: { backgroundColor: CARD_BG, borderTopLeftRadius: 20, borderTopRightRadius: 20, borderTopWidth: 1, borderColor: BORDER, paddingHorizontal: 20, paddingTop: 12, maxHeight: 480 },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: BORDER, alignSelf: 'center', marginBottom: 16 },
  header: { alignItems: 'center', gap: 8, marginBottom: 16 },
  headerText: { flex: 1, fontSize: 16, color: TEXT_PRIMARY },
  closeBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  section: { marginBottom: 16 },
  sectionLabel: { fontSize: 11, color: ACCENT, fontFamily: 'Cairo_600SemiBold', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  sectionText: { fontSize: 13, color: TEXT_PRIMARY, lineHeight: 20 },
  bulletQ: { fontSize: 13, color: TEXT_PRIMARY, lineHeight: 20, marginBottom: 4 },
});
