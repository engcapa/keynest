import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, Platform, ScrollView, Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
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

function autoName(): string {
  const d = new Date();
  const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return `Account ${dateStr}`;
}

export default function AddScreen() {
  const insets = useSafeAreaInsets();
  const { addAccount, accounts } = useAccounts();
  const { uri } = useLocalSearchParams<{ uri?: string }>();

  const [secretInput, setSecretInput] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const advAnim = useRef(new Animated.Value(0)).current;

  const [name, setName] = useState('');
  const [issuer, setIssuer] = useState('');
  const [algorithm, setAlgorithm] = useState<OTPAlgorithm>('SHA1');
  const [digits, setDigits] = useState<6 | 8>(6);
  const [period, setPeriod] = useState<30 | 60>(30);
  const [type, setType] = useState<OTPType>('totp');
  const [counter, setCounter] = useState('0');

  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (uri && uri.startsWith('otpauth://')) {
      setSecretInput(uri);
    }
  }, [uri]);

  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const bottomPad = Platform.OS === 'web' ? 34 : insets.bottom;

  const toggleAdvanced = () => {
    const toValue = showAdvanced ? 0 : 1;
    setShowAdvanced(!showAdvanced);
    Animated.spring(advAnim, { toValue, useNativeDriver: false, friction: 8 }).start();
  };

  const handleAdd = async () => {
    setError('');
    const raw = secretInput.trim();
    if (!raw) { setError('Please enter a secret key or OTP URI'); return; }

    let account: OTPAccount;

    if (raw.startsWith('otpauth://')) {
      const parsed = parseOtpUri(raw);
      if (!parsed) { setError('Invalid OTP URI format'); return; }
      if (accounts.some(a => a.uri === raw)) { setError('This account already exists'); return; }
      account = {
        id: generateId(),
        uri: raw,
        name: parsed.name || autoName(),
        issuer: parsed.issuer || '',
        secret: parsed.secret || '',
        algorithm: parsed.algorithm || 'SHA1',
        digits: parsed.digits || 6,
        period: parsed.period || 30,
        type: parsed.type || 'totp',
        counter: parsed.counter || 0,
        pinned: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    } else {
      const cleanSecret = raw.replace(/\s/g, '').toUpperCase();
      if (!/^[A-Z2-7=]+$/.test(cleanSecret)) {
        setError('Invalid secret — must be a Base32 string (A–Z, 2–7)');
        return;
      }
      const displayName = name.trim() || autoName();
      const uri = buildOtpUri({
        name: displayName, issuer: issuer.trim(),
        secret: cleanSecret, algorithm, digits, period, type,
        counter: parseInt(counter) || 0,
      });
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
        pinned: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    }

    setSaving(true);
    try {
      await addAccount(account);
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch {
      setError('Failed to save account');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="close" size={24} color={Colors.textSecondary} />
        </TouchableOpacity>
        <Text style={styles.title}>Add Account</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.content, { paddingBottom: bottomPad + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        <TouchableOpacity style={styles.scanBtn} onPress={() => router.push('/scan')} activeOpacity={0.8}>
          <Ionicons name="qr-code-outline" size={20} color={Colors.primary} />
          <Text style={styles.scanBtnText}>Scan QR Code</Text>
        </TouchableOpacity>

        <View style={styles.inputRow}>
          <TextInput
            style={styles.secretInput}
            value={secretInput}
            onChangeText={setSecretInput}
            placeholder="Paste secret key or OTP URI..."
            placeholderTextColor={Colors.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
            autoFocus
            returnKeyType="done"
            onSubmitEditing={handleAdd}
          />
          <TouchableOpacity
            style={[styles.addBtn, saving && { opacity: 0.6 }]}
            onPress={handleAdd}
            disabled={saving}
            activeOpacity={0.8}
          >
            <Text style={styles.addBtnText}>{saving ? '...' : 'Add'}</Text>
          </TouchableOpacity>
        </View>

        {error ? (
          <Text style={styles.error}>{error}</Text>
        ) : null}

        <TouchableOpacity style={styles.advancedToggle} onPress={toggleAdvanced} activeOpacity={0.7}>
          <Text style={styles.advancedLabel}>Advanced options</Text>
          <Ionicons
            name={showAdvanced ? 'chevron-up' : 'chevron-down'}
            size={16}
            color={Colors.textMuted}
          />
        </TouchableOpacity>

        {showAdvanced && (
          <View style={styles.advancedPanel}>
            <AdvField
              label="Name"
              value={name}
              onChangeText={setName}
              placeholder={autoName()}
            />
            <AdvField
              label="Issuer"
              value={issuer}
              onChangeText={setIssuer}
              placeholder="e.g. GitHub, Google"
            />

            <AdvLabel>Type</AdvLabel>
            <ChipRow>
              {TYPES.map(t => (
                <Chip key={t} label={t.toUpperCase()} active={type === t} onPress={() => setType(t)} />
              ))}
            </ChipRow>

            <AdvLabel>Algorithm</AdvLabel>
            <ChipRow>
              {ALGORITHMS.map(a => (
                <Chip key={a} label={a} active={algorithm === a} onPress={() => setAlgorithm(a)} />
              ))}
            </ChipRow>

            <AdvLabel>Digits</AdvLabel>
            <ChipRow>
              {DIGITS.map(d => (
                <Chip key={d} label={String(d)} active={digits === d} onPress={() => setDigits(d)} />
              ))}
            </ChipRow>

            {type === 'totp' && (
              <>
                <AdvLabel>Period</AdvLabel>
                <ChipRow>
                  {PERIODS.map(p => (
                    <Chip key={p} label={`${p}s`} active={period === p} onPress={() => setPeriod(p)} />
                  ))}
                </ChipRow>
              </>
            )}

            {type === 'hotp' && (
              <AdvField
                label="Initial Counter"
                value={counter}
                onChangeText={setCounter}
                placeholder="0"
                keyboardType="numeric"
              />
            )}
          </View>
        )}

        <Text style={styles.hint}>
          Accepts Base32 secret key (e.g. JBSWY3DPEHPK3PXP) or a full otpauth:// URI.
          A name with today's date is auto-assigned if left blank.
        </Text>
      </ScrollView>
    </View>
  );
}

function AdvLabel({ children }: { children: React.ReactNode }) {
  return <Text style={advStyles.label}>{children}</Text>;
}

function ChipRow({ children }: { children: React.ReactNode }) {
  return <View style={advStyles.chipRow}>{children}</View>;
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity
      style={[chipStyles.chip, active && chipStyles.active]}
      onPress={onPress}
    >
      <Text style={[chipStyles.label, active && chipStyles.activeLabel]}>{label}</Text>
    </TouchableOpacity>
  );
}

function AdvField({
  label, value, onChangeText, placeholder, keyboardType,
}: {
  label: string; value: string; onChangeText: (v: string) => void;
  placeholder?: string; keyboardType?: 'numeric';
}) {
  return (
    <View style={advStyles.fieldWrap}>
      <Text style={advStyles.fieldLabel}>{label}</Text>
      <TextInput
        style={advStyles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={Colors.textMuted}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType={keyboardType}
      />
    </View>
  );
}

const advStyles = StyleSheet.create({
  label: {
    fontSize: 11, color: Colors.textMuted, fontWeight: '600',
    textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  fieldWrap: { marginBottom: 14 },
  fieldLabel: { fontSize: 12, color: Colors.textSecondary, marginBottom: 6 },
  input: {
    backgroundColor: Colors.surface, borderRadius: Colors.radiusSm,
    borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: 12, height: 44, color: Colors.text, fontSize: 14,
  },
});

const chipStyles = StyleSheet.create({
  chip: {
    paddingHorizontal: 14, paddingVertical: 7,
    borderRadius: 20, borderWidth: 1, borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  active: { backgroundColor: Colors.primaryDim, borderColor: Colors.primary },
  label: { color: Colors.textSecondary, fontSize: 13, fontWeight: '600' },
  activeLabel: { color: Colors.primary },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingBottom: 20, paddingTop: 4,
  },
  title: { fontSize: 17, fontWeight: '700', color: Colors.text },
  content: { paddingHorizontal: 20 },

  scanBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 10, borderRadius: Colors.radius,
    borderWidth: 1, borderColor: Colors.border,
    backgroundColor: Colors.card,
    paddingVertical: 16, marginBottom: 20,
  },
  scanBtnText: { color: Colors.primary, fontSize: 15, fontWeight: '700' },

  inputRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginBottom: 10,
  },
  secretInput: {
    flex: 1,
    backgroundColor: Colors.card,
    borderRadius: Colors.radiusSm,
    borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: 14, height: 50,
    color: Colors.text, fontSize: 15,
  },
  addBtn: {
    backgroundColor: Colors.primary,
    borderRadius: Colors.radiusSm,
    paddingHorizontal: 22, height: 50,
    alignItems: 'center', justifyContent: 'center',
  },
  addBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },

  error: { color: Colors.danger, fontSize: 13, marginBottom: 12 },

  advancedToggle: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 14,
    borderTopWidth: 1, borderTopColor: Colors.border,
    marginTop: 10,
  },
  advancedLabel: { fontSize: 14, color: Colors.textSecondary, fontWeight: '500' },

  advancedPanel: {
    backgroundColor: Colors.card,
    borderRadius: Colors.radius,
    borderWidth: 1, borderColor: Colors.border,
    padding: 16, marginBottom: 16,
  },

  hint: {
    fontSize: 12, color: Colors.textMuted,
    lineHeight: 18, textAlign: 'center',
    marginTop: 8,
  },
});
