/**
 * Parent message — compose a note to a student's guardian.
 *
 * The preview updates as the teacher types rather than sitting behind a
 * "Generate" button. Composition is deterministic (see `parentMessage.ts`), so
 * there is nothing to wait for, and seeing the letter change as you switch
 * tone or kind is what makes it obvious the tool is arranging *your* facts
 * rather than writing its own.
 */
import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import { useAuth } from '@/context/AuthContext';
import { Toast } from '@/components/ui/Toast';
import { copyToClipboard, shareAsText } from '@/services/share';
import {
  composeParentMessage, kindEmoji, kindLabel, MESSAGE_KINDS, needsDetails,
  type Gender, type MessageKind, type Tone,
} from '@/services/parentMessage';

const ACCENT = '#8B5CF6';

export default function ParentMessageScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { t, isRTL, lang } = useLanguage();
  const { user } = useAuth();
  const isAr = lang === 'ar';
  const topPad = insets.top + (insets.top === 0 ? 67 : 0);

  const [studentName, setStudentName] = useState('');
  const [studentGender, setStudentGender] = useState<Gender>('male');
  const [kind, setKind] = useState<MessageKind>('praise');
  const [details, setDetails] = useState('');
  const [tone, setTone] = useState<Tone>('formal');
  const [teacherName, setTeacherName] = useState(user?.name ?? '');
  const [teacherGender, setTeacherGender] = useState<Gender>('male');
  const [subject, setSubject] = useState('');
  const [toastMsg, setToastMsg] = useState('');
  const [toastVisible, setToastVisible] = useState(false);
  const showToast = (m: string) => { setToastMsg(m); setToastVisible(true); };

  const message = useMemo(
    () => composeParentMessage(
      { studentName, studentGender, kind, details, teacherName, teacherGender, subject, tone },
      isAr,
    ),
    [studentName, studentGender, kind, details, teacherName, teacherGender, subject, tone, isAr],
  );

  const ready = message.length > 0;

  const onCopy = async () => {
    if (!ready) return;
    await copyToClipboard(message);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    showToast(t('copiedToClipboard'));
  };

  const onSend = async () => {
    if (!ready) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    // shareAsText falls back to the clipboard where the OS share sheet is
    // unavailable (desktop web), and says which happened so the toast is honest.
    const how = await shareAsText(message, t('parentMsgTitle'));
    showToast(how === 'shared' ? t('parentMsgSent') : t('copiedToClipboard'));
  };

  const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <View style={{ marginBottom: 16 }}>
      <Text style={[styles.label, {
        color: colors.foreground, fontFamily: 'Cairo_500Medium',
        textAlign: isRTL ? 'right' : 'left',
      }]}>
        {label}
      </Text>
      {children}
    </View>
  );

  const Segmented = <T extends string>({ options, value, onChange }: {
    options: { value: T; label: string }[]; value: T; onChange: (v: T) => void;
  }) => (
    <View style={[styles.pillRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
      {options.map(o => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => { onChange(o.value); Haptics.selectionAsync(); }}
            style={[styles.pill, {
              backgroundColor: active ? ACCENT : colors.card,
              borderColor: active ? ACCENT : colors.border,
              borderRadius: colors.radius,
            }]}
          >
            <Text style={[styles.pillText, {
              color: active ? '#fff' : colors.mutedForeground,
              fontFamily: active ? 'Cairo_600SemiBold' : 'Almarai_400Regular',
            }]}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );

  const input = (extra?: object) => ([styles.input, {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: colors.radius,
    color: colors.foreground,
    textAlign: isRTL ? 'right' : 'left',
    fontFamily: 'Almarai_400Regular',
  }, extra]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
        <View style={[styles.header, { paddingTop: topPad + 12, backgroundColor: ACCENT }]}>
          <Pressable onPress={() => router.back()} style={[styles.backBtn, { alignSelf: isRTL ? 'flex-end' : 'flex-start' }]}>
            <Ionicons name={isRTL ? 'arrow-forward' : 'arrow-back'} size={22} color="#fff" />
          </Pressable>
          <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <Text style={{ fontSize: 22 }}>✉️</Text>
            <Text style={{ color: '#fff', fontFamily: 'Cairo_700Bold', fontSize: 20, textAlign: isRTL ? 'right' : 'left' }}>
              {t('parentMsgTitle')}
            </Text>
          </View>
          <Text style={{ color: 'rgba(255,255,255,0.85)', fontFamily: 'Almarai_400Regular', fontSize: 13, lineHeight: 20, textAlign: isRTL ? 'right' : 'left' }}>
            {t('parentMsgSubtitle')}
          </Text>
        </View>

        <View style={{ padding: 20 }}>
          <Field label={t('parentMsgStudentName')}>
            <TextInput
              value={studentName}
              onChangeText={setStudentName}
              placeholder={t('parentMsgStudentNamePlaceholder')}
              placeholderTextColor={colors.mutedForeground}
              style={input()}
            />
          </Field>

          <Field label={t('parentMsgStudentGender')}>
            <Segmented
              value={studentGender}
              onChange={setStudentGender}
              options={[
                { value: 'male', label: t('parentMsgMale') },
                { value: 'female', label: t('parentMsgFemale') },
              ]}
            />
          </Field>

          <Field label={t('parentMsgKind')}>
            <View style={[styles.pillRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
              {MESSAGE_KINDS.map(k => {
                const active = k === kind;
                return (
                  <Pressable
                    key={k}
                    onPress={() => { setKind(k); Haptics.selectionAsync(); }}
                    style={[styles.pill, {
                      backgroundColor: active ? ACCENT : colors.card,
                      borderColor: active ? ACCENT : colors.border,
                      borderRadius: colors.radius,
                      flexDirection: isRTL ? 'row-reverse' : 'row',
                    }]}
                  >
                    <Text style={{ fontSize: 13 }}>{kindEmoji(k)}</Text>
                    <Text style={[styles.pillText, {
                      color: active ? '#fff' : colors.mutedForeground,
                      fontFamily: active ? 'Cairo_600SemiBold' : 'Almarai_400Regular',
                      marginHorizontal: 5,
                    }]}>
                      {kindLabel(k, isAr)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </Field>

          {/* The tool states plainly that it will not invent the specifics —
              the teacher is the only source for what actually happened. */}
          <Field label={needsDetails(kind) ? t('parentMsgDetailsRequired') : t('parentMsgDetails')}>
            <TextInput
              value={details}
              onChangeText={setDetails}
              placeholder={t('parentMsgDetailsPlaceholder')}
              placeholderTextColor={colors.mutedForeground}
              multiline
              numberOfLines={3}
              style={input({ minHeight: 84, textAlignVertical: 'top' })}
            />
            <Text style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: 11, lineHeight: 17, marginTop: 6, textAlign: isRTL ? 'right' : 'left' }}>
              {t('parentMsgFactsNote')}
            </Text>
          </Field>

          <Field label={t('parentMsgTone')}>
            <Segmented
              value={tone}
              onChange={setTone}
              options={[
                { value: 'formal', label: t('parentMsgFormal') },
                { value: 'warm', label: t('parentMsgWarm') },
              ]}
            />
          </Field>

          <Field label={t('parentMsgSignature')}>
            <TextInput
              value={teacherName}
              onChangeText={setTeacherName}
              placeholder={t('parentMsgTeacherName')}
              placeholderTextColor={colors.mutedForeground}
              style={input()}
            />
            <View style={{ height: 8 }} />
            <TextInput
              value={subject}
              onChangeText={setSubject}
              placeholder={t('parentMsgSubject')}
              placeholderTextColor={colors.mutedForeground}
              style={input()}
            />
            <View style={{ height: 8 }} />
            <Segmented
              value={teacherGender}
              onChange={setTeacherGender}
              options={[
                { value: 'male', label: t('parentMsgTeacherMale') },
                { value: 'female', label: t('parentMsgTeacherFemale') },
              ]}
            />
          </Field>
        </View>

        {/* Preview */}
        <View style={{ paddingHorizontal: 20 }}>
          <Text style={[styles.label, { color: colors.foreground, fontFamily: 'Cairo_600SemiBold', textAlign: isRTL ? 'right' : 'left' }]}>
            {t('parentMsgPreview')}
          </Text>
          <View style={[styles.preview, {
            backgroundColor: colors.card, borderColor: ready ? ACCENT + '40' : colors.border,
            borderRadius: colors.radius,
          }]}>
            {ready ? (
              <Text style={{ color: colors.foreground, fontFamily: 'Almarai_400Regular', fontSize: 14, lineHeight: 26, textAlign: isRTL ? 'right' : 'left' }}>
                {message}
              </Text>
            ) : (
              <Text style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: 13, textAlign: 'center', paddingVertical: 20 }}>
                {t('parentMsgNeedsName')}
              </Text>
            )}
          </View>

          <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', gap: 10, marginTop: 12 }}>
            <Pressable
              onPress={onSend}
              disabled={!ready}
              style={({ pressed }) => [styles.primaryBtn, {
                backgroundColor: ACCENT, borderRadius: colors.radius,
                flexDirection: isRTL ? 'row-reverse' : 'row',
                opacity: !ready ? 0.4 : pressed ? 0.88 : 1,
              }]}
            >
              <Ionicons name="paper-plane-outline" size={18} color="#fff" />
              <Text style={{ color: '#fff', fontFamily: 'Cairo_700Bold', fontSize: 14 }}>{t('parentMsgSend')}</Text>
            </Pressable>
            <Pressable
              onPress={onCopy}
              disabled={!ready}
              style={[styles.secondaryBtn, {
                borderColor: colors.border, borderRadius: colors.radius,
                flexDirection: isRTL ? 'row-reverse' : 'row',
                opacity: ready ? 1 : 0.4,
              }]}
            >
              <Ionicons name="copy-outline" size={16} color={colors.mutedForeground} />
              <Text style={{ color: colors.mutedForeground, fontFamily: 'Cairo_600SemiBold', fontSize: 13 }}>{t('copy')}</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>

      <Toast visible={toastVisible} message={toastMsg} onHide={() => setToastVisible(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 20, paddingBottom: 24 },
  backBtn: { width: 40, height: 40, justifyContent: 'center', marginBottom: 8 },
  label: { fontSize: 13, marginBottom: 8 },
  pillRow: { flexWrap: 'wrap', gap: 8 },
  pill: { alignItems: 'center', paddingHorizontal: 13, paddingVertical: 8, borderWidth: 1.5 },
  pillText: { fontSize: 13 },
  input: { borderWidth: 1, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14 },
  preview: { borderWidth: 1.5, padding: 16, marginTop: 4 },
  primaryBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 15 },
  secondaryBtn: { alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 15, paddingHorizontal: 18, borderWidth: 1.5 },
});
