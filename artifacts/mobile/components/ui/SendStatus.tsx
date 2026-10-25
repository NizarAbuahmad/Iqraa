/**
 * The line under a finished homework round: «sending… / sent / not sent, retry».
 * Shared by the lesson games (`app/play/lesson/[lessonId].tsx`) and the Math
 * Corner's exercises, which both post a student's result back to the homework.
 * `onLeave` runs when it unmounts, so the caller can reset its status for the next round.
 */
import React, { useEffect, useRef } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import { TYPE } from '@/constants/theme';

export type SendState = 'sending' | 'sent' | 'failed';

export function SendStatus({ state, onRetry, onLeave }: { state: SendState; onRetry: () => void; onLeave?: () => void }) {
  const colors = useColors();
  const { t } = useLanguage();
  const leave = useRef(onLeave);
  leave.current = onLeave;
  useEffect(() => () => leave.current?.(), []);
  return (
    <View style={{ alignItems: 'center', gap: 6 }}>
      <Text
        style={{
          color: state === 'failed' ? colors.destructive : colors.mutedForeground,
          fontFamily: 'Almarai_400Regular',
          fontSize: TYPE.label,
          textAlign: 'center',
        }}
      >
        {t(state === 'sent' ? 'lessonGameSent' : state === 'failed' ? 'lessonGameSendFailed' : 'lessonGameSending')}
      </Text>
      {state === 'failed' ? (
        <Pressable accessibilityRole="button" hitSlop={8} onPress={onRetry}>
          <Text style={{ color: colors.primary, fontFamily: 'ReadexPro_600SemiBold', fontSize: TYPE.label, textDecorationLine: 'underline' }}>
            {t('retry')}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}
