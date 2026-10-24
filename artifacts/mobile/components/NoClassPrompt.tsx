import React from 'react';
import { router } from 'expo-router';
import { useLanguage } from '@/context/LanguageContext';
import { EmptyState } from '@/components/ui/EmptyState';

/**
 * What a student who signed up with an email sees where a class would be
 * (since 2026-10-23): they have no class until they type their teacher's link
 * code, so homework, exams and the timetable are empty for that reason, not
 * because "your teachers haven't entered them yet". Says so and opens
 * `/join-class`.
 */
export function NoClassPrompt() {
  const { t } = useLanguage();
  return (
    <EmptyState
      icon="school-outline"
      title={t('schoolNoClassTitle')}
      body={t('schoolNoClassDesc')}
      action={{ label: t('joinAClass'), onPress: () => router.push('/join-class') }}
    />
  );
}
