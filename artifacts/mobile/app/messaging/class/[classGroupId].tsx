/**
 * Resolves a class to its (get-or-create) chat thread, then hands off to the
 * ordinary thread screen. Kept separate from [threadId].tsx rather than
 * teaching that screen two ways to load, since every other entry point
 * already has a thread id in hand and only this one starts from a class.
 */
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import { getClassThread } from '@/services/messaging';
import { apiErrorMessage } from '@/services/apiErrorKey';

export default function ClassThreadRedirect() {
  const { classGroupId } = useLocalSearchParams<{ classGroupId: string }>();
  const colors = useColors();
  const { t } = useLanguage();
  const [error, setError] = useState('');

  useEffect(() => {
    if (!classGroupId) return;
    let cancelled = false;
    (async () => {
      try {
        const thread = await getClassThread(classGroupId);
        if (!cancelled) router.replace(`/messaging/${thread.id}`);
      } catch (e) {
        if (!cancelled) setError(apiErrorMessage(e, 'messagingLoadError', t));
      }
    })();
    return () => { cancelled = true; };
  }, [classGroupId, t]);

  return (
    <View style={[styles.center, { backgroundColor: colors.background }]}>
      {error ? (
        <Text style={{ color: colors.destructive, fontFamily: 'Almarai_400Regular', fontSize: 15, lineHeight: 24 }}>{error}</Text>
      ) : (
        <ActivityIndicator color={colors.primary} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
