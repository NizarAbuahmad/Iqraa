import React, { useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import { useAuth } from '@/context/AuthContext';
import { confirm } from '@/services/confirm';
import { Toast } from '@/components/ui/Toast';
import { ApiError } from '@/services/apiClient';
import { pickProfilePhoto } from '@/services/profilePhoto';

function InfoRow({ icon, label, value, color, isRTL }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string; color: string; isRTL: boolean }) {
  const colors = useColors();
  return (
    <View style={[styles.infoRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
      <View style={[styles.infoIcon, { backgroundColor: color + '18' }]}>
        <Ionicons name={icon} size={16} color={color} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.infoLabel, { color: colors.mutedForeground, textAlign: isRTL ? 'right' : 'left' }]}>{label}</Text>
        <Text style={[styles.infoValue, { color: colors.foreground, textAlign: isRTL ? 'right' : 'left' }]}>{value || '—'}</Text>
      </View>
    </View>
  );
}

function SettingRow({ icon, label, onPress, destructive, isRTL, colors }: {
  icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void;
  destructive?: boolean; isRTL: boolean; colors: ReturnType<typeof useColors>;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.settingRow,
        { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius, opacity: pressed ? 0.7 : 1, flexDirection: isRTL ? 'row-reverse' : 'row' },
      ]}
    >
      <Ionicons name={icon} size={20} color={destructive ? colors.destructive : colors.primary} />
      <Text style={[styles.settingLabel, { color: destructive ? colors.destructive : colors.foreground, fontFamily: 'Cairo_500Medium', flex: 1, textAlign: isRTL ? 'right' : 'left' }]}>
        {label}
      </Text>
      {!destructive && <Ionicons name={isRTL ? 'chevron-back' : 'chevron-forward'} size={16} color={colors.mutedForeground} />}
    </Pressable>
  );
}

