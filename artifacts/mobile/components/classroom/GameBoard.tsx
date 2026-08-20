/**
 * Class Challenge board — the projected game surface.
 *
 * Every piece here is sized for a projector read from the back row, not for a
 * phone held at arm's length: scores are large, team colour is the primary
 * identifier (a class calls out "الأزرق!" long before it reads a name), and the
 * award controls are big enough for a teacher to hit while facing the class
 * rather than the device.
 *
 * The one exception is `AwardRow`, which is the teacher's control and stays
 * off-screen until the answer is revealed — showing "who got it right?" while
 * students are still deciding would leak the fact that the question is closed.
 */
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import type { GameState, TeamStanding } from '@/services/classGame';
import { isAwarded, standings } from '@/services/classGame';

const CARD_BG = '#FFFFFF';
const BORDER = '#EFDCD4';
const TEXT_PRIMARY = '#22303C';
const TEXT_MUTED = '#7C6A65';
const GREEN = '#16A34A';

const MEDALS = ['🥇', '🥈', '🥉'];

/** Arabic-Indic digits, because the rest of the projected deck is Arabic. */
function num(n: number, isAr: boolean): string {
  if (!isAr) return String(n);
  return String(n).replace(/\d/g, d => '٠١٢٣٤٥٦٧٨٩'[Number(d)]);
}

// ─── Persistent score strip ───────────────────────────────────────────────────
/**
 * Always-visible standings during a game. Kept to one line: it sits above the
 * question, and a two-line strip pushes the question itself off a 4:3 projector.
 */
export function ScoreStrip({
  state, isRTL, isAr,
}: {
  state: GameState;
  isRTL: boolean;
  isAr: boolean;
}) {
  const rows = standings(state);
  return (
    <View style={[strip.wrap, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
      {rows.map(team => (
        <View
          key={team.id}
          style={[
            strip.chip,
            {
              borderColor: team.color + '55',
              backgroundColor: team.color + '14',
              flexDirection: isRTL ? 'row-reverse' : 'row',
            },
          ]}
        >
          <Text style={strip.emoji}>{team.emoji}</Text>
          <Text style={[strip.score, { color: team.color, fontFamily: 'Cairo_700Bold' }]}>
            {num(team.score, isAr)}
          </Text>
          {/* A live streak is the thing that makes the room react — it earns
              the only decoration on the strip. */}
          {team.streak >= 2 && <Text style={strip.fire}>🔥</Text>}
        </View>
      ))}
    </View>
  );
}

// ─── Teacher award control ────────────────────────────────────────────────────
/**
 * "Which teams got it right?" — shown only after the reveal.
 *
 * Taps toggle rather than accumulate, because the correction case is as common
 * as the first tap: the teacher awards, a student objects, the teacher undoes.
 * `classGame` recomputes scores from the ledger, so an undo is exact.
 */
export function AwardRow({
  state, questionIndex, isRTL, onToggle, onAll, labels,
}: {
  state: GameState;
  questionIndex: number;
  isRTL: boolean;
  onToggle: (teamId: string) => void;
  onAll: () => void;
  labels: { prompt: string; all: string };
}) {
  const allAwarded = state.teams.every(team => isAwarded(state, questionIndex, team.id));

  return (
    <View style={award.wrap}>
      <Text style={[award.prompt, { fontFamily: 'Cairo_600SemiBold' }]}>{labels.prompt}</Text>

      <View style={[award.row, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
        {state.teams.map(team => {
          const on = isAwarded(state, questionIndex, team.id);
          return (
            <Pressable
              key={team.id}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                onToggle(team.id);
              }}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: on }}
              accessibilityLabel={team.name}
              style={[
                award.team,
                {
                  borderColor: on ? team.color : BORDER,
                  backgroundColor: on ? team.color + '26' : CARD_BG,
                },
              ]}
            >
              <Text style={award.teamEmoji}>{team.emoji}</Text>
              <Text
                style={[award.teamName, { color: on ? team.color : TEXT_MUTED, fontFamily: 'Cairo_600SemiBold' }]}
                numberOfLines={1}
              >
                {team.name}
              </Text>
              {on && <Ionicons name="checkmark-circle" size={18} color={team.color} />}
            </Pressable>
          );
        })}
      </View>

      <Pressable
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onAll();
        }}
        style={[
          award.allBtn,
          {
            borderColor: allAwarded ? GREEN : BORDER,
            backgroundColor: allAwarded ? GREEN + '18' : 'transparent',
            flexDirection: isRTL ? 'row-reverse' : 'row',
          },
        ]}
      >
        <Ionicons name="people-outline" size={16} color={allAwarded ? GREEN : TEXT_MUTED} />
        <Text style={[award.allText, { color: allAwarded ? GREEN : TEXT_MUTED, fontFamily: 'Cairo_500Medium' }]}>
          {labels.all}
        </Text>
      </Pressable>
    </View>
  );
}

