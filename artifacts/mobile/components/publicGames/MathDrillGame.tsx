/**
 * Arithmetic sprint (× ÷ +): pick what to practise, answer as many as you can
 * before the clock runs out. Solo, no login, nothing stored — the /play link
 * carries the whole config, which is how a teacher assigns it (see mathDrill.ts).
 */
import React, { useEffect, useReducer, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import { Button } from '@/components/ui/Button';
import { GameShell } from './GameShell';
import { shareAsText } from '@/services/share';
import {
  ADD_MAXES,
  DRILL_SECONDS,
  DRILL_SYMBOL,
  DRILL_TITLE_KEYS as TITLES,
  usesRange,
  drillReducer,
  drillShareUrl,
  nextProblem,
  startDrill,
  type DrillConfig,
  type DrillOp,
  type DrillProblem,
} from '@/services/publicGames/mathDrill';

// Solid fills carrying white text — each ≥ 4.5:1 against #fff.
const ACCENTS: Record<DrillOp, string> = { mul: '#B45309', div: '#7C3AED', add: '#4338CA', sub: '#BE123C' };
const RIGHT = '#16A34A';
const WRONG = '#DC2626';
const ALL_TABLES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const WRONG_PAUSE_MS = 700;
const PAD: string[][] = [['1', '2', '3'], ['4', '5', '6'], ['7', '8', '9'], ['back', '0']];
const ARABIC_INDIC = '٠١٢٣٤٥٦٧٨٩';

type Result = { correct: number; attempted: number };

export function MathDrillGame({ initial }: { initial: DrillConfig }) {
  const colors = useColors();
  const { t, isRTL } = useLanguage();
  const [config, setConfig] = useState(initial);
  const [phase, setPhase] = useState<'setup' | 'playing' | 'over'>('setup');
  const [round, setRound] = useState(0);
  const [result, setResult] = useState<Result>({ correct: 0, attempted: 0 });
  const [copied, setCopied] = useState(false);

  const toggleTable = (n: number) => {
    setCopied(false);
    setConfig(c => {
      const has = c.tables.includes(n);
      if (has && c.tables.length === 1) return c; // never an empty drill
      const tables = has ? c.tables.filter(x => x !== n) : [...c.tables, n].sort((a, b) => a - b);
      return { ...c, tables };
    });
  };

  const share = () => {
    // `window.location` is undefined on native; drillShareUrl falls back to production then.
    const origin = typeof window !== 'undefined' && window.location?.origin ? window.location.origin : '';
    shareAsText(drillShareUrl(config, origin), t(TITLES[config.op]))
      .then(how => setCopied(how === 'copied'))
      .catch(() => {});
  };

  const start = () => {
    setRound(r => r + 1);
    setPhase('playing');
  };

  const align = isRTL ? 'right' : 'left';
  const ACCENT = ACCENTS[config.op];

  return (
    <GameShell
      titleKey={TITLES[config.op]}
      accent={ACCENT}
      gameOver={phase === 'over' ? { message: t('playDrillResult', result.correct, result.attempted) } : null}
      onReplay={start}
    >
      {phase === 'playing' ? (
        <DrillRound
          key={round}
          config={config}
          onDone={r => {
            setResult(r);
            setPhase('over');
          }}
        />
      ) : (
        <View style={{ flex: 1, padding: 20, gap: 14 }}>
          {usesRange(config.op) ? (
            <>
              <Text style={[styles.label, { color: colors.foreground, textAlign: align }]}>{t(config.op === 'sub' ? 'playDrillPickNumbersMax' : 'playDrillPickMax')}</Text>
              <View style={[styles.chips, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                {ADD_MAXES.map(m => {
                  const on = config.max === m;
                  return (
                    <Pressable
                      key={m}
                      onPress={() => { setCopied(false); setConfig(c => ({ ...c, max: m })); }}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: on }}
                      style={[styles.pill, { backgroundColor: on ? ACCENT : colors.card, borderColor: on ? ACCENT : colors.border }]}
                    >
                      <Text style={[styles.chipText, { color: on ? '#fff' : colors.foreground }]}>{m}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </>
          ) : (
            <>
              <Text style={[styles.label, { color: colors.foreground, textAlign: align }]}>
                {t(config.op === 'div' ? 'playDrillPickDivisors' : 'playDrillPickTables')}
              </Text>
              <View style={styles.chips}>
                {ALL_TABLES.map(n => {
                  const on = config.tables.includes(n);
                  return (
                    <Pressable
                      key={n}
                      onPress={() => toggleTable(n)}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: on }}
                      style={[styles.chip, { backgroundColor: on ? ACCENT : colors.card, borderColor: on ? ACCENT : colors.border }]}
                    >
                      <Text style={[styles.chipText, { color: on ? '#fff' : colors.foreground, writingDirection: 'ltr' }]}>
                        {DRILL_SYMBOL[config.op]}{n}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </>
          )}

          <Text style={[styles.label, { color: colors.foreground, textAlign: align, marginTop: 6 }]}>{t('playDrillDuration')}</Text>
          <View style={[styles.chips, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
            {DRILL_SECONDS.map(s => {
              const on = config.seconds === s;
              return (
                <Pressable
                  key={s}
                  onPress={() => { setCopied(false); setConfig(c => ({ ...c, seconds: s })); }}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: on }}
                  style={[styles.pill, { backgroundColor: on ? ACCENT : colors.card, borderColor: on ? ACCENT : colors.border }]}
                >
                  <Text style={[styles.chipText, { color: on ? '#fff' : colors.foreground }]}>{t('playDrillSecs', s)}</Text>
                </Pressable>
              );
            })}
          </View>

          <View style={{ marginTop: 'auto', gap: 10 }}>
            <Button label={t('playDrillStart')} onPress={start} style={{ backgroundColor: ACCENT }} fullWidth size="lg" />
            <Button label={t('playDrillShare')} onPress={share} variant="secondary" fullWidth />
            {copied ? (
              <Text style={{ color: RIGHT, fontFamily: 'Cairo_600SemiBold', fontSize: 13, textAlign: 'center' }}>
                {t('playDrillCopied')}
              </Text>
            ) : null}
          </View>
        </View>
      )}
    </GameShell>
  );
}

/** One timed round. Remounted (via `key`) for every start, so it never needs a reset path. */
function DrillRound({ config, onDone }: { config: DrillConfig; onDone: (r: Result) => void }) {
  const colors = useColors();
  const { t } = useLanguage();
  const ACCENT = ACCENTS[config.op];
  const draw = (prev?: DrillProblem) => nextProblem(config, Math.random, prev);
  const [state, dispatch] = useReducer(drillReducer, undefined, () => startDrill(draw()));
  // A fixed end time, not a decrementing counter, so a backgrounded tab doesn't stretch the clock.
  const [endAt] = useState(() => Date.now() + config.seconds * 1000);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(id);
  }, []);

  const msLeft = Math.max(0, endAt - now);
  const secsLeft = Math.ceil(msLeft / 1000);

  useEffect(() => {
    if (msLeft === 0) onDone({ correct: state.correct, attempted: state.attempted });
    // Fires once, when the clock hits zero, with this render's score.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [msLeft === 0]);

  useEffect(() => {
    if (!state.wrong) return;
    const id = setTimeout(() => dispatch({ type: 'next', upcoming: draw(state.problem) }), WRONG_PAUSE_MS);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.wrong, state.problem]);

  const press = (key: string) => {
    if (msLeft === 0) return;
    if (key === 'back') dispatch({ type: 'backspace' });
    else dispatch({ type: 'digit', digit: key, upcoming: draw(state.problem) });
  };

  // Physical keyboard on web — Latin or Arabic-Indic digits. Re-subscribed every
  // render so `press` always sees the current problem.
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const onKey = (e: KeyboardEvent) => {
      const arabic = ARABIC_INDIC.indexOf(e.key);
      if (/^\d$/.test(e.key)) press(e.key);
      else if (arabic >= 0) press(String(arabic));
      else if (e.key === 'Backspace') press('back');
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  });

  const { a, b, answer } = state.problem;

  return (
    <View style={{ flex: 1, padding: 20, gap: 16 }}>
      <View style={styles.statusRow}>
        <Text style={{ color: colors.mutedForeground, fontFamily: 'Cairo_600SemiBold', fontSize: 14 }}>
          {t('playDrillTimeLeft', secsLeft)}
        </Text>
        <Text style={{ color: RIGHT, fontFamily: 'Cairo_700Bold', fontSize: 16 }}>✓ {state.correct}</Text>
      </View>
      <View style={[styles.track, { backgroundColor: colors.border }]}>
        <View style={{ width: `${(msLeft / (config.seconds * 1000)) * 100}%`, height: '100%', backgroundColor: ACCENT, borderRadius: 3 }} />
      </View>

      <View style={styles.problemWrap} accessibilityLiveRegion="polite">
        <Text style={[styles.problem, { color: colors.foreground }]}>
          {a} {DRILL_SYMBOL[state.problem.op]} {b} ={' '}
          <Text style={{ color: state.wrong ? WRONG : ACCENT, textDecorationLine: state.wrong ? 'line-through' : 'none' }}>
            {state.typed || '?'}
          </Text>
        </Text>
        <Text style={[styles.reveal, { color: RIGHT, opacity: state.wrong ? 1 : 0 }]}>{answer}</Text>
      </View>

      <View style={{ gap: 10, marginTop: 'auto' }}>
        {PAD.map(row => (
          <View key={row.join()} style={styles.padRow}>
            {row.map(key => (
              <Pressable
                key={key}
                onPress={() => press(key)}
                accessibilityLabel={key === 'back' ? 'Backspace' : key}
                style={({ pressed }) => [
                  styles.padKey,
                  { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.6 : 1 },
                  key === 'back' && { flexBasis: '30%' },
                  key === '0' && { flexBasis: '64%' },
                ]}
              >
                {key === 'back' ? (
                  <Ionicons name="backspace-outline" size={26} color={colors.foreground} />
                ) : (
                  <Text style={[styles.padText, { color: colors.foreground }]}>{key}</Text>
                )}
              </Pressable>
            ))}
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  label: { fontFamily: 'Cairo_600SemiBold', fontSize: 15 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  chip: { width: 58, height: 48, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  pill: { flexGrow: 1, height: 44, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  chipText: { fontFamily: 'Cairo_700Bold', fontSize: 16 },
  // The pad and the sum always read left-to-right, whatever the UI direction.
  statusRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  track: { height: 6, borderRadius: 3, overflow: 'hidden' },
  problemWrap: { alignItems: 'center', paddingVertical: 12 },
  problem: { fontFamily: 'Cairo_700Bold', fontSize: 44, writingDirection: 'ltr', textAlign: 'center' },
  reveal: { fontFamily: 'Cairo_700Bold', fontSize: 22, marginTop: 4 },
  padRow: { flexDirection: 'row', gap: 10, direction: 'ltr' },
  padKey: { flexBasis: '30%', flexGrow: 1, height: 58, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  padText: { fontFamily: 'Cairo_700Bold', fontSize: 24 },
});
