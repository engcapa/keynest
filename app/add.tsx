import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ScrollView, Platform, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Colors } from '@/constants/colors';
import { useAccounts } from '@/contexts/AccountsContext';
import { generateId, buildOtpUri, parseOtpUri } from '@/lib/otp';
import type { OTPAccount, OTPAlgorithm, OTPType } from '@/lib/otp';

const ALGORITHMS: OTPAlgorithm[] = ['SHA1', 'SHA256', 'SHA512'];
const DIGITS = [6, 8] as const;
const PERIODS = [30, 60] as const;
const TYPES: OTPType[] = ['totp', 'hotp'];

export default function AddScreen() {
  const insets = useSafeAreaInsets();
  const { addAccount, accounts } = useAccounts();

  const [tab, setTab] = useState<'manual' | 'uri'>('manual');
  const [name, setName] = useState('');
  const [issuer, setIssuer] = useState('');
  const [secret, setSecret] = useState('');
  const [algorithm, setAlgorithm] = useState<OTPAlgorithm>('SHA1');
  const [digits, setDigits] = useState<6 | 8>(6);
  const [period, setPeriod] = useState<30 | 60>(30);
  const [type, setType] = useState<OTPType>('totp');
  const [counter, setCounter] = useState('0');
  const [uriInput, setUriInput] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const bottomPad = Platform.OS === 'web' ? 34 : insets.bottom;

  const handleSave = async () => {
    setError('');
    let account: OTPAccount;

    if (tab === 'uri') {
      if (!uriInput.trim()) { setError('Please enter an OTP URI'); return; }
      const parsed = parseOtpUri(uriInput.trim());
      if (!parsed) { setError('Invalid OTP URI format'); return; }
      const uri = uriInput.trim();
      if (accounts.some(a => a.uri === uri)) { setError('This account already exists'); return; }
      account = {
        id: generateId(),
        uri,
        name: parsed.name || 'Unknown',
        issuer: parsed.issuer || '',
        secret: parsed.secret || '',
        algorithm: parsed.algorithm || 'SHA1',
        digits: parsed.digits || 6,
        period: parsed.period || 30,
        type: parsed.type || 'totp',
        counter: parsed.counter || 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    } else {
      if (!secret.trim()) { setError('Secret key is required'); return; }
      const cleanSecret = secret.replace(/\s/g, '').toUpperCase();
      if (!/^[A-Z2-7=]+$/.test(cleanSecret)) { setError('Secret must be a valid Base32 string'); return; }
      const displayName = name.trim() || cleanSecret;
      const uri = buildOtpUri({ name: displayName, issuer: issuer.trim(), secret: cleanSecret, algorithm, digits, period, type, counter: parseInt(counter) || 0 });
      if (accounts.some(a => a.uri === uri)) { setError('This account already exists'); return; }
      account = {
        id: generateId(),
        uri,
        name: displayName,
        issuer: issuer.trim(),
        secret: cleanSecret,
        algorithm,
        digits,
        period,
        type,
        counter: parseInt(counter) || 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    }

    setSaving(true);
    try {
      await addAccount(account);
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch (e) {
      setError('Failed to save account');
    } finally {
      setSaving(false);
    }
  };

  const handleScan = () => {
    router.push('/scan');
  };

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="close" size={24} color={Colors.textSecondary} />
        </TouchableOpacity>
        <Text style={styles.title}>Add Account</Text>
        <TouchableOpacity onPress={handleSave} disabled={saving} hitSlop={8}>
          <Text style={[styles.saveBtn, saving && { opacity: 0.5 }]}>
            {saving ? 'Saving...' : 'Save'}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, tab === 'manual' && styles.tabActive]}
          onPress={() => setTab('manual')}
        >
          <Text style={[styles.tabText, tab === 'manual' && styles.tabTextActive]}>Manual</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, tab === 'uri' && styles.tabActive]}
          onPress={() => setTab('uri')}
        >
          <Text style={[styles.tabText, tab === 'uri' && styles.tabTextActive]}>URI / QR Code</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: bottomPad + 20 }]}
        keyboardShouldPersistTaps="handled"
      >
        {tab === 'uri' ? (
          <View style={styles.section}>
            {Platform.OS !== 'web' && (
              <TouchableOpacity style={styles.scanBtn} onPress={handleScan}>
                <Ionicons name="qr-code-outline" size={22} color={Colors.primary} />
                <Text style={styles.scanBtnText}>Scan QR Code</Text>
              </TouchableOpacity>
            )}
            <Text style={styles.orText}>Or paste the OTP URI</Text>
            <TextInput
              style={[styles.input, styles.inputMulti]}
              value={uriInput}
              onChangeText={setUriInput}
              placeholder="otpauth://totp/Example:user@example.com?secret=JBSWY3DPEHPK3PXP&issuer=Example"
              placeholderTextColor={Colors.textMuted}
              multiline
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
        ) : (
          <View style={styles.section}>
            <FormField label="Account Name" value={name} onChangeText={setName} placeholder="e.g. GitHub: john@example.com" />
            <FormField label="Issuer (optional)" value={issuer} onChangeText={setIssuer} placeholder="e.g. GitHub" />
            <FormField
              label="Secret Key *"
              value={secret}
              onChangeText={setSecret}
              placeholder="Base32 encoded secret"
              autoCapitalize="characters"
              autoCorrect={false}
              hint="Found in the app's security settings or QR code"
            />

            <Text style={styles.fieldLabel}>Type</Text>
            <View style={styles.chipRow}>
              {TYPES.map(t => (
                <Chip key={t} label={t.toUpperCase()} active={type === t} onPress={() => setType(t)} />
              ))}
            </View>

            <Text style={styles.fieldLabel}>Algorithm</Text>
            <View style={styles.chipRow}>
              {ALGORITHMS.map(a => (
                <Chip key={a} label={a} active={algorithm === a} onPress={() => setAlgorithm(a)} />
              ))}
            </View>

            <Text style={styles.fieldLabel}>Digits</Text>
            <View style={styles.chipRow}>
              {DIGITS.map(d => (
                <Chip key={d} label={String(d)} active={digits === d} onPress={() => setDigits(d)} />
              ))}
            </View>

            {type === 'totp' && (
              <>
                <Text style={styles.fieldLabel}>Period (seconds)</Text>
                <View style={styles.chipRow}>
                  {PERIODS.map(p => (
                    <Chip key={p} label={`${p}s`} active={period === p} onPress={() => setPeriod(p)} />
                  ))}
                </View>
              </>
            )}

            {type === 'hotp' && (
              <FormField
                label="Initial Counter"
                value={counter}
                onChangeText={setCounter}
                placeholder="0"
                keyboardType="numeric"
              />
            )}
          </View>
        )}

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <TouchableOpacity
          style={[styles.saveFullBtn, saving && { opacity: 0.6 }]}
          onPress={handleSave}
          disabled={saving}
          activeOpacity={0.8}
        >
          <Text style={styles.saveFullBtnText}>{saving ? 'Saving...' : 'Add Account'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

function FormField({
  label, value, onChangeText, placeholder, autoCapitalize, autoCorrect, keyboardType, hint
}: {
  label: string; value: string; onChangeText: (v: string) => void;
  placeholder?: string; autoCapitalize?: 'none' | 'characters' | 'words' | 'sentences';
  autoCorrect?: boolean; keyboardType?: 'numeric'; hint?: string;
}) {
  return (
    <View style={ffStyles.wrap}>
      <Text style={ffStyles.label}>{label}</Text>
      <TextInput
        style={ffStyles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={Colors.textMuted}
        autoCapitalize={autoCapitalize || 'none'}
        autoCorrect={autoCorrect ?? false}
        keyboardType={keyboardType}
      />
      {hint ? <Text style={ffStyles.hint}>{hint}</Text> : null}
    </View>
  );
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity
      style={[chipStyles.chip, active && chipStyles.chipActive]}
      onPress={onPress}
    >
      <Text style={[chipStyles.label, active && chipStyles.labelActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

const ffStyles = StyleSheet.create({
  wrap: { marginBottom: 16 },
  label: { fontSize: 12, color: Colors.textSecondary, fontWeight: '600', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.8 },
  input: {
    backgroundColor: Colors.card, borderRadius: Colors.radiusSm,
    borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: 14, height: 48, color: Colors.text, fontSize: 15,
  },
  hint: { fontSize: 11, color: Colors.textMuted, marginTop: 4 },
});

const chipStyles = StyleSheet.create({
  chip: {
    paddingHorizontal: 16, paddingVertical: 8,
    borderRadius: 20, borderWidth: 1, borderColor: Colors.border,
    backgroundColor: Colors.card,
  },
  chipActive: { backgroundColor: Colors.primaryDim, borderColor: Colors.primary },
  label: { color: Colors.textSecondary, fontSize: 13, fontWeight: '600' },
  labelActive: { color: Colors.primary },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingBottom: 16, paddingTop: 4,
  },
  title: { fontSize: 17, fontWeight: '700', color: Colors.text, fontFamily: 'Inter_700Bold' },
  saveBtn: { color: Colors.primary, fontSize: 16, fontWeight: '700' },
  tabBar: {
    flexDirection: 'row', marginHorizontal: 16, marginBottom: 20,
    backgroundColor: Colors.card, borderRadius: Colors.radiusSm,
    borderWidth: 1, borderColor: Colors.border, padding: 4,
  },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 8 },
  tabActive: { backgroundColor: Colors.primary },
  tabText: { fontSize: 14, fontWeight: '600', color: Colors.textSecondary },
  tabTextActive: { color: '#fff' },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 16 },
  section: {},
  scanBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.card, borderRadius: Colors.radius,
    borderWidth: 1, borderColor: Colors.primary + '55',
    paddingVertical: 18, gap: 12, marginBottom: 20,
  },
  scanBtnText: { color: Colors.primary, fontSize: 16, fontWeight: '700' },
  orText: { textAlign: 'center', color: Colors.textMuted, marginBottom: 12, fontSize: 13 },
  input: {
    backgroundColor: Colors.card, borderRadius: Colors.radiusSm,
    borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: 14, paddingVertical: 12,
    color: Colors.text, fontSize: 14,
  },
  inputMulti: { minHeight: 100, textAlignVertical: 'top' },
  fieldLabel: {
    fontSize: 12, color: Colors.textSecondary, fontWeight: '600',
    marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.8,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  error: { color: Colors.danger, fontSize: 13, textAlign: 'center', marginBottom: 12 },
  saveFullBtn: {
    backgroundColor: Colors.primary, borderRadius: Colors.radiusSm,
    height: 52, alignItems: 'center', justifyContent: 'center', marginTop: 8,
  },
  saveFullBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
