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
import { MessagingError, getClassThread } from '@/services/messaging';

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
        if (!cancelled) setError(e instanceof MessagingError ? e.message : t('messagingLoadError'));
      }
    })();
    return () => { cancelled = true; };
  }, [classGroupId, t]);

  return (
    <View style={[styles.center, { backgroundColor: colors.background }]}>
      {error ? (
        <Text style={{ color: colors.destructive, fontFamily: 'Almarai_400Regular', fontSize: 13 }}>{error}</Text>
      ) : (
        <ActivityIndicator color={colors.primary} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
