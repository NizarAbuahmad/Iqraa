import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import {
  addAndProcessFiles,
  pickTeachingDocuments,
  pickTeachingImages,
  removeSessionDocument,
  subscribeSessionDocuments,
  type SessionDocument,
} from '@/services/documents';

type Props = {
  onDocumentsReady?: (docs: SessionDocument[]) => void;
  onRejectedFile?: (name: string) => void;
  isRTL?: boolean;
  /** When true, only chips are rendered (attach buttons live in the composer). */
  chipsOnly?: boolean;
  /** Render attach buttons inline (composer row). */
  showAttachButtons?: boolean;
};

const KIND_ICON: Record<string, keyof typeof Ionicons.glyphMap> = {
  pdf: 'document-text-outline',
  docx: 'document-outline',
  pptx: 'easel-outline',
  ppt: 'easel-outline',
  txt: 'reader-outline',
  image: 'image-outline',
  unknown: 'attach-outline',
};

export function DocumentAttachmentBar({
  onDocumentsReady,
  onRejectedFile,
  isRTL,
  chipsOnly = false,
  showAttachButtons = true,
}: Props) {
  const colors = useColors();
  const { t, isRTL: ctxRtl } = useLanguage();
  const rtl = isRTL ?? ctxRtl;
  const [docs, setDocs] = useState<SessionDocument[]>([]);
  const [busy, setBusy] = useState(false);
  const dropRef = useRef<View>(null);
  const readySig = useRef('');

  useEffect(() => subscribeSessionDocuments(setDocs), []);

  useEffect(() => {
    const ready = docs.filter(d => d.status === 'ready');
    const sig = ready.map(d => d.id).join('|');
    if (ready.length > 0 && sig !== readySig.current) {
      readySig.current = sig;
      onDocumentsReady?.(ready);
    }
  }, [docs, onDocumentsReady]);

  // Web drag & drop
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const node = dropRef.current as unknown as HTMLElement | null;
    if (!node) return;

    const prevent = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
    };

    const onDrop = async (e: DragEvent) => {
      prevent(e);
      const list = e.dataTransfer?.files;
      if (!list?.length) return;
      const files: { uri: string; name: string; mimeType?: string; size?: number }[] = [];
      for (let i = 0; i < list.length; i++) {
        const f = list.item(i);
        if (!f) continue;
        files.push({
          uri: URL.createObjectURL(f),
          name: f.name,
          mimeType: f.type,
          size: f.size,
        });
      }
      setBusy(true);
      try {
        await addAndProcessFiles(files, onRejectedFile);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } finally {
        setBusy(false);
      }
    };

    node.addEventListener('dragenter', prevent as any);
    node.addEventListener('dragover', prevent as any);
    node.addEventListener('drop', onDrop as any);
    return () => {
      node.removeEventListener('dragenter', prevent as any);
      node.removeEventListener('dragover', prevent as any);
      node.removeEventListener('drop', onDrop as any);
    };
  }, [onRejectedFile]);

  const handlePickDocs = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setBusy(true);
    try {
      const picked = await pickTeachingDocuments();
      if (picked.length) {
        await addAndProcessFiles(picked, onRejectedFile);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } finally {
      setBusy(false);
    }
  };

  const handlePickImages = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setBusy(true);
    try {
      const picked = await pickTeachingImages();
      if (picked.length) {
        await addAndProcessFiles(picked, onRejectedFile);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } finally {
      setBusy(false);
    }
  };

  const statusLabel = (d: SessionDocument) => {
    if (d.status === 'ready') return t('docStatusReady');
    if (d.status === 'error') return t('docStatusError');
    if (d.status === 'ocr') return t('docStatusOcr');
    if (d.status === 'parsing') return t('docStatusParsing');
    if (d.status === 'uploading') return t('docStatusUploading');
    return t('docStatusQueued');
  };

  return (
    <View ref={dropRef} style={styles.wrap}>
      {docs.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={[styles.chipRow, { flexDirection: rtl ? 'row-reverse' : 'row' }]}
        >
          {docs.map(d => (
            <View
              key={d.id}
              style={[
                styles.chip,
                {
                  backgroundColor: d.status === 'error' ? '#FEE2E2' : colors.secondary,
                  borderColor: d.status === 'ready' ? colors.primary + '55' : colors.border,
                },
              ]}
            >
              {d.status !== 'ready' && d.status !== 'error' ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Ionicons
                  name={KIND_ICON[d.kind] || 'attach-outline'}
                  size={14}
                  color={d.status === 'error' ? '#B91C1C' : colors.primary}
                />
              )}
              <View style={{ maxWidth: 140 }}>
                <Text
                  numberOfLines={1}
                  style={{ color: colors.foreground, fontFamily: 'Inter_500Medium', fontSize: 12 }}
                >
                  {d.name}
                </Text>
                <Text
                  numberOfLines={1}
                  style={{ color: colors.mutedForeground, fontFamily: 'Inter_400Regular', fontSize: 10 }}
                >
                  {statusLabel(d)}
                  {d.status !== 'ready' && d.status !== 'error'
                    ? ` · ${Math.round(d.progress * 100)}%`
                    : ''}
                </Text>
              </View>
              <Pressable
                onPress={() => {
                  Haptics.selectionAsync();
                  removeSessionDocument(d.id);
                }}
                hitSlop={8}
                accessibilityLabel={t('docRemove')}
              >
                <Ionicons name="close-circle" size={16} color={colors.mutedForeground} />
              </Pressable>
            </View>
          ))}
        </ScrollView>
      ) : Platform.OS === 'web' ? (
        <Text
          style={{
            color: colors.mutedForeground,
            fontFamily: 'Inter_400Regular',
            fontSize: 11,
            textAlign: rtl ? 'right' : 'left',
            paddingHorizontal: 4,
            marginBottom: 4,
          }}
        >
          {t('docDropHint')}
        </Text>
      ) : null}

      {showAttachButtons ? (
        <View style={[styles.actions, { flexDirection: rtl ? 'row-reverse' : 'row' }]}>
          <Pressable
            onPress={handlePickDocs}
            disabled={busy}
            style={({ pressed }) => [
              styles.actionBtn,
              { backgroundColor: colors.muted, opacity: pressed || busy ? 0.75 : 1 },
            ]}
            accessibilityLabel={t('docUpload')}
          >
            <Ionicons name="attach-outline" size={18} color={colors.primary} />
          </Pressable>
          <Pressable
            onPress={handlePickImages}
            disabled={busy}
            style={({ pressed }) => [
              styles.actionBtn,
              { backgroundColor: colors.muted, opacity: pressed || busy ? 0.75 : 1 },
            ]}
            accessibilityLabel={t('docUploadImage')}
          >
            <Ionicons name="image-outline" size={18} color={colors.primary} />
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

/** Compact attach controls for the composer row. */
export function DocumentAttachButtons({
  onRejectedFile,
  busyExternal,
}: {
  onRejectedFile?: (name: string) => void;
  busyExternal?: boolean;
}) {
  const colors = useColors();
  const { t } = useLanguage();
  const [busy, setBusy] = useState(false);
  const loading = busy || !!busyExternal;

  const run = async (picker: () => Promise<import('@/services/documents').PickedFile[]>) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setBusy(true);
    try {
      const picked = await picker();
      if (picked.length) {
        await addAndProcessFiles(picked, onRejectedFile);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Pressable
        onPress={() => run(pickTeachingDocuments)}
        disabled={loading}
        style={({ pressed }) => [
          styles.actionBtn,
          { backgroundColor: 'transparent', opacity: pressed || loading ? 0.7 : 1 },
        ]}
        accessibilityLabel={t('docUpload')}
      >
        <Ionicons name="attach-outline" size={20} color={colors.primary} />
      </Pressable>
      <Pressable
        onPress={() => run(pickTeachingImages)}
        disabled={loading}
        style={({ pressed }) => [
          styles.actionBtn,
          { backgroundColor: 'transparent', opacity: pressed || loading ? 0.7 : 1 },
        ]}
        accessibilityLabel={t('docUploadImage')}
      >
        <Ionicons name="image-outline" size={20} color={colors.primary} />
      </Pressable>
    </>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8, marginBottom: 8 },
  chipRow: { gap: 8, paddingVertical: 2 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
  },
  actions: { gap: 8, alignItems: 'center' },
  actionBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
