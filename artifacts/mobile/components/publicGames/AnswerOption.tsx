/**
 * One answer button of a TriviaBoard. Before an answer it is a plain card; after,
 * the right option is green with a tick (and swells once), a wrong pick is red
 * with a cross (and shakes once). Nothing moves under reduced motion.
 */
import React, { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useReduceMotion } from '@/hooks/useReduceMotion';
import { NATIVE_DRIVER } from '@/constants/animation';
import { ICON } from '@/constants/icons';
import { RADIUS, SPACE, TYPE } from '@/constants/theme';
import { ANSWER_MOTION } from '@/services/publicGames/answerMotion';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function AnswerOption({
  label, revealed, isCorrect, isPicked, onPress,
}: {
  label: string;
  revealed: boolean;
  isCorrect: boolean;
  isPicked: boolean;
  onPress: () => void;
}) {
  const colors = useColors();
  const reduced = useReduceMotion();
  const x = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!revealed || reduced) return;
    if (isPicked && !isCorrect) {
      Animated.sequence(
        ANSWER_MOTION.shake.map(v => Animated.timing(x, { toValue: v, duration: ANSWER_MOTION.shakeStepMs, useNativeDriver: NATIVE_DRIVER })),
      ).start();
    } else if (isCorrect) {
      Animated.sequence([
        Animated.timing(scale, { toValue: ANSWER_MOTION.popScale, duration: ANSWER_MOTION.popMs, useNativeDriver: NATIVE_DRIVER }),
        Animated.timing(scale, { toValue: 1, duration: ANSWER_MOTION.popMs, useNativeDriver: NATIVE_DRIVER }),
      ]).start();
    }
    // Once per reveal.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revealed]);

  const bg = !revealed ? colors.card : isCorrect ? '#16A34A22' : isPicked ? '#DC262622' : colors.card;
  const border = !revealed ? colors.border : isCorrect ? '#16A34A' : isPicked ? '#DC2626' : colors.border;
  return (
    <AnimatedPressable
      onPress={onPress}
      style={[styles.option, { backgroundColor: bg, borderColor: border, transform: [{ translateX: x }, { scale }] }]}
    >
      <Text style={{ color: colors.foreground, fontFamily: 'ReadexPro_600SemiBold', fontSize: TYPE.body, textAlign: 'center' }}>{label}</Text>
      {revealed && isCorrect && <Ionicons name="checkmark-circle" size={ICON.xl} color="#16A34A" style={styles.icon} />}
      {revealed && isPicked && !isCorrect && <Ionicons name="close-circle" size={ICON.xl} color="#DC2626" style={styles.icon} />}
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  option: {
    flexBasis: '47%', flexGrow: 1, borderWidth: 1, borderRadius: RADIUS.md, paddingVertical: SPACE.lg, paddingHorizontal: SPACE.md,
    alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: SPACE.sm,
  },
  icon: { marginTop: -SPACE.xxs },
});
