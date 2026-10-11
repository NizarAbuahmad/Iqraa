import React from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import type { QuizCopy } from '@/services/quizExport';
import { PRINT_STYLES, type PrintStyle } from '@/services/printStyle';
import type { TranslationKey } from '@/services/i18n';
import { palette } from '@/constants/colors';

interface ExportOption {
  id: string;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  sublabel: string;
  color: string;
  loading?: boolean;
  /** Carried on the option itself. This used to be a separate `handlers`
   *  record keyed by `id`, so adding a row without adding its entry crashed
   *  on tap — invisible until someone pressed the new one. */
  onPress: () => void;
}

interface ExportMenuProps {
  visible: boolean;
  onClose: () => void;
  onShare: () => void;
  onCopy: () => void;
  onPDF: () => void;
  onWord: () => void;
  onSlides?: () => void;
  /** The Ministry lesson-plan form — only the lesson-plan page offers it. */
  onMinistry?: () => void;
  /** One line under the title — e.g. which copy (student/teacher) the
   *  exports below will produce. */
  note?: string;
  /** Student or teacher copy, picked here — for a screen with no answers
   *  toggle of its own to decide it (موادي, the chat). */
  copyChoice?: { value: QuizCopy; onChange: (copy: QuizCopy) => void };
  /** How the PDF looks — colour, ink-saver, large print. Only the papers a
   *  student holds (worksheet, quiz) offer it; see services/printStyle.ts. */
  printStyle?: { value: PrintStyle; onChange: (style: PrintStyle) => void };
  isRTL: boolean;
  loadingPDF?: boolean;
  loadingWord?: boolean;
  loadingSlides?: boolean;
  /** i18n labels */
  labels: {
    title: string;
    shareLabel: string;
    shareSub: string;
    copyLabel: string;
    copySub: string;
    pdfLabel: string;
    pdfSub: string;
    wordLabel: string;
    wordSub: string;
    slidesLabel?: string;
    slidesSub?: string;
    ministryLabel?: string;
    ministrySub?: string;
    cancel: string;
  };
}

