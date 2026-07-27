import React, { useCallback, useState } from 'react';
import {
  Alert, FlatList, Pressable, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import {
  MaterialType, SavedMaterial,
  deleteItem, duplicateItem, getItems, toggleFavorite,
} from '@/services/workspace';

const TYPE_COLOR: Record<MaterialType, string> = {
  lesson: '#1B6B62',
  worksheet: '#8B5CF6',
  quiz: '#F59E0B',
};
const TYPE_ICON: Record<MaterialType, keyof typeof Ionicons.glyphMap> = {
  lesson: 'document-text-outline',
  worksheet: 'list-outline',
  quiz: 'help-circle-outline',
};

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
    }, [reload]),
  );

  const handleToggleFavorite = async (id: string) => {
    await toggleFavorite(id);
    reload();
  };

  const handleDelete = (item: SavedMaterial) => {
    Alert.alert(
      t('deleteConfirmTitle'),
      t('deleteConfirmMsg'),
      [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('deleteItem'),
          style: 'destructive',
          onPress: async () => {
            await deleteItem(item.id);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            reload();
          },
        },
      ],
    );
  };

  const handleDuplicate = async (id: string) => {
    await duplicateItem(id);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    reload();
  };

  const handleMenu = (item: SavedMaterial) => {
    const editRoute =
      item.type === 'lesson' ? '/ai-tools/lesson-plan'
        : item.type === 'worksheet' ? '/ai-tools/worksheet'
          : '/ai-tools/quiz';

    Alert.alert(
      item.title,
      undefined,
      [
        {
          text: t('openItem'),
          onPress: () => router.push({ pathname: '/workspace/view', params: { id: item.id } }),
        },
        {
          text: t('editItem'),
          onPress: () =>
            router.push({
              pathname: editRoute as any,
              params: { savedId: item.id, ...item.formState },
            }),
        },
        {
          text: t('duplicateItem'),
          onPress: () => handleDuplicate(item.id),
        },
        {
          text: t('deleteItem'),
          style: 'destructive',
          onPress: () => handleDelete(item),
        },
        { text: t('cancel'), style: 'cancel' },
      ],
    );
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

  const typeLabel = (type: MaterialType) => {
    if (type === 'lesson') return t('lessonType');
    if (type === 'worksheet') return t('worksheetType');
    return t('quizType');
  };

  const renderItem = ({ item }: { item: SavedMaterial }) => {
    const color = TYPE_COLOR[item.type];
    const icon = TYPE_ICON[item.type];
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
            style={[styles.cardTitle, { color: colors.foreground, fontFamily: 'Inter_600SemiBold', textAlign: isRTL ? 'right' : 'left' }]}
            numberOfLines={2}
          >
            {item.title}
          </Text>
          <View style={[styles.cardMeta, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
            <View style={[styles.typePill, { backgroundColor: color + '18', borderRadius: 8 }]}>
              <Text style={[styles.typeText, { color, fontFamily: 'Inter_500Medium' }]}>
                {typeLabel(item.type)}
              </Text>
            </View>
            <Text style={[styles.metaText, { color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }]}>
              {item.grade}
            </Text>
          </View>
          <Text style={[styles.metaText, { color: colors.mutedForeground, fontFamily: 'Inter_400Regular', textAlign: isRTL ? 'right' : 'left', marginTop: 2 }]}>
            {t('savedAt')} {formatDate(item.savedAt)}
          </Text>
        </View>

        {/* Actions */}
        <View style={[styles.cardActions, { alignItems: isRTL ? 'flex-start' : 'flex-end' }]}>
          <Pressable
            onPress={() => handleToggleFavorite(item.id)}
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
            onPress={() => handleMenu(item)}
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
        <Text style={[styles.headerTitle, { color: colors.foreground, fontFamily: 'Inter_700Bold', textAlign: isRTL ? 'right' : 'left' }]}>
          {t('myWorkspace')}
        </Text>
        <Text style={[styles.headerSub, { color: colors.mutedForeground, fontFamily: 'Inter_400Regular', textAlign: isRTL ? 'right' : 'left' }]}>
          {t('workspaceSubtitle')}
        </Text>

        {/* Search */}
        <View style={[styles.searchRow, { backgroundColor: colors.muted, borderRadius: 12, flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
          <Ionicons name="search-outline" size={16} color={colors.mutedForeground} />
          <TextInput
            style={[styles.searchInput, { color: colors.foreground, fontFamily: 'Inter_400Regular', textAlign: isRTL ? 'right' : 'left' }]}
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
                  fontFamily: activeTab === tab.key ? 'Inter_600SemiBold' : 'Inter_400Regular',
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
          <Text style={[styles.filterText, { color: favoritesOnly ? '#F59E0B' : colors.mutedForeground, fontFamily: 'Inter_500Medium' }]}>
            {t('favoritesFilter')}
          </Text>
        </Pressable>
        <Text style={[styles.countText, { color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }]}>
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
            <Text style={[styles.emptyTitle, { color: colors.foreground, fontFamily: 'Inter_600SemiBold', textAlign: 'center' }]}>
              {t('noSavedItems')}
            </Text>
            <Text style={[styles.emptyDesc, { color: colors.mutedForeground, fontFamily: 'Inter_400Regular', textAlign: 'center' }]}>
              {t('noSavedItemsDesc')}
            </Text>
            <Pressable
              onPress={() => router.push('/(tabs)/ai-tools')}
              style={[styles.emptyBtn, { backgroundColor: colors.primary, borderRadius: colors.radius }]}
            >
              <Text style={[{ color: colors.primaryForeground, fontFamily: 'Inter_600SemiBold', fontSize: 14 }]}>
                {t('aiTools')}
              </Text>
            </Pressable>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
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
  typePill: { paddingHorizontal: 8, paddingVertical: 2 },
  typeText: { fontSize: 11 },
  metaText: { fontSize: 11 },
  cardActions: { justifyContent: 'flex-start', flexShrink: 0 },
  empty: { alignItems: 'center', paddingTop: 60, gap: 12, paddingHorizontal: 20 },
  emptyTitle: { fontSize: 18, marginTop: 8 },
  emptyDesc: { fontSize: 13, lineHeight: 20, maxWidth: 280 },
  emptyBtn: { paddingHorizontal: 24, paddingVertical: 12, marginTop: 8 },
});
