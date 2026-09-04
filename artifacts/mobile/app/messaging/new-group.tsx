/**
 * Teacher-only custom group creation — a name plus a picked member list, then
 * straight into the new thread. Server-side, POST /messaging/threads/custom
 * re-validates every member is a real contact; this screen's picker only
 * ever offers contacts to begin with, so that check should never fire here
 * in practice, but it's the server's job to not trust that.
 */
import React, { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import { MessagingError, createGroup } from '@/services/messaging';
import { ParticipantPickerSheet } from '@/components/ui/ParticipantPickerSheet';
import { Avatar } from '@/components/ui/Avatar';

interface Picked { userId: string; firstName: string; lastName: string }

export default function NewGroupScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { t, isRTL } = useLanguage();

  const [name, setName] = useState('');
  const [members, setMembers] = useState<Picked[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  const align = isRTL ? 'right' : 'left';
  const topPad = insets.top + (insets.top === 0 ? 12 : 0);

  const handleCreate = async () => {
    const title = name.trim();
    if (!title || members.length === 0 || creating) return;
    setCreating(true);
    setError('');
    try {
      const thread = await createGroup(title, members.map(m => m.userId));
      router.replace(`/messaging/${thread.id}`);
    } catch (e) {
      setError(e instanceof MessagingError ? e.message : t('messagingLoadError'));
    } finally {
      setCreating(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={[styles.header, { paddingTop: topPad, borderBottomColor: colors.border, flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Ionicons name={isRTL ? 'arrow-forward' : 'arrow-back'} size={22} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.foreground, fontFamily: 'Cairo_600SemiBold', flex: 1, textAlign: align }]}>
          {t('messagingNewGroup')}
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder={t('messagingGroupNamePlaceholder')}
          placeholderTextColor={colors.mutedForeground}
          style={[
            styles.nameInput,
            { color: colors.foreground, backgroundColor: colors.card, borderColor: colors.border, fontFamily: 'Cairo_500Medium', textAlign: align },
          ]}
          maxLength={80}
        />

        <View style={{ gap: 8 }}>
          <Text style={[styles.sectionLabel, { color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', textAlign: align }]}>
            {t('messagingMembers')} {members.length > 0 ? `(${members.length})` : ''}
          </Text>

          {members.map(m => (
            <View key={m.userId} style={[styles.memberRow, { borderColor: colors.border, flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
              <Avatar firstName={m.firstName} lastName={m.lastName} size={32} colors={colors} />
              <Text style={{ flex: 1, color: colors.foreground, fontFamily: 'Cairo_500Medium', textAlign: align }} numberOfLines={1}>
                {m.firstName} {m.lastName}
              </Text>
              <Pressable onPress={() => setMembers(prev => prev.filter(x => x.userId !== m.userId))} hitSlop={10}>
                <Ionicons name="close-circle" size={20} color={colors.mutedForeground} />
              </Pressable>
            </View>
          ))}

          <Pressable
            onPress={() => setPickerOpen(true)}
            style={[styles.addMembersBtn, { borderColor: colors.primary, flexDirection: isRTL ? 'row-reverse' : 'row' }]}
          >
            <Ionicons name="person-add-outline" size={18} color={colors.primary} />
            <Text style={{ color: colors.primary, fontFamily: 'Cairo_500Medium' }}>{t('messagingPickMembers')}</Text>
          </Pressable>
        </View>

        {error ? (
          <Text style={{ color: colors.destructive, fontFamily: 'Almarai_400Regular', fontSize: 12, textAlign: align }}>
            {error}
          </Text>
        ) : null}

        <Pressable
          onPress={handleCreate}
          disabled={!name.trim() || members.length === 0 || creating}
          style={[
            styles.createBtn,
            { backgroundColor: name.trim() && members.length > 0 ? colors.primary : colors.muted },
          ]}
        >
          {creating ? (
            <ActivityIndicator color={colors.primaryForeground} />
          ) : (
            <Text style={{ color: name.trim() && members.length > 0 ? colors.primaryForeground : colors.mutedForeground, fontFamily: 'Cairo_600SemiBold' }}>
              {t('messagingCreateGroup')}
            </Text>
          )}
        </Pressable>
      </ScrollView>

      <ParticipantPickerSheet
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        excludeUserIds={members.map(m => m.userId)}
        onConfirm={picked => {
          setMembers(prev => [...prev, ...picked]);
          setPickerOpen(false);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 16, paddingBottom: 12, alignItems: 'center', gap: 10, borderBottomWidth: 1 },
  headerTitle: { fontSize: 17 },
  nameInput: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15 },
  sectionLabel: { fontSize: 13 },
  memberRow: { alignItems: 'center', gap: 10, paddingVertical: 8, paddingHorizontal: 10, borderWidth: 1, borderRadius: 10 },
  addMembersBtn: { alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, borderWidth: 1, borderRadius: 10, borderStyle: 'dashed' },
  createBtn: { alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: 12, marginTop: 8 },
});
