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
      color: '#3B82F6',
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
      color: '#EF4444',
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
          <Text style={[styles.title, { color: colors.foreground, fontFamily: 'Cairo_600SemiBold', textAlign: isRTL ? 'right' : 'left' }]}>
            {labels.title}
          </Text>

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
                <Text style={[styles.rowLabel, { color: colors.foreground, fontFamily: 'Cairo_500Medium', textAlign: isRTL ? 'right' : 'left' }]}>
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
            <Text style={[styles.cancelText, { color: colors.foreground, fontFamily: 'Cairo_500Medium' }]}>
              {labels.cancel}
            </Text>
          </Pressable>
        </View>
      </Pressable>
    </Modal>
  );
}

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
  row: {
    alignItems: 'center', gap: 14,
    paddingVertical: 14, borderBottomWidth: 1,
  },
  iconWrap: {
    width: 44, height: 44, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  rowLabel: { fontSize: 15 },
  rowSub: { fontSize: 12 },
  cancelBtn: { marginTop: 12, padding: 14, alignItems: 'center' },
  cancelText: { fontSize: 15 },
});