// ─── Full standings slide ─────────────────────────────────────────────────────
export function ScoreboardView({
  state, isRTL, isAr, labels,
}: {
  state: GameState;
  isRTL: boolean;
  isAr: boolean;
  labels: { points: string; streak: (n: number) => string };
}) {
  const rows = standings(state);
  const leader = rows[0]?.score ?? 0;

  return (
    <View style={board.wrap}>
      {rows.map(team => (
        <View
          key={team.id}
          style={[
            board.row,
            {
              borderColor: team.color + '40',
              backgroundColor: team.color + '10',
              flexDirection: isRTL ? 'row-reverse' : 'row',
            },
          ]}
        >
          <Text style={[board.rank, { color: team.color, fontFamily: 'Cairo_700Bold' }]}>
            {team.rank <= 3 ? MEDALS[team.rank - 1] : num(team.rank, isAr)}
          </Text>
          <Text style={board.emoji}>{team.emoji}</Text>
          <View style={{ flex: 1, marginHorizontal: 12 }}>
            <Text
              style={[board.name, { fontFamily: 'Cairo_700Bold', textAlign: isRTL ? 'right' : 'left' }]}
              numberOfLines={1}
            >
              {team.name}
            </Text>
            {/* Bar is relative to the leader, not to a fixed maximum: the point
                is how far behind you are, which a fixed scale hides early on. */}
            <View style={board.barTrack}>
              <View
                style={[
                  board.barFill,
                  {
                    backgroundColor: team.color,
                    width: `${leader > 0 ? (team.score / leader) * 100 : 0}%` as any,
                  },
                ]}
              />
            </View>
          </View>
          <View style={{ alignItems: isRTL ? 'flex-start' : 'flex-end' }}>
            <Text style={[board.score, { color: team.color, fontFamily: 'Cairo_700Bold' }]}>
              {num(team.score, isAr)}
            </Text>
            <Text style={[board.scoreLabel, { fontFamily: 'Almarai_400Regular' }]}>
              {team.streak >= 2 ? labels.streak(team.streak) : labels.points}
            </Text>
          </View>
        </View>
      ))}
    </View>
  );
}

// ─── Podium ───────────────────────────────────────────────────────────────────
export function PodiumView({
  groups, isRTL, isAr, labels, onPlayAgain,
}: {
  groups: TeamStanding[][];
  isRTL: boolean;
  isAr: boolean;
  labels: { points: string; empty: string; playAgain: string };
  onPlayAgain: () => void;
}) {
  // Offered on both branches: after a round where nobody scored, replaying is
  // the *most* likely next action, not the least.
  const playAgain = (
    <Pressable
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        onPlayAgain();
      }}
      style={[podium.againBtn, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}
    >
      <Ionicons name="refresh" size={18} color={TEXT_MUTED} />
      <Text style={[podium.againText, { fontFamily: 'Cairo_600SemiBold' }]}>{labels.playAgain}</Text>
    </Pressable>
  );

  if (groups.length === 0) {
    return (
      <View style={podium.empty}>
        <Text style={podium.emptyEmoji}>🤷</Text>
        <Text style={[podium.emptyText, { fontFamily: 'Almarai_400Regular' }]}>{labels.empty}</Text>
        {playAgain}
      </View>
    );
  }

  return (
    <View style={podium.wrap}>
      {groups.map((group, gi) => (
        <View key={gi} style={podium.tier}>
          {group.map(team => (
            <View
              key={team.id}
              style={[
                podium.card,
                {
                  borderColor: team.color + (gi === 0 ? '' : '55'),
                  backgroundColor: team.color + (gi === 0 ? '22' : '12'),
                  flexDirection: isRTL ? 'row-reverse' : 'row',
                },
              ]}
            >
              <Text style={[podium.medal, { fontSize: gi === 0 ? 52 : 38 }]}>{MEDALS[gi]}</Text>
              <View style={{ flex: 1, marginHorizontal: 14 }}>
                <Text
                  style={[
                    podium.name,
                    { fontSize: gi === 0 ? 32 : 24, fontFamily: 'Cairo_700Bold', textAlign: isRTL ? 'right' : 'left' },
                  ]}
                  numberOfLines={1}
                >
                  {team.emoji} {team.name}
                </Text>
              </View>
              <View style={{ alignItems: 'center' }}>
                <Text
                  style={[podium.score, { color: team.color, fontSize: gi === 0 ? 40 : 28, fontFamily: 'Cairo_700Bold' }]}
                >
                  {num(team.score, isAr)}
                </Text>
                <Text style={[podium.scoreLabel, { fontFamily: 'Almarai_400Regular' }]}>{labels.points}</Text>
              </View>
            </View>
          ))}
        </View>
      ))}
      {playAgain}
    </View>
  );
}

