/**
 * «بلّغ عن مشكلة» — the confirmation that used to be a bare yes/no, now with an
 * optional box for what is wrong.
 *
 * A report with no words only tells the admin *that* a paper was flagged, so
 * they had to open it and guess why (the 2026-11-11 Grade 4 Arabic report).
 * The reason is optional on purpose: a teacher mid-lesson can still send the
 * report in one tap. The same sheet serves the shared result row
 * (`GeneratorResultActions`) and Slides, so the two cannot drift apart.
 *
 * It holds a text input inside a `<Modal>`, so its body is wrapped in
 * `KeyboardSafeView` (CLAUDE.md: a Modal is its own window the root Stack's
 * wrapper cannot reach).
 */
import React from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import { textOn } from '@/services/readableColor';
import { REPORT_REASON_MAX } from '@/services/reportReason';
import { KeyboardSafeView } from './KeyboardSafeView';

export function ReportProblemSheet({
  visible,
  busy,
  onClose,
  onSubmit,
}: {
  visible: boolean;
  /** True while the report is being sent — the buttons stop answering. */
  busy: boolean;
  onClose: () => void;
  /** Called with the reason as typed (possibly empty). The caller trims, sends and closes. */
  onSubmit: (reason: string) => void;
}) {
  const colors = useColors();
  const { t, isRTL } = useLanguage();
  const [reason, setReason] = React.useState('');
  const align = isRTL ? 'right' : 'left';

  // Reopened for a later report: never show the last one's words.
  React.useEffect(() => {
    if (visible) setReason('');
  }, [visible]);

  const close = () => {
    if (!busy) onClose();
  };

  return (
    <Modal transparent visible={visible} animationType="slide" onRequestClose={close}>
      <KeyboardSafeView style={styles.fill}>
        <Pressable style={styles.overlay} onPress={close} accessibilityLabel={t('cancel')}>
          <View
            style={[styles.sheet, { backgroundColor: colors.card, borderTopColor: colors.border }]}
            onStartShouldSetResponder={() => true}
          >
            <View style={[styles.handle, { backgroundColor: colors.border }]} />
            <Text style={[styles.title, { color: colors.foreground, fontFamily: 'ReadexPro_600SemiBold', textAlign: align }]}>
              {t('reportArtifactTitle')}
            </Text>
            <Text style={[styles.note, { color: colors.mutedForeground, textAlign: align }]}>{t('reportArtifactMsg')}</Text>

            <Text style={[styles.label, { color: colors.foreground, fontFamily: 'ReadexPro_500Medium', textAlign: align }]}>
              {t('reportReasonLabel')}
            </Text>
            <TextInput
              value={reason}
              onChangeText={setReason}
              placeholder={t('reportReasonPlaceholder')}
              placeholderTextColor={colors.mutedForeground}
              accessibilityLabel={t('reportReasonLabel')}
              multiline
              maxLength={REPORT_REASON_MAX}
              editable={!busy}
              style={[
                styles.input,
                {
                  color: colors.foreground,
                  borderColor: colors.border,
                  borderRadius: colors.radius,
                  fontFamily: 'Almarai_400Regular',
                  textAlign: align,
                },
              ]}
            />

            <Pressable
              accessibilityRole="button"
              disabled={busy}
              onPress={() => onSubmit(reason)}
              style={[styles.send, { backgroundColor: colors.destructive, opacity: busy ? 0.6 : 1 }]}
            >
              {busy ? (
                <ActivityIndicator color={textOn(colors.destructive)} />
              ) : (
                <Text style={[styles.sendText, { color: textOn(colors.destructive), fontFamily: 'ReadexPro_600SemiBold' }]}>
                  {t('reportArtifactConfirm')}
                </Text>
              )}
            </Pressable>
            <Pressable
              accessibilityRole="button"
              disabled={busy}
              onPress={close}
              style={[styles.cancel, { backgroundColor: colors.muted, opacity: busy ? 0.6 : 1 }]}
            >
              <Text style={[styles.sendText, { color: colors.foreground, fontFamily: 'ReadexPro_500Medium' }]}>{t('cancel')}</Text>
            </Pressable>
          </View>
        </Pressable>
      </KeyboardSafeView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: { maxHeight: '92%', borderTopLeftRadius: 24, borderTopRightRadius: 24, borderTopWidth: 1, padding: 20, paddingBottom: 32 },
  handle: { width: 40, height: 4, borderRadius: 4, alignSelf: 'center', marginBottom: 16 },
  title: { fontSize: 17, marginBottom: 8 },
  note: { fontSize: 13, lineHeight: 21, fontFamily: 'Almarai_400Regular' },
  label: { fontSize: 13, marginTop: 14, marginBottom: 6 },
  input: { borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, minHeight: 88, textAlignVertical: 'top' },
  send: { marginTop: 14, minHeight: 44, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center', borderRadius: 12 },
  sendText: { fontSize: 15 },
  cancel: { marginTop: 8, minHeight: 44, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center', borderRadius: 12 },
});
