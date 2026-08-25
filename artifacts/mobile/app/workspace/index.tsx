import React, { useCallback, useState } from 'react';
import {
  FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { confirm } from '@/services/confirm';
import { listClasses, type ClassGroup } from '@/services/roster';
import { classNameFor } from '@/services/materialClass';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import {
  MaterialType, SavedMaterial,
  deleteItem, duplicateItem, getItems, toggleFavorite,
} from '@/services/workspace';
import {
  MATERIAL_COLOR,
  MATERIAL_EDIT_ROUTE,
  MATERIAL_ICON,
  MATERIAL_LABEL_KEY,
} from '@/constants/materialKind';

const TABS: Array<{ key: MaterialType | 'all'; labelKey: string }> = [
  { key: 'all', labelKey: 'allFilter' },
  { key: 'lesson', labelKey: 'myLessons' },
  { key: 'worksheet', labelKey: 'myWorksheets' },
  { key: 'quiz', labelKey: 'myQuizzes' },
];

export default function WorkspaceScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { t, isRTL, lang } = useLanguage();
  const topPad = insets.top + (insets.top === 0 ? 67 : 0);

  const [items, setItems] = useState<SavedMaterial[]>([]);
  const [activeTab, setActiveTab] = useState<MaterialType | 'all'>('all');
  const [query, setQuery] = useState('');
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [menuItem, setMenuItem] = useState<SavedMaterial | null>(null);
  /**
   * The roster, only so a card can name the class it belongs to. Loaded once
   * per focus rather than per card: `classGroupId` is stored on the material,
   * but a teacher reads class names, not ids — and a class deleted since
   * resolves to no class rather than a name that is gone.
   */
  const [classes, setClasses] = useState<ClassGroup[]>([]);

  const reload = useCallback(async () => {
    const type = activeTab === 'all' ? undefined : activeTab;
    const loaded = await getItems({ type, query, favoritesFirst: favoritesOnly });
    if (favoritesOnly) {
      setItems(loaded.filter(i => i.isFavorite));
    } else {
      setItems(loaded);
    }
  }, [activeTab, query, favoritesOnly]);

  useFocusEffect(
    useCallback(() => {
      reload();
      // Server-only, so offline this stays empty and the cards simply show no
      // class — never a wrong one.
      // `?? []` because listClasses returns `data.classes` unchecked: a
      // malformed body lands here as undefined and the cards read it directly.
      void listClasses().then(cs => setClasses(cs ?? [])).catch(() => setClasses([]));
    }, [reload]),
  );

  // The list re-reads the store afterwards, so the star here always shows what
  // persisted rather than what was intended. Passing `next` explicitly is what
  // keeps a fast double-tap from racing itself: the read-then-flip form asked
  // the server for the current value, and two taps could both read "off".
  const handleToggleFavorite = async (item: SavedMaterial) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await toggleFavorite(item.id, !item.isFavorite);
    reload();
  };

  const handleDelete = async (item: SavedMaterial) => {
    const ok = await confirm({
      title: t('deleteConfirmTitle'),
      message: t('deleteConfirmMsg'),
      confirmLabel: t('deleteItem'),
      cancelLabel: t('cancel'),
      destructive: true,
    });
    if (!ok) return;
    await deleteItem(item.id);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    reload();
  };

  const handleDuplicate = async (id: string) => {
    await duplicateItem(id);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    reload();
  };

  /**
   * The row menu's actions.
   *
   * This used to be an `Alert.alert` with five buttons, which meant the "..."
   * button did nothing at all in the browser — `Alert.alert`'s handlers never
   * fire on react-native web, the same defect `services/confirm.ts` was written
   * for. Teachers are demoed on the web build, so Open, Edit, Duplicate and
   * Delete were all dead there while looking fine on a phone.
   */
  const menuActions = (item: SavedMaterial) => {
    // A chain of ternaries ending in `: '/ai-tools/quiz'` sent activities and
    // decks to the quiz builder, which cannot rebuild either. Kinds with no
    // form-driven editor simply do not offer Edit.
    const editRoute = MATERIAL_EDIT_ROUTE[item.type];
    return [
      {
        key: 'open',
        icon: 'open-outline' as const,
        label: t('openItem'),
        run: () => router.push({ pathname: '/workspace/view', params: { id: item.id } }),
      },
      ...(editRoute
        ? [{
          key: 'edit',
          icon: 'create-outline' as const,
          label: t('editItem'),
          run: () =>
            router.push({
              pathname: editRoute as any,
              params: { savedId: item.id, ...item.formState },
            }),
        }]
        : []),
      {
        key: 'duplicate',
        icon: 'copy-outline' as const,
        label: t('duplicateItem'),
        run: () => { void handleDuplicate(item.id); },
      },
      {
        key: 'delete',
        icon: 'trash-outline' as const,
        label: t('deleteItem'),
        destructive: true,
        run: () => { void handleDelete(item); },
      },
    ];
  };

  const formatDate = (iso: string) => {
    try {
      const d = new Date(iso);
      if (lang === 'ar') {
        return d.toLocaleDateString('ar-JO', { day: 'numeric', month: 'short', year: 'numeric' });
      }
      return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    } catch {
      return iso.slice(0, 10);
    }
  };

  const typeLabel = (type: MaterialType) => t(MATERIAL_LABEL_KEY[type]);

  const renderItem = ({ item }: { item: SavedMaterial }) => {
    const color = MATERIAL_COLOR[item.type];
    const icon = MATERIAL_ICON[item.type];
    const classLabel = classNameFor(classes, item.classGroupId, lang as 'ar' | 'en');
    return (
      <Pressable
        onPress={() => router.push({ pathname: '/workspace/view', params: { id: item.id } })}
        style={({ pressed }) => [
          styles.card,
          {
            backgroundColor: colors.card,
            borderColor: colors.border,
            borderRadius: colors.radius,
            opacity: pressed ? 0.8 : 1,
            flexDirection: isRTL ? 'row-reverse' : 'row',
          },
        ]}
      >
        {/* Icon */}
        <View style={[styles.cardIcon, { backgroundColor: color + '18', borderRadius: 14 }]}>
          <Ionicons name={icon} size={22} color={color} />
        </View>

        {/* Body */}
        <View style={{ flex: 1 }}>
          <Text
            style={[styles.cardTitle, { color: colors.foreground, fontFamily: 'Cairo_600SemiBold', textAlign: isRTL ? 'right' : 'left' }]}
            numberOfLines={2}
          >
            {item.title}
          </Text>
          <View style={[styles.cardMeta, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
            <View style={[styles.typePill, { backgroundColor: color + '18', borderRadius: 8 }]}>
              <Text style={[styles.typeText, { color, fontFamily: 'Cairo_500Medium' }]}>
                {typeLabel(item.type)}
              </Text>
            </View>
            <Text style={[styles.metaText, { color: colors.mutedForeground, fontFamily: 'Almarai_400Regular' }]}>
              {item.grade}
            </Text>
            {/* Which class it is filed under. Absent rather than "no class":
                an unfiled material is the normal case and does not need a
                label saying so on every card. */}
            {classLabel ? (
              <View style={[styles.classPill, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                <Ionicons name="people-outline" size={11} color={colors.mutedForeground} />
                <Text
                  style={[styles.metaText, { color: colors.mutedForeground, fontFamily: 'Almarai_400Regular' }]}
                  numberOfLines={1}
                >
                  {classLabel}
                </Text>
              </View>
            ) : null}
          </View>
          <Text style={[styles.metaText, { color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', textAlign: isRTL ? 'right' : 'left', marginTop: 2 }]}>
            {t('savedAt')} {formatDate(item.savedAt)}
          </Text>
        </View>

        {/* Actions */}
        <View style={[styles.cardActions, { alignItems: isRTL ? 'flex-start' : 'flex-end' }]}>
          <Pressable
            onPress={() => handleToggleFavorite(item)}
            hitSlop={8}
            style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
          >
            <Ionicons
              name={item.isFavorite ? 'star' : 'star-outline'}
              size={20}
              color={item.isFavorite ? '#F59E0B' : colors.mutedForeground}
            />
          </Pressable>
          <Pressable
            onPress={() => setMenuItem(item)}
            hitSlop={8}
            style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1, marginTop: 12 })}
          >
            <Ionicons name="ellipsis-horizontal" size={20} color={colors.mutedForeground} />
          </Pressable>
        </View>
      </Pressable>
    );
  };

  const filtered = items; // already filtered by getItems

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 12, backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <Pressable
          onPress={() => router.back()}
          style={[styles.backBtn, { alignSelf: isRTL ? 'flex-end' : 'flex-start' }]}
        >
          <Ionicons name={isRTL ? 'arrow-forward' : 'arrow-back'} size={22} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.foreground, fontFamily: 'Cairo_700Bold', textAlign: isRTL ? 'right' : 'left' }]}>
          {t('myWorkspace')}
        </Text>
        <Text style={[styles.headerSub, { color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', textAlign: isRTL ? 'right' : 'left' }]}>
          {t('workspaceSubtitle')}
        </Text>

        {/* Search */}
        <View style={[styles.searchRow, { backgroundColor: colors.muted, borderRadius: 12, flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
          <Ionicons name="search-outline" size={16} color={colors.mutedForeground} />
          <TextInput
            style={[styles.searchInput, { color: colors.foreground, fontFamily: 'Almarai_400Regular', textAlign: isRTL ? 'right' : 'left' }]}
            placeholder={t('searchWorkspace')}
            placeholderTextColor={colors.mutedForeground}
            value={query}
            onChangeText={q => { setQuery(q); }}
            onEndEditing={() => reload()}
            returnKeyType="search"
            onSubmitEditing={() => reload()}
          />
          {query.length > 0 && (
            <Pressable onPress={() => { setQuery(''); }}>
              <Ionicons name="close-circle" size={16} color={colors.mutedForeground} />
            </Pressable>
          )}
        </View>

        {/* Tabs */}
        <View style={[styles.tabs, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
          {TABS.map(tab => (
            <Pressable
              key={tab.key}
              onPress={() => setActiveTab(tab.key as any)}
              style={[
                styles.tab,
                {
                  borderBottomWidth: activeTab === tab.key ? 2 : 0,
                  borderBottomColor: colors.primary,
                },
              ]}
            >
              <Text style={[
                styles.tabText,
                {
                  color: activeTab === tab.key ? colors.primary : colors.mutedForeground,
                  fontFamily: activeTab === tab.key ? 'Cairo_600SemiBold' : 'Almarai_400Regular',
                },
              ]}>
                {t(tab.labelKey as any)}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* Favorites toggle */}
      <View style={[styles.filterRow, { flexDirection: isRTL ? 'row-reverse' : 'row', borderBottomColor: colors.border }]}>
        <Pressable
          onPress={() => setFavoritesOnly(v => !v)}
          style={[
            styles.filterBtn,
            {
              backgroundColor: favoritesOnly ? '#F59E0B' + '22' : colors.muted,
              borderRadius: 20,
              flexDirection: isRTL ? 'row-reverse' : 'row',
            },
          ]}
        >
          <Ionicons name={favoritesOnly ? 'star' : 'star-outline'} size={14} color={favoritesOnly ? '#F59E0B' : colors.mutedForeground} />
          <Text style={[styles.filterText, { color: favoritesOnly ? '#F59E0B' : colors.mutedForeground, fontFamily: 'Cairo_500Medium' }]}>
            {t('favoritesFilter')}
          </Text>
        </Pressable>
        <Text style={[styles.countText, { color: colors.mutedForeground, fontFamily: 'Almarai_400Regular' }]}>
          {filtered.length} {lang === 'ar' ? 'مادة' : filtered.length === 1 ? 'item' : 'items'}
        </Text>
      </View>

      {/* List */}
      <FlatList
        data={filtered}
        keyExtractor={item => item.id}
        renderItem={renderItem}
        contentContainerStyle={{ padding: 16, paddingBottom: 100, gap: 10 }}
        showsVerticalScrollIndicator={false}
        onRefresh={reload}
        refreshing={false}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="folder-open-outline" size={64} color={colors.mutedForeground} style={{ opacity: 0.4 }} />
            <Text style={[styles.emptyTitle, { color: colors.foreground, fontFamily: 'Cairo_600SemiBold', textAlign: 'center' }]}>
              {t('noSavedItems')}
            </Text>
            <Text style={[styles.emptyDesc, { color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', textAlign: 'center' }]}>
              {t('noSavedItemsDesc')}
            </Text>
            <Pressable
              onPress={() => router.push('/(tabs)/ai-tools')}
              style={[styles.emptyBtn, { backgroundColor: colors.primary, borderRadius: colors.radius }]}
            >
              <Text style={[{ color: colors.primaryForeground, fontFamily: 'Cairo_600SemiBold', fontSize: 14 }]}>
                {t('aiTools')}
              </Text>
            </Pressable>
          </View>
        }
      />

      <Modal
        visible={menuItem !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuItem(null)}
      >
        <Pressable style={styles.menuBackdrop} onPress={() => setMenuItem(null)}>
          <Pressable
            style={[styles.menuCard, { backgroundColor: colors.card }]}
            onPress={e => e.stopPropagation()}
          >
            <Text
              style={[
                styles.menuTitle,
                {
                  color: colors.foreground,
                  fontFamily: 'Cairo_600SemiBold',
                  textAlign: isRTL ? 'right' : 'left',
                },
              ]}
              numberOfLines={2}
            >
              {menuItem?.title}
            </Text>
            {(menuItem ? menuActions(menuItem) : []).map(action => (
              <Pressable
                key={action.key}
                onPress={() => {
                  // Close first: Edit and Open navigate away, and a modal still
                  // mounted over the new screen is how a dialog gets stuck.
                  setMenuItem(null);
                  action.run();
                }}
                style={[
                  styles.menuRow,
                  { borderColor: colors.border, flexDirection: isRTL ? 'row-reverse' : 'row' },
                ]}
              >
                <Ionicons
                  name={action.icon}
                  size={18}
                  color={action.destructive ? colors.destructive : colors.primary}
                />
                <Text
                  style={{
                    color: action.destructive ? colors.destructive : colors.foreground,
                    fontFamily: 'Cairo_500Medium',
                    flex: 1,
                    textAlign: isRTL ? 'right' : 'left',
                  }}
                >
                  {action.label}
                </Text>
              </Pressable>
            ))}
            <Pressable onPress={() => setMenuItem(null)} style={styles.menuCancel}>
              <Text style={{ color: colors.mutedForeground, fontFamily: 'Cairo_600SemiBold' }}>
                {t('cancel')}
              </Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  menuBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  menuCard: { width: '100%', maxWidth: 400, borderRadius: 16, padding: 20, gap: 8 },
  menuTitle: { fontSize: 16, marginBottom: 4 },
  menuRow: {
    alignItems: 'center',
    gap: 12,
    paddingVertical: 13,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
  },
  menuCancel: { alignSelf: 'flex-end', paddingHorizontal: 14, paddingVertical: 10, marginTop: 4 },
  header: { paddingHorizontal: 20, paddingBottom: 0, borderBottomWidth: 1 },
  backBtn: { width: 40, height: 40, justifyContent: 'center', marginBottom: 4 },
  headerTitle: { fontSize: 26, marginBottom: 2 },
  headerSub: { fontSize: 13, marginBottom: 14 },
  searchRow: { alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 14 },
  searchInput: { flex: 1, fontSize: 14, padding: 0 },
  tabs: { gap: 0 },
  tab: { paddingHorizontal: 4, paddingVertical: 10, marginRight: 20 },
  tabText: { fontSize: 13 },
  filterRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1 },
  filterBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 6 },
  filterText: { fontSize: 12 },
  countText: { fontSize: 12 },
  card: { padding: 14, borderWidth: 1, gap: 12, alignItems: 'flex-start' },
  cardIcon: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  cardTitle: { fontSize: 14, marginBottom: 6, lineHeight: 20 },
  cardMeta: { alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  classPill: { alignItems: 'center', gap: 3 },
  typePill: { paddingHorizontal: 8, paddingVertical: 2 },
  typeText: { fontSize: 11 },
  metaText: { fontSize: 11 },
  cardActions: { justifyContent: 'flex-start', flexShrink: 0 },
  empty: { alignItems: 'center', paddingTop: 60, gap: 12, paddingHorizontal: 20 },
  emptyTitle: { fontSize: 18, marginTop: 8 },
  emptyDesc: { fontSize: 13, lineHeight: 20, maxWidth: 280 },
  emptyBtn: { paddingHorizontal: 24, paddingVertical: 12, marginTop: 8 },
});
