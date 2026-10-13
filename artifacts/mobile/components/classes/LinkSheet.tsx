/**
 * "Add a link" — opened from a class's «+» sheet, beside the Library and the Lab.
 *
 * A teacher pastes a URL (Drive, YouTube, any site) and it goes on the class's
 * shelf as a pointer: Iqraa stores the link, never the file, so there is no
 * upload and no storage to pay for. The text is checked by `parseClassLink`
 * before anything is sent, so a bad paste is explained here instead of
 * bouncing off the server.
 *
 * A Modal is its own window, so it carries its own `KeyboardSafeView`; without
 * it the field sits behind the keyboard on Android.
 */
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import { KeyboardSafeView } from '@/components/ui/KeyboardSafeView';
import { TYPE } from '@/constants/theme';
import { parseClassLink, type ClassLinkProblem } from '@/services/classResources';

const PROBLEM_KEY = {
  empty: 'linkEmpty',
  insecure: 'linkInsecure',
  invalid: 'linkInvalid',
} as const satisfies Record<ClassLinkProblem, string>;

export function LinkSheet({
  visible,
  busy,
  error,
  onAdd,
  onClose,
}: {
  visible: boolean;
  busy: boolean;
  /** From the server (a repeat, a failed save). Shown inside: a toast on the screen would sit behind this Modal. */
  error?: string;
  /** Called with a link that already passed `parseClassLink`, and the title the teacher typed (maybe empty). */
  onAdd: (url: string, title: string) => void;
  onClose: () => void;
}) {
  const colors = useColors();
  const { t, isRTL } = useLanguage();
  const align = isRTL ? 'right' : 'left';
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [problem, setProblem] = useState<ClassLinkProblem | null>(null);

  // A sheet that reopens with last time's paste would look like a duplicate add.
  useEffect(() => {
    if (visible) {
      setUrl('');
      setTitle('');
      setProblem(null);
    }
  }, [visible]);

  const submit = () => {
    if (busy) return;
    const parsed = parseClassLink(url);
    if ('error' in parsed) {
      setProblem(parsed.error);
      return;
    }
    setProblem(null);
    onAdd(parsed.url, title);
  };

  const shown = problem ? t(PROBLEM_KEY[problem]) : error;
  const input = [
    styles.input,
    { borderColor: colors.border, color: colors.foreground, fontFamily: 'Almarai_400Regular', textAlign: align as 'left' | 'right' },
  ];

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardSafeView>
        <View style={styles.backdrop}>
          <View style={[styles.card, { backgroundColor: colors.card }]}>
            <Text style={[styles.title, { color: colors.foreground, fontFamily: 'ReadexPro_600SemiBold', textAlign: align }]}>
              {t('linkSheetTitle')}
            </Text>
            <Text style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: TYPE.caption, textAlign: align }}>
              {t('linkSheetHint')}
            </Text>

            <Text style={{ color: colors.foreground, fontFamily: 'ReadexPro_500Medium', fontSize: TYPE.caption, textAlign: align }}>
              {t('linkUrlLabel')}
            </Text>
            <TextInput
              value={url}
              onChangeText={v => {
                setUrl(v);
                setProblem(null);
              }}
              placeholder="https://"
              placeholderTextColor={colors.mutedForeground}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              returnKeyType="next"
              accessibilityLabel={t('linkUrlLabel')}
              // A link is left-to-right whatever the UI language, or its dots and slashes scramble.
              style={[...input, { writingDirection: 'ltr' }]}
            />

            <Text style={{ color: colors.foreground, fontFamily: 'ReadexPro_500Medium', fontSize: TYPE.caption, textAlign: align }}>
              {t('linkTitleLabel')}
            </Text>
            <TextInput
              value={title}
              onChangeText={setTitle}
              maxLength={200}
              placeholderTextColor={colors.mutedForeground}
              returnKeyType="done"
              onSubmitEditing={submit}
              accessibilityLabel={t('linkTitleLabel')}
              style={input}
            />

            {shown ? (
              <Text style={{ color: colors.destructive, fontFamily: 'Almarai_400Regular', fontSize: TYPE.caption, textAlign: align }}>
                {shown}
              </Text>
            ) : null}

            <View style={[styles.actions, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
              <Pressable onPress={onClose} style={styles.btn} accessibilityRole="button">
                <Text style={{ color: colors.mutedForeground, fontFamily: 'ReadexPro_600SemiBold' }}>{t('cancel')}</Text>
              </Pressable>
              <Pressable
                onPress={submit}
                disabled={busy}
                accessibilityRole="button"
                style={[styles.btn, { backgroundColor: colors.primary, opacity: busy ? 0.7 : 1 }]}
              >
                {busy ? (
                  <ActivityIndicator size="small" color={colors.primaryForeground} />
                ) : (
                  <Text style={{ color: colors.primaryForeground, fontFamily: 'ReadexPro_600SemiBold' }}>
                    {t('linkAddButton')}
                  </Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </KeyboardSafeView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: { width: '100%', maxWidth: 460, borderRadius: 16, padding: 20, gap: 10 },
  title: { fontSize: TYPE.bodyLg },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: TYPE.body },
  actions: { justifyContent: 'flex-end', gap: 8, marginTop: 4 },
  btn: { minWidth: 72, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18, paddingVertical: 11, borderRadius: 10 },
});