export function ExportMenu({
  visible,
  onClose,
  onShare,
  onCopy,
  onPDF,
  onWord,
  onSlides,
  onMinistry,
  note,
  copyChoice,
  printStyle,
  isRTL,
  loadingPDF,
  loadingWord,
  loadingSlides,
  labels,
}: ExportMenuProps) {
  const colors = useColors();
  const { t } = useLanguage();

  const options: ExportOption[] = [
    {
      id: 'share',
      icon: 'share-outline',
      label: labels.shareLabel,
      sublabel: labels.shareSub,
      color: palette.info,
      onPress: onShare,
    },
    {
      id: 'copy',
      icon: 'copy-outline',
      label: labels.copyLabel,
      sublabel: labels.copySub,
      color: '#6366F1',
      onPress: onCopy,
    },
    {
      id: 'pdf',
      icon: 'document-outline',
      label: labels.pdfLabel,
      sublabel: labels.pdfSub,
      color: palette.destructive,
      loading: loadingPDF,
      onPress: onPDF,
    },
    {
      id: 'word',
      icon: 'document-text-outline',
      label: labels.wordLabel,
      sublabel: labels.wordSub,
      color: '#2563EB',
      loading: loadingWord,
      onPress: onWord,
    },
    ...(onSlides && labels.slidesLabel ? [{
      id: 'slides',
      icon: 'easel-outline' as keyof typeof Ionicons.glyphMap,
      label: labels.slidesLabel,
      sublabel: labels.slidesSub ?? '',
      color: '#7C3AED',
      loading: loadingSlides,
      onPress: onSlides,
    }] : []),
    ...(onMinistry && labels.ministryLabel ? [{
      id: 'ministry',
      icon: 'ribbon-outline' as keyof typeof Ionicons.glyphMap,
      label: labels.ministryLabel,
      sublabel: labels.ministrySub ?? '',
      color: '#0F766E',
      onPress: onMinistry,
    }] : []),
  ];

  return (
    <Modal
      transparent
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <View style={[styles.sheet, { backgroundColor: colors.card, borderTopColor: colors.border }]} onStartShouldSetResponder={() => true}>
          {/* Handle */}
          <View style={[styles.handle, { backgroundColor: colors.border }]} />

          {/* Title */}
          <Text style={[styles.title, { color: colors.foreground, fontFamily: 'ReadexPro_600SemiBold', textAlign: isRTL ? 'right' : 'left' }]}>
            {labels.title}
          </Text>
          {copyChoice ? (
            <View style={[styles.copyRow, { flexDirection: isRTL ? 'row-reverse' : 'row', backgroundColor: colors.muted }]}>
              {(['student', 'teacher'] as const).map(copy => {
                const on = copyChoice.value === copy;
                return (
                  <Pressable
                    key={copy}
                    accessibilityRole="button"
                    aria-selected={on}
                    onPress={() => copyChoice.onChange(copy)}
                    style={[styles.copyOption, on && { backgroundColor: colors.card, borderColor: colors.border }]}
                  >
                    <Text style={[styles.copyLabel, { color: on ? colors.foreground : colors.mutedForeground, fontFamily: on ? 'ReadexPro_600SemiBold' : 'ReadexPro_500Medium' }]}>
                      {t(copy === 'student' ? 'exportStudentCopy' : 'exportTeacherCopy')}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          ) : null}
          {copyChoice ? (
            <Text style={[styles.note, { marginTop: 0, color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', textAlign: isRTL ? 'right' : 'left' }]}>
              {t(copyChoice.value === 'student' ? 'exportStudentCopySub' : 'exportTeacherCopySub')}
            </Text>
          ) : null}
          {printStyle ? (
            <>
              <Text style={[styles.groupLabel, { color: colors.mutedForeground, fontFamily: 'ReadexPro_500Medium', textAlign: isRTL ? 'right' : 'left' }]}>
                {t('exportPrintStyle')}
              </Text>
              <View style={[styles.copyRow, { flexDirection: isRTL ? 'row-reverse' : 'row', backgroundColor: colors.muted }]}>
                {PRINT_STYLES.map(style => {
                  const on = printStyle.value === style;
                  return (
                    <Pressable
                      key={style}
                      accessibilityRole="button"
                      aria-selected={on}
                      onPress={() => printStyle.onChange(style)}
                      style={[styles.copyOption, on && { backgroundColor: colors.card, borderColor: colors.border }]}
                    >
                      <Text style={[styles.copyLabel, { color: on ? colors.foreground : colors.mutedForeground, fontFamily: on ? 'ReadexPro_600SemiBold' : 'ReadexPro_500Medium' }]}>
                        {t(PRINT_STYLE_LABEL[style])}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              <Text style={[styles.note, { marginTop: 0, color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', textAlign: isRTL ? 'right' : 'left' }]}>
                {t(PRINT_STYLE_SUB[printStyle.value])}
              </Text>
            </>
          ) : null}
          {note ? (
            <Text style={[styles.note, { color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', textAlign: isRTL ? 'right' : 'left' }]}>
              {note}
            </Text>
          ) : null}

          {/* Options */}
          {options.map(opt => (
            <Pressable
              key={opt.id}
              onPress={() => { if (!opt.loading) { onClose(); opt.onPress(); } }}
              style={({ pressed }) => [
                styles.row,
                { flexDirection: isRTL ? 'row-reverse' : 'row', borderColor: colors.border, opacity: pressed ? 0.7 : 1 },
              ]}
            >
              <View style={[styles.iconWrap, { backgroundColor: opt.color + '18' }]}>
                <Ionicons name={opt.icon} size={22} color={opt.color} />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={[styles.rowLabel, { color: colors.foreground, fontFamily: 'ReadexPro_500Medium', textAlign: isRTL ? 'right' : 'left' }]}>
                  {opt.label}
                </Text>
                <Text style={[styles.rowSub, { color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', textAlign: isRTL ? 'right' : 'left' }]}>
                  {opt.sublabel}
                </Text>
              </View>
              {opt.loading
                ? <ActivityIndicator size="small" color={opt.color} />
                : <Ionicons name={isRTL ? 'chevron-back' : 'chevron-forward'} size={16} color={colors.mutedForeground} />
              }
            </Pressable>
          ))}

          {/* Cancel */}
          <Pressable
            onPress={onClose}
            style={[styles.cancelBtn, { backgroundColor: colors.muted, borderRadius: 12 }]}
          >
            <Text style={[styles.cancelText, { color: colors.foreground, fontFamily: 'ReadexPro_500Medium' }]}>
              {labels.cancel}
            </Text>
          </Pressable>
        </View>
      </Pressable>
    </Modal>
  );
}

const PRINT_STYLE_LABEL: Record<PrintStyle, TranslationKey> = {
  colour: 'printStyleColour',
  ink: 'printStyleInk',
  large: 'printStyleLarge',
};
const PRINT_STYLE_SUB: Record<PrintStyle, TranslationKey> = {
  colour: 'printStyleColourSub',
  ink: 'printStyleInkSub',
  large: 'printStyleLargeSub',
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: 1,
    padding: 20,
    paddingBottom: 36,
    gap: 4,
  },
  handle: {
    width: 40, height: 4, borderRadius: 2,
    alignSelf: 'center', marginBottom: 16,
  },
  title: { fontSize: 16, marginBottom: 12 },
  note: { fontSize: 13, lineHeight: 21, marginTop: -8, marginBottom: 8 },
  copyRow: { borderRadius: 10, padding: 3, gap: 3, marginBottom: 8 },
  copyOption: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: 'transparent' },
  copyLabel: { fontSize: 14 },
  groupLabel: { fontSize: 13, marginBottom: 8 },
  row: {
    alignItems: 'center', gap: 14,
    paddingVertical: 14, borderBottomWidth: 1,
  },
  iconWrap: {
    width: 44, height: 44, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  rowLabel: { fontSize: 15 },
  rowSub: { fontSize: 13, lineHeight: 21 },
  cancelBtn: { marginTop: 12, padding: 14, alignItems: 'center' },
  cancelText: { fontSize: 15 },
});
