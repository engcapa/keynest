import React, { useState, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  FlatList, StyleSheet, ActivityIndicator,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Colors } from '@/constants/colors';
import AccountCard from '@/components/AccountCard';
import { Tooltip } from '@/components/Tooltip';
import { useAccounts, SortBy } from '@/contexts/AccountsContext';
import type { OTPAccount } from '@/lib/otp';

const SORT_OPTIONS: { label: string; value: SortBy }[] = [
  { label: 'Name', value: 'name' },
  { label: 'Issuer', value: 'issuer' },
  { label: 'Added', value: 'createdAt' },
];

export default function AccountsScreen() {
  const insets = useSafeAreaInsets();
  const {
    filteredAccounts, isLoading,
    searchQuery, sortBy, setSearchQuery, setSortBy,
    syncWithRemote, isSyncing,
  } = useAccounts();
  const [showSort, setShowSort] = useState(false);

  const topPad = Platform.OS === 'web' ? 67 : insets.top;

  const handleAdd = useCallback(() => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push('/add');
  }, []);

  const handleSync = useCallback(async () => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await syncWithRemote();
  }, [syncWithRemote]);

  const renderItem = useCallback(({ item }: { item: OTPAccount }) => (
    <AccountCard account={item} />
  ), []);

  const keyExtractor = useCallback((item: OTPAccount) => item.id, []);

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Key Nest</Text>
          <Text style={styles.count}>{filteredAccounts.length} account{filteredAccounts.length !== 1 ? 's' : ''}</Text>
        </View>
        <View style={styles.headerActions}>
          <Tooltip label="Pull from remote (sync down)">
            <TouchableOpacity
              onPress={handleSync}
              style={styles.headerBtn}
              hitSlop={8}
              disabled={isSyncing}
              accessibilityRole="button"
              accessibilityLabel="Pull from remote"
            >
              {isSyncing
                ? <ActivityIndicator size="small" color={Colors.primary} />
                : <Ionicons name="cloud-download-outline" size={22} color={Colors.textSecondary} />
              }
            </TouchableOpacity>
          </Tooltip>
          <Tooltip label="Add new account">
            <TouchableOpacity
              onPress={handleAdd}
              style={styles.addBtn}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Add account"
            >
              <Ionicons name="add" size={24} color="#fff" />
            </TouchableOpacity>
          </Tooltip>
        </View>
      </View>

      <View style={styles.toolbar}>
        <View style={styles.searchWrap}>
          <Ionicons name="search-outline" size={16} color={Colors.textSecondary} style={{ marginRight: 8 }} />
          <Tooltip label="Search by name or issuer">
            <TextInput
              style={styles.search}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search accounts..."
              placeholderTextColor={Colors.textMuted}
              returnKeyType="search"
              clearButtonMode="while-editing"
              accessibilityLabel="Search accounts"
            />
          </Tooltip>
          {searchQuery.length > 0 && (
            <Tooltip label="Clear search">
              <TouchableOpacity
                onPress={() => setSearchQuery('')}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Clear search"
              >
                <Ionicons name="close-circle" size={16} color={Colors.textSecondary} />
              </TouchableOpacity>
            </Tooltip>
          )}
        </View>

        <Tooltip label="Sort accounts">
          <TouchableOpacity
            style={styles.sortBtn}
            onPress={() => setShowSort(p => !p)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Sort accounts"
          >
            <Ionicons name="funnel-outline" size={16} color={showSort ? Colors.primary : Colors.textSecondary} />
          </TouchableOpacity>
        </Tooltip>
      </View>

      {showSort && (
        <View style={styles.sortMenu}>
          {SORT_OPTIONS.map(opt => (
            <Tooltip key={opt.value} label={`Sort by ${opt.label.toLowerCase()}`}>
              <TouchableOpacity
                style={[styles.sortOption, sortBy === opt.value && styles.sortOptionActive]}
                onPress={() => { setSortBy(opt.value); setShowSort(false); }}
                accessibilityRole="button"
                accessibilityLabel={`Sort by ${opt.label}`}
              >
                <Text style={[styles.sortOptionText, sortBy === opt.value && { color: Colors.primary }]}>
                  {opt.label}
                </Text>
                {sortBy === opt.value && (
                  <Ionicons name="checkmark" size={14} color={Colors.primary} />
                )}
              </TouchableOpacity>
            </Tooltip>
          ))}
        </View>
      )}

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={Colors.primary} size="large" />
        </View>
      ) : filteredAccounts.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="shield-outline" size={56} color={Colors.textMuted} />
          <Text style={styles.emptyTitle}>
            {searchQuery ? 'No results found' : 'No accounts yet'}
          </Text>
          <Text style={styles.emptyBody}>
            {searchQuery ? 'Try a different search' : 'Tap + to add your first authenticator account'}
          </Text>
          {!searchQuery && (
            <Tooltip label="Add new account">
              <TouchableOpacity
                style={styles.emptyBtn}
                onPress={handleAdd}
                accessibilityRole="button"
                accessibilityLabel="Add account"
              >
                <Text style={styles.emptyBtnText}>Add Account</Text>
              </TouchableOpacity>
            </Tooltip>
          )}
        </View>
      ) : (
        <FlatList
          data={filteredAccounts}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          scrollEnabled={!!filteredAccounts.length}
          removeClippedSubviews={Platform.OS !== 'web'}
          maxToRenderPerBatch={10}
          windowSize={10}
          initialNumToRender={15}
          getItemLayout={(_, index) => ({ length: 148, offset: 148 * index, index })}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingBottom: 16, paddingTop: 8,
  },
  title: { fontSize: 26, fontWeight: '700', color: Colors.text, fontFamily: 'Inter_700Bold' },
  count: { fontSize: 13, color: Colors.textSecondary, marginTop: 2 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  headerBtn: { padding: 8, width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  addBtn: {
    backgroundColor: Colors.primary, width: 40, height: 40,
    borderRadius: 12, alignItems: 'center', justifyContent: 'center',
    marginLeft: 4,
  },
  toolbar: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, marginBottom: 8, gap: 8,
  },
  searchWrap: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.card, borderRadius: Colors.radiusSm,
    borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: 12, height: 40,
  },
  search: { flex: 1, color: Colors.text, fontSize: 14 },
  sortBtn: {
    backgroundColor: Colors.card, borderRadius: Colors.radiusSm,
    borderWidth: 1, borderColor: Colors.border,
    width: 40, height: 40, alignItems: 'center', justifyContent: 'center',
  },
  sortMenu: {
    marginHorizontal: 16, backgroundColor: Colors.card,
    borderRadius: Colors.radiusSm, borderWidth: 1, borderColor: Colors.border,
    marginBottom: 8, overflow: 'hidden',
  },
  sortOption: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  sortOptionActive: { backgroundColor: Colors.primaryDim + '55' },
  sortOptionText: { fontSize: 14, color: Colors.textSecondary },
  list: { paddingTop: 4, paddingBottom: 100 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: Colors.text, marginTop: 16 },
  emptyBody: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center', marginTop: 8, lineHeight: 20 },
  emptyBtn: {
    marginTop: 24, backgroundColor: Colors.primary,
    paddingHorizontal: 32, paddingVertical: 12, borderRadius: Colors.radiusSm,
  },
  emptyBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
