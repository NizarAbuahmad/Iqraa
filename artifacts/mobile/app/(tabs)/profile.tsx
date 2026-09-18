import React, { useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import { isTeacherRole, useAuth } from '@/context/AuthContext';
import { confirm } from '@/services/confirm';
import { pickAvatarPhoto } from '@/services/avatarPick';
import { Toast } from '@/components/ui/Toast';
import { GRADES, SUBJECTS } from '@/services/curriculumData';

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
  const { user, logout, uploadAvatar, removeAvatar } = useAuth();
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [toastMsg, setToastMsg] = useState('');
  const [toastVisible, setToastVisible] = useState(false);
  const showToast = (msg: string) => { setToastMsg(msg); setToastVisible(true); };

  const topPad = insets.top + (insets.top === 0 ? 67 : 0);

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

  const handleChangePhoto = () => {
    void (async () => {
      const dataUrl = await pickAvatarPhoto();
      if (!dataUrl) return;
      setAvatarBusy(true);
      try {
        await uploadAvatar(dataUrl);
      } catch (err) {
        showToast(err instanceof Error ? err.message : t('photoUpdateFailed'));
      } finally {
        setAvatarBusy(false);
      }
    })();
  };

  const handleRemovePhoto = () => {
    void (async () => {
      const ok = await confirm({
        title: t('removePhotoConfirm'),
        confirmLabel: t('removePhoto'),
        cancelLabel: t('cancel'),
        destructive: true,
      });
      if (!ok) return;
      setAvatarBusy(true);
      try {
        await removeAvatar();
      } catch (err) {
        showToast(err instanceof Error ? err.message : t('photoRemoveFailed'));
      } finally {
        setAvatarBusy(false);
      }
    })();
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

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ paddingBottom: 120 }}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={[styles.headerBg, { backgroundColor: colors.primary, paddingTop: topPad + 16 }]}>
        <View style={styles.avatarWrap}>
          <View>
            <Pressable
              onPress={handleChangePhoto}
              disabled={avatarBusy}
              style={({ pressed }) => [
                styles.avatar,
                { backgroundColor: 'rgba(255,255,255,0.25)', opacity: pressed ? 0.85 : 1 },
              ]}
            >
              {user?.avatarUrl ? (
                <Image source={{ uri: user.avatarUrl }} style={styles.avatarPhoto} />
              ) : (
                <Text style={[styles.initials, { color: colors.primaryForeground, fontFamily: 'Cairo_700Bold' }]}>
                  {initials}
                </Text>
              )}
              {avatarBusy ? (
                <View style={styles.avatarBusyOverlay}>
                  <ActivityIndicator color={colors.primaryForeground} />
                </View>
              ) : null}
            </Pressable>
            {/* Outside the Pressable: it clips to a circle, so a badge inside it
                loses its outer edge to the radius. */}
            {avatarBusy ? null : (
              <Pressable
                onPress={handleChangePhoto}
                style={[
                  styles.avatarEditBadge,
                  { backgroundColor: colors.primaryForeground, borderColor: colors.primary },
                ]}
              >
                <Ionicons name="camera" size={14} color={colors.primary} />
              </Pressable>
            )}
            {user?.avatarUrl && !avatarBusy ? (
              <Pressable
                onPress={handleRemovePhoto}
                style={[styles.avatarRemoveBadge, { backgroundColor: colors.destructive }]}
              >
                <Ionicons name="close" size={12} color={colors.primaryForeground} />
              </Pressable>
            ) : null}
          </View>
          <Text style={[styles.userName, { color: colors.primaryForeground, fontFamily: 'Cairo_700Bold' }]}>
            {user ? `${user.firstName} ${user.lastName}` : t('roleTeacher')}
          </Text>
          <View style={[styles.roleBadge, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
            <Text style={[styles.roleText, { color: colors.primaryForeground, fontFamily: 'Cairo_500Medium' }]}>
              {roleLabel}
            </Text>
          </View>
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

        {/* Subjects & Grades — the ids picked on /setup-subjects, resolved
            against the same catalog the curriculum browser reads. Teacher-only:
            no other role is ever asked to pick these (see needsTeacherSetup). */}
        {isTeacherRole(user?.role) ? (
          <>
            <Text style={[styles.section, { color: colors.mutedForeground, fontFamily: 'Cairo_500Medium', marginTop: 20, textAlign: isRTL ? 'right' : 'left' }]}>
              {t('teaching')}
            </Text>
            <Pressable
              onPress={() => router.push({ pathname: '/setup-subjects', params: { mode: 'edit' } } as any)}
              style={({ pressed }) => [styles.infoCard, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius, opacity: pressed ? 0.85 : 1 }]}
            >
              {(user?.subjectIds?.length ?? 0) > 0 ? (
                <View style={styles.tagSection}>
                  <Text style={[styles.tagLabel, { color: colors.foreground, fontFamily: 'Cairo_500Medium', textAlign: isRTL ? 'right' : 'left' }]}>{t('mySubjects')}</Text>
                  <View style={[styles.tags, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                    {user?.subjectIds?.map(id => {
                      const subject = SUBJECTS.find(s => s.id === id);
                      return (
                        <View key={id} style={[styles.tag, { backgroundColor: colors.secondary }]}>
                          <Text style={[styles.tagText, { color: colors.primary, fontFamily: 'Cairo_500Medium' }]}>
                            {subject ? (isRTL ? subject.nameAr : subject.name) : id}
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                </View>
              ) : null}
              {(user?.gradeIds?.length ?? 0) > 0 ? (
                <View style={styles.tagSection}>
                  <Text style={[styles.tagLabel, { color: colors.foreground, fontFamily: 'Cairo_500Medium', textAlign: isRTL ? 'right' : 'left' }]}>{t('myGrades')}</Text>
                  <View style={[styles.tags, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                    {user?.gradeIds?.map(id => {
                      const grade = GRADES.find(g => g.id === id);
                      return (
                        <View key={id} style={[styles.tag, { backgroundColor: colors.muted }]}>
                          <Text style={[styles.tagText, { color: colors.mutedForeground, fontFamily: 'Cairo_500Medium' }]}>
                            {grade ? (isRTL ? grade.nameAr : grade.name) : id}
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                </View>
              ) : null}
              <View style={[styles.tagSection, { flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 6, marginBottom: 0 }]}>
                <Ionicons name="create-outline" size={14} color={colors.primary} />
                <Text style={[styles.tagLabel, { color: colors.primary, fontFamily: 'Cairo_500Medium', marginBottom: 0 }]}>
                  {t('editTeachingTitle')}
                </Text>
              </View>
            </Pressable>
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
    <Toast visible={toastVisible} message={toastMsg} onHide={() => setToastVisible(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  headerBg: { paddingBottom: 32, alignItems: 'center' },
  avatarWrap: { alignItems: 'center', gap: 8 },
  avatar: { width: 88, height: 88, borderRadius: 44, alignItems: 'center', justifyContent: 'center', marginBottom: 4, overflow: 'hidden' },
  avatarPhoto: { width: 88, height: 88, borderRadius: 44 },
  avatarBusyOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.35)',
  },
  // `right`, deliberately physical — do not "fix" these to `start`/`end`.
  // Direction is not stable here to resolve them against: the deployed HTML
  // ships `dir="rtl"` from `scripts/inject-pwa.mjs`, and `LanguageContext`
  // pins the document back to LTR about 400ms after load, on purpose (read the
  // comment there before touching either side). A logical offset therefore
  // resolves one way during that window and the other way after, and lands on
  // opposite sides on web and native besides. `start` was tried on 2026-09-15
  // and put both badges on the wrong side of the avatar in production. The app
  // expresses direction per component rather than trusting the document —
  // ~190 `flexDirection: isRTL ? …` call sites — and physical values are that
  // convention.
  //
  // The offsets sit the edit badge across the circle's rim rather than inside
  // it, where the parent's `overflow: hidden` clips its outer edge into a
  // semicircle; the ring keeps it legible on a photo of any colour.
  avatarEditBadge: {
    position: 'absolute', bottom: 2, right: -2, width: 28, height: 28, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center', borderWidth: 2,
  },
  avatarRemoveBadge: {
    position: 'absolute', top: 0, right: 0, width: 22, height: 22, borderRadius: 11,
    alignItems: 'center', justifyContent: 'center',
  },
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
