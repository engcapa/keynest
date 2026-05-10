import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ScrollView, Platform, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Colors } from '@/constants/colors';
import { Tooltip } from '@/components/Tooltip';
import { useAccounts } from '@/contexts/AccountsContext';
import { getAvatarColor, getInitials } from '@/lib/otp';

export default function EditScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { accounts, updateAccount } = useAccounts();

  const account = accounts.find(a => a.id === id);

  const [name, setName] = useState(account?.name || '');
  const [issuer, setIssuer] = useState(account?.issuer || '');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const bottomPad = Platform.OS === 'web' ? 34 : insets.bottom;

  if (!account) {
    return (
      <View style={[styles.container, { paddingTop: topPad, alignItems: 'center', justifyContent: 'center' }]}>
        <Text style={{ color: Colors.textSecondary }}>Account not found</Text>
        <Tooltip label="Return to the previous screen">
          <TouchableOpacity onPress={() => router.back()} style={styles.btn} accessibilityRole="button" accessibilityLabel="Go back">
            <Text style={styles.btnText}>Go Back</Text>
          </TouchableOpacity>
        </Tooltip>
      </View>
    );
  }

  const avatarColor = getAvatarColor(account.name);
  const initials = getInitials(account.name);

  const handleSave = async () => {
    setError('');
    if (!name.trim()) { setError('Name cannot be empty'); return; }
    setSaving(true);
    try {
      await updateAccount(id!, { name: name.trim(), issuer: issuer.trim() });
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch {
      setError('Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      <View style={styles.header}>
        <Tooltip label="Discard changes">
          <TouchableOpacity onPress={() => router.back()} hitSlop={8} accessibilityRole="button" accessibilityLabel="Close">
            <Ionicons name="close" size={24} color={Colors.textSecondary} />
          </TouchableOpacity>
        </Tooltip>
        <Text style={styles.title}>Edit Account</Text>
        <Tooltip label="Save changes">
          <TouchableOpacity onPress={handleSave} disabled={saving} hitSlop={8} accessibilityRole="button" accessibilityLabel="Save">
            <Text style={[styles.saveBtn, saving && { opacity: 0.5 }]}>
              {saving ? '...' : 'Save'}
            </Text>
          </TouchableOpacity>
        </Tooltip>
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: bottomPad + 20 }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.avatarWrap}>
          <View style={[styles.avatar, { backgroundColor: avatarColor + '33' }]}>
            <Text style={[styles.avatarText, { color: avatarColor }]}>{initials}</Text>
          </View>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Display Name</Text>
          <Tooltip label="How this account will appear in the list">
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="Account name"
              placeholderTextColor={Colors.textMuted}
              autoFocus
              accessibilityLabel="Display name"
            />
          </Tooltip>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Issuer (optional)</Text>
          <Tooltip label="Name of the service (e.g. GitHub, Google)">
            <TextInput
              style={styles.input}
              value={issuer}
              onChangeText={setIssuer}
              placeholder="Service provider"
              placeholderTextColor={Colors.textMuted}
              autoCapitalize="none"
              accessibilityLabel="Issuer"
            />
          </Tooltip>
        </View>

        <View style={styles.infoCard}>
          <InfoRow label="Type" value={account.type.toUpperCase()} />
          <InfoRow label="Algorithm" value={account.algorithm} />
          <InfoRow label="Digits" value={String(account.digits)} />
          {account.type === 'totp' && <InfoRow label="Period" value={`${account.period}s`} />}
          {account.type === 'hotp' && <InfoRow label="Counter" value={String(account.counter)} />}
          <InfoRow label="Secret" value={account.secret.slice(0, 8) + '...'} />
          <InfoRow label="Added" value={new Date(account.createdAt).toLocaleDateString()} />
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Tooltip label="Save changes to this account">
          <TouchableOpacity
            style={[styles.btn, saving && { opacity: 0.6 }]}
            onPress={handleSave}
            disabled={saving}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Save changes"
          >
            <Text style={styles.btnText}>{saving ? 'Saving...' : 'Save Changes'}</Text>
          </TouchableOpacity>
        </Tooltip>
      </ScrollView>
    </View>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={irStyles.row}>
      <Text style={irStyles.label}>{label}</Text>
      <Text style={irStyles.value}>{value}</Text>
    </View>
  );
}

const irStyles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.border },
  label: { fontSize: 14, color: Colors.textSecondary },
  value: { fontSize: 14, color: Colors.text, fontWeight: '500' },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingBottom: 16, paddingTop: 4,
  },
  title: { fontSize: 17, fontWeight: '700', color: Colors.text },
  saveBtn: { color: Colors.primary, fontSize: 16, fontWeight: '700' },
  content: { paddingHorizontal: 20 },
  avatarWrap: { alignItems: 'center', marginBottom: 28 },
  avatar: { width: 80, height: 80, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 28, fontWeight: '700' },
  field: { marginBottom: 16 },
  label: {
    fontSize: 12, color: Colors.textSecondary, fontWeight: '600',
    textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6,
  },
  input: {
    backgroundColor: Colors.card, borderRadius: Colors.radiusSm,
    borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: 14, height: 48, color: Colors.text, fontSize: 15,
  },
  infoCard: {
    backgroundColor: Colors.card, borderRadius: Colors.radius,
    borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: 16, marginBottom: 24,
  },
  error: { color: Colors.danger, fontSize: 13, textAlign: 'center', marginBottom: 12 },
  btn: {
    backgroundColor: Colors.primary, borderRadius: Colors.radiusSm,
    height: 52, alignItems: 'center', justifyContent: 'center',
  },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