const strip = StyleSheet.create({
  wrap: { gap: 8, paddingHorizontal: 16, paddingBottom: 8, justifyContent: 'center', flexWrap: 'wrap' },
  chip: { alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 18, borderWidth: 1 },
  emoji: { fontSize: 16 },
  score: { fontSize: 18 },
  fire: { fontSize: 13 },
});

const award = StyleSheet.create({
  wrap: { marginTop: 16, gap: 10, borderTopWidth: 1, borderTopColor: BORDER, paddingTop: 14 },
  prompt: { fontSize: 15, color: TEXT_PRIMARY, textAlign: 'center' },
  row: { gap: 10, flexWrap: 'wrap', justifyContent: 'center' },
  team: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 16, paddingVertical: 14, borderRadius: 14, borderWidth: 2, minWidth: 132,
  },
  teamEmoji: { fontSize: 22 },
  teamName: { fontSize: 15, flexShrink: 1 },
  allBtn: {
    alignSelf: 'center', alignItems: 'center', gap: 8,
    paddingHorizontal: 16, paddingVertical: 9, borderRadius: 20, borderWidth: 1,
  },
  allText: { fontSize: 13 },
});

const board = StyleSheet.create({
  wrap: { gap: 12, marginTop: 12 },
  row: { alignItems: 'center', gap: 4, padding: 16, borderRadius: 16, borderWidth: 1.5 },
  rank: { fontSize: 24, minWidth: 42, textAlign: 'center' },
  emoji: { fontSize: 30 },
  name: { fontSize: 22, color: TEXT_PRIMARY, marginBottom: 8 },
  barTrack: { height: 8, borderRadius: 4, backgroundColor: BORDER, overflow: 'hidden' },
  barFill: { height: 8, borderRadius: 4 },
  score: { fontSize: 30 },
  scoreLabel: { fontSize: 11, color: TEXT_MUTED },
});

const podium = StyleSheet.create({
  wrap: { gap: 14, marginTop: 16 },
  tier: { gap: 10 },
  card: { alignItems: 'center', padding: 20, borderRadius: 18, borderWidth: 2 },
  medal: { flexShrink: 0 },
  name: { color: TEXT_PRIMARY },
  score: {},
  scoreLabel: { fontSize: 12, color: TEXT_MUTED },
  empty: { alignItems: 'center', gap: 12, paddingVertical: 40 },
  emptyEmoji: { fontSize: 56 },
  emptyText: { fontSize: 16, color: TEXT_MUTED, textAlign: 'center' },
  againBtn: {
    alignSelf: 'center', alignItems: 'center', gap: 8, marginTop: 8,
    paddingHorizontal: 20, paddingVertical: 12, borderRadius: 22,
    borderWidth: 1, borderColor: BORDER, backgroundColor: CARD_BG,
  },
  againText: { fontSize: 14, color: TEXT_MUTED },
});