export default function ProfileScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { t, isRTL } = useLanguage();
  const { user, logout, updateAvatar, removeAvatar } = useAuth();

  const [photoBusy, setPhotoBusy] = useState(false);
  // The URL that failed, not a boolean: a new picture produces a new signed
  // URL, and a flag would keep showing initials for it because the *previous*
  // one had expired.
  const [failedAvatarUrl, setFailedAvatarUrl] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState('');
  const [toastVisible, setToastVisible] = useState(false);
  const showToast = (msg: string) => { setToastMsg(msg); setToastVisible(true); };

  const topPad = insets.top + (insets.top === 0 ? 67 : 0);

  const avatarUrl = user?.avatarUrl && user.avatarUrl !== failedAvatarUrl ? user.avatarUrl : null;

  const initials = user
    ? [user.firstName?.[0], user.lastName?.[0]]
        .filter(Boolean)
        .map(c => c!.toUpperCase())
        .join('') || 'T'
    : 'T';

  const roleLabel =
    user?.role === 'school_admin'
      ? t('roleAdmin')
      : user?.role === 'system_admin'
        ? t('roleSysAdmin')
        : user?.role === 'parent'
          ? t('roleParent')
          : user?.role === 'student'
            ? t('roleStudent')
            : t('roleTeacher');

  const memberSince = user?.createdAt
    ? new Date(user.createdAt).toLocaleDateString(isRTL ? 'ar-JO' : 'en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : '';

  const performLogout = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    await logout();
    router.replace('/(auth)/login');
  };

  const handleLogout = () => {
    // Only the question is passed, not a title as well. `signOut` ("تسجيل
    // الخروج") and `signOutConfirm` ("هل تريد تسجيل الخروج؟") say the same
    // thing, so sending both printed the request twice — once as a heading and
    // again as the body — above a dialog that already names the site. The
    // action lives on the confirm button instead, where it also replaces a
    // bare "OK".
    void (async () => {
      const ok = await confirm({
        title: t('signOutConfirm'),
        confirmLabel: t('signOut'),
        cancelLabel: t('cancel'),
        destructive: true,
      });
      if (ok) await performLogout();
    })();
  };

  /**
   * The server's refusal, in the teacher's language. Keyed on `code` and not
   * on the message: the API answers in English, and this screen is the
   * product's primary-language one.
   */
  const photoErrorMessage = (err: unknown): string => {
    const code = err instanceof ApiError ? err.code : undefined;
    if (code === 'avatar_unavailable') return t('photoUnavailable');
    if (code === 'file_too_large') return t('photoTooLarge');
    if (code === 'unsupported_type') return t('photoUnsupported');
    return t('photoFailed');
  };

  const handleChangePhoto = () => {
    if (photoBusy) return;
    void (async () => {
      const picked = await pickProfilePhoto();
      if (!picked.ok) {
        // A cancel is deliberate and gets no message. The other two are
        // things the teacher did not choose and cannot otherwise see.
        if (picked.reason === 'permission') showToast(t('photoPermissionNeeded'));
        if (picked.reason === 'unsupported') showToast(t('photoUnsupported'));
        return;
      }
      setPhotoBusy(true);
      try {
        await updateAvatar(picked.dataUrl);
        setFailedAvatarUrl(null);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch (err) {
        showToast(photoErrorMessage(err));
      } finally {
        setPhotoBusy(false);
      }
    })();
  };

  const handleRemovePhoto = () => {
    if (photoBusy) return;
    void (async () => {
      const ok = await confirm({
        title: t('removePhotoConfirm'),
        confirmLabel: t('removePhoto'),
        cancelLabel: t('cancel'),
        destructive: true,
      });
      if (!ok) return;
      setPhotoBusy(true);
      try {
        await removeAvatar();
        setFailedAvatarUrl(null);
      } catch (err) {
        showToast(photoErrorMessage(err));
      } finally {
        setPhotoBusy(false);
      }
    })();
  };

  return (
    // The ScrollView used to be the root. Toast positions itself absolutely
    // against its parent, and inside a scroll view that parent is the *content*
    // — a message would have been pinned to a point in the page and scrolled
    // away with it.
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.background }}
        contentContainerStyle={{ paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={[styles.headerBg, { backgroundColor: colors.primary, paddingTop: topPad + 16 }]}>
          <View style={styles.avatarWrap}>
            <Pressable
              onPress={handleChangePhoto}
              disabled={photoBusy}
              accessibilityRole="button"
              accessibilityLabel={avatarUrl ? t('changePhoto') : t('choosePhoto')}
              style={({ pressed }) => [styles.avatarPress, { opacity: pressed ? 0.85 : 1 }]}
            >
              <View style={[styles.avatar, { backgroundColor: 'rgba(255,255,255,0.25)' }]}>
                {avatarUrl ? (
                  <Image
                    source={{ uri: avatarUrl }}
                    style={styles.avatarImage}
                    // A signed URL expires in about an hour (lib/r2.ts). When one
                    // does, fall back to the initials rather than the blank
                    // circle a failed <Image> otherwise leaves behind.
                    onError={() => setFailedAvatarUrl(user?.avatarUrl ?? null)}
                  />
                ) : (
                  <Text style={[styles.initials, { color: colors.primaryForeground, fontFamily: 'Cairo_700Bold' }]}>
                    {initials}
                  </Text>
                )}
                {photoBusy ? (
                  <View style={[styles.avatarBusy, { backgroundColor: 'rgba(0,0,0,0.35)' }]}>
                    <ActivityIndicator color={colors.primaryForeground} />
                  </View>
                ) : null}
              </View>
              {/* The affordance. Without it the picture is just a picture and
                  nothing on this screen says it can be changed. */}
              <View
                style={[
                  styles.cameraBadge,
                  { backgroundColor: colors.card, borderColor: colors.primary },
                  isRTL ? { left: 0 } : { right: 0 },
                ]}
              >
                <Ionicons name="camera" size={14} color={colors.primary} />
              </View>
            </Pressable>
            <Text style={[styles.userName, { color: colors.primaryForeground, fontFamily: 'Cairo_700Bold' }]}>
              {user ? `${user.firstName} ${user.lastName}` : t('roleTeacher')}
            </Text>
            <View style={[styles.roleBadge, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
              <Text style={[styles.roleText, { color: colors.primaryForeground, fontFamily: 'Cairo_500Medium' }]}>
                {roleLabel}
              </Text>
            </View>
            {/* Only offered once there is something to remove — `confirm` is a
                two-button dialog, so "change or remove?" cannot be one tap. */}
            {user?.avatarUrl ? (
              <Pressable onPress={handleRemovePhoto} disabled={photoBusy} accessibilityRole="button">
                <Text style={[styles.removePhoto, { color: colors.primaryForeground, fontFamily: 'Cairo_500Medium' }]}>
                  {t('removePhoto')}
                </Text>
              </Pressable>
            ) : null}
          </View>
        </View>

        <View style={{ paddingHorizontal: 20, paddingTop: 24 }}>
          {/* Info card */}
          <Text style={[styles.section, { color: colors.mutedForeground, fontFamily: 'Cairo_500Medium', textAlign: isRTL ? 'right' : 'left' }]}>
            {t('profileInfo')}
          </Text>
          <View style={[styles.infoCard, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
            <InfoRow icon="mail-outline" label={t('email')} value={user?.email ?? ''} color={colors.primary} isRTL={isRTL} />
            {memberSince ? (
              <>
                <View style={[styles.divider, { backgroundColor: colors.border }]} />
                <InfoRow icon="calendar-outline" label={t('memberSince')} value={memberSince} color={colors.info} isRTL={isRTL} />
              </>
            ) : null}
            {user?.phone ? (
              <>
                <View style={[styles.divider, { backgroundColor: colors.border }]} />
                <InfoRow icon="call-outline" label={t('phone')} value={user.phone} color={colors.info} isRTL={isRTL} />
              </>
            ) : null}
            {user?.school ? (
              <>
                <View style={[styles.divider, { backgroundColor: colors.border }]} />
                <InfoRow icon="business-outline" label={t('school')} value={user.school} color={colors.accent} isRTL={isRTL} />
              </>
            ) : null}
          </View>

          {/* Subjects & Grades — only show if populated */}
          {((user?.subjects?.length ?? 0) > 0 || (user?.grades?.length ?? 0) > 0) ? (
            <>
              <Text style={[styles.section, { color: colors.mutedForeground, fontFamily: 'Cairo_500Medium', marginTop: 20, textAlign: isRTL ? 'right' : 'left' }]}>
                {t('teaching')}
              </Text>
              <View style={[styles.infoCard, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
                {(user?.subjects?.length ?? 0) > 0 ? (
                  <View style={styles.tagSection}>
                    <Text style={[styles.tagLabel, { color: colors.foreground, fontFamily: 'Cairo_500Medium', textAlign: isRTL ? 'right' : 'left' }]}>{t('mySubjects')}</Text>
                    <View style={[styles.tags, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                      {user?.subjects?.map(s => (
                        <View key={s} style={[styles.tag, { backgroundColor: colors.secondary }]}>
                          <Text style={[styles.tagText, { color: colors.primary, fontFamily: 'Cairo_500Medium' }]}>{s}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                ) : null}
                {(user?.grades?.length ?? 0) > 0 ? (
                  <View style={styles.tagSection}>
                    <Text style={[styles.tagLabel, { color: colors.foreground, fontFamily: 'Cairo_500Medium', textAlign: isRTL ? 'right' : 'left' }]}>{t('myGrades')}</Text>
                    <View style={[styles.tags, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                      {user?.grades?.map(g => (
                        <View key={g} style={[styles.tag, { backgroundColor: colors.muted }]}>
                          <Text style={[styles.tagText, { color: colors.mutedForeground, fontFamily: 'Cairo_500Medium' }]}>{g}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                ) : null}
              </View>
            </>
          ) : null}

          {/* Settings */}
          <Text style={[styles.section, { color: colors.mutedForeground, fontFamily: 'Cairo_500Medium', marginTop: 20, textAlign: isRTL ? 'right' : 'left' }]}>
            {t('settingsSection')}
          </Text>
          <View style={{ gap: 8 }}>
            <SettingRow icon="folder-outline" label={t('myWorkspace')} onPress={() => router.push('/workspace')} isRTL={isRTL} colors={colors} />
            <SettingRow icon="people-outline" label={t('myClasses')} onPress={() => router.push('/classes')} isRTL={isRTL} colors={colors} />
            {(user?.role === 'parent' || user?.role === 'student') && (
              <SettingRow
                icon="key-outline"
                label={t('joinAnotherClass')}
                onPress={() => router.push('/join-class' as any)}
                isRTL={isRTL}
                colors={colors}
              />
            )}
            {(user?.role === 'school_admin' || user?.role === 'system_admin') && (
              <SettingRow
                icon="bar-chart-outline"
                label={isRTL ? 'لوحة الإدارة' : 'Admin dashboard'}
                onPress={() => router.push('/admin/dashboard' as any)}
                isRTL={isRTL}
                colors={colors}
              />
            )}
            <SettingRow icon="settings-outline" label={t('settings')} onPress={() => router.push('/settings')} isRTL={isRTL} colors={colors} />
            <SettingRow
              icon="help-circle-outline"
              label={t('faqTitle')}
              onPress={() => router.push('/faq')}
              isRTL={isRTL}
              colors={colors}
            />
            <SettingRow icon="log-out-outline" label={t('signOut')} onPress={handleLogout} destructive isRTL={isRTL} colors={colors} />
          </View>
        </View>
      </ScrollView>
      <Toast
        visible={toastVisible}
        message={toastMsg}
        // Longer than the 2s default: these are refusals to read and act on,
        // not "saved" confirmations.
        duration={3500}
        onHide={() => setToastVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  headerBg: { paddingBottom: 32, alignItems: 'center' },
  avatarWrap: { alignItems: 'center', gap: 8 },
  avatarPress: { marginBottom: 4 },
  avatar: { width: 88, height: 88, borderRadius: 44, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatarImage: { width: 88, height: 88, borderRadius: 44 },
  avatarBusy: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  cameraBadge: {
    position: 'absolute',
    bottom: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removePhoto: { fontSize: 12, textDecorationLine: 'underline', opacity: 0.9, marginTop: 2 },
  initials: { fontSize: 34 },
  userName: { fontSize: 22 },
  roleBadge: { paddingHorizontal: 14, paddingVertical: 5, borderRadius: 20, marginTop: 2 },
  roleText: { fontSize: 12 },
  section: { fontSize: 11, letterSpacing: 0.8, marginBottom: 8 },
  infoCard: { borderWidth: 1, overflow: 'hidden' },
  infoRow: { alignItems: 'center', padding: 14, gap: 12 },
  infoIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  infoLabel: { fontSize: 11, marginBottom: 2, fontFamily: 'Almarai_400Regular' },
  infoValue: { fontSize: 14, fontFamily: 'Almarai_400Regular' },
  divider: { height: 1, marginHorizontal: 14 },
  tagSection: { padding: 14, gap: 8 },
  tagLabel: { fontSize: 13 },
  tags: { flexWrap: 'wrap', gap: 6 },
  tag: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  tagText: { fontSize: 12 },
  settingRow: { alignItems: 'center', padding: 16, gap: 12, borderWidth: 1 },
  settingLabel: { fontSize: 15 },
});
