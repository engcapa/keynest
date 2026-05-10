import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ScrollView, Platform, Alert, Switch,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';
import { useAuth } from '@/contexts/AuthContext';
import { loadSettings, saveSettings, AppSettings } from '@/lib/storage';
import { apiRequest } from '@/lib/query-client';

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const { logout, changePassword } = useAuth();
  const [settings, setSettings] = useState<AppSettings>({ mysqlEnabled: false });
  const [mysqlEnabled, setMysqlEnabled] = useState(false);
  const [host, setHost] = useState('');
  const [port, setPort] = useState('3306');
  const [database, setDatabase] = useState('');
  const [user, setUser] = useState('');
  const [mysqlPass, setMysqlPass] = useState('');
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [pwError, setPwError] = useState('');
  const [pwSuccess, setPwSuccess] = useState(false);

  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const bottomPad = Platform.OS === 'web' ? 34 : insets.bottom;

  useEffect(() => {
    (async () => {
      const s = await loadSettings();
      setSettings(s);
      setMysqlEnabled(s.mysqlEnabled);
      setHost(s.mysqlHost || '');
      setPort(String(s.mysqlPort || 3306));
      setDatabase(s.mysqlDatabase || '');
      setUser(s.mysqlUser || '');
      setMysqlPass(s.mysqlPassword || '');
    })();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setTestResult(null);
    const updated: AppSettings = {
      mysqlEnabled,
      mysqlHost: host,
      mysqlPort: parseInt(port) || 3306,
      mysqlDatabase: database,
      mysqlUser: user,
      mysqlPassword: mysqlPass,
    };
    await saveSettings(updated);
    setSaving(false);
    setTestResult('Settings saved');
    setTimeout(() => setTestResult(null), 2000);
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const result = await apiRequest('POST', '/api/settings/test', {
        host, port: parseInt(port) || 3306, database, user, password: mysqlPass,
      }) as { ok: boolean; error?: string };
      setTestResult(result.ok ? 'Connection successful!' : `Failed: ${result.error}`);
    } catch (e) {
      setTestResult('Cannot reach server. Is the backend running?');
    } finally {
      setTesting(false);
    }
  };

  const handleChangePassword = async () => {
    setPwError('');
    setPwSuccess(false);
    if (!newPassword || newPassword.length < 4) {
      setPwError('New password must be at least 4 characters');
      return;
    }
    const ok = await changePassword(oldPassword, newPassword);
    if (ok) {
      setPwSuccess(true);
      setOldPassword('');
      setNewPassword('');
      setTimeout(() => setPwSuccess(false), 2000);
    } else {
      setPwError('Current password is incorrect');
    }
  };

  const handleLogout = () => {
    if (Platform.OS === 'web') {
      if (window.confirm('Lock the app?')) logout();
    } else {
      Alert.alert('Lock App', 'Are you sure?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Lock', onPress: logout },
      ]);
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingTop: topPad, paddingBottom: bottomPad + 80 }]}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.pageTitle}>Settings</Text>

      <Section title="Remote Database (MySQL)">
        <View style={styles.row}>
          <View style={styles.rowLeft}>
            <Ionicons name="cloud-outline" size={18} color={Colors.primary} />
            <Text style={styles.rowLabel}>Enable MySQL Sync</Text>
          </View>
          <Switch
            value={mysqlEnabled}
            onValueChange={setMysqlEnabled}
            trackColor={{ false: Colors.border, true: Colors.primaryDim }}
            thumbColor={mysqlEnabled ? Colors.primary : Colors.textMuted}
          />
        </View>

        {mysqlEnabled && (
          <View style={styles.fields}>
            <Field label="Host" value={host} onChangeText={setHost} placeholder="e.g. 192.168.1.100" />
            <Field label="Port" value={port} onChangeText={setPort} placeholder="3306" keyboardType="numeric" />
            <Field label="Database" value={database} onChangeText={setDatabase} placeholder="mfavault" />
            <Field label="User" value={user} onChangeText={setUser} placeholder="root" />
            <Field label="Password" value={mysqlPass} onChangeText={setMysqlPass} placeholder="••••••••" secureTextEntry />

            {testResult && (
              <Text style={[styles.testResult, testResult.startsWith('Connection') ? { color: Colors.accent } : { color: Colors.danger }]}>
                {testResult}
              </Text>
            )}

            <View style={styles.btnRow}>
              <TouchableOpacity
                style={[styles.btn, styles.btnOutline]}
                onPress={handleTest}
                disabled={testing}
              >
                <Text style={[styles.btnText, { color: Colors.primary }]}>
                  {testing ? 'Testing...' : 'Test Connection'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btn, styles.btnPrimary]}
                onPress={handleSave}
                disabled={saving}
              >
                <Text style={styles.btnText}>{saving ? 'Saving...' : 'Save'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {!mysqlEnabled && (
          <Text style={styles.hint}>
            Enable to sync accounts with a remote MySQL database. Useful for backup and multi-device access.
          </Text>
        )}
      </Section>

      <Section title="Security">
        <Text style={styles.sectionHint}>Change your app password</Text>
        <Field label="Current Password" value={oldPassword} onChangeText={setOldPassword} secureTextEntry placeholder="Current password" />
        <Field label="New Password" value={newPassword} onChangeText={setNewPassword} secureTextEntry placeholder="New password (min 4 chars)" />
        {pwError ? <Text style={styles.error}>{pwError}</Text> : null}
        {pwSuccess ? <Text style={styles.success}>Password changed successfully</Text> : null}
        <TouchableOpacity style={[styles.btn, styles.btnPrimary]} onPress={handleChangePassword}>
          <Text style={styles.btnText}>Change Password</Text>
        </TouchableOpacity>
      </Section>

      <Section title="Session">
        <TouchableOpacity style={[styles.btn, styles.btnDanger]} onPress={handleLogout}>
          <Ionicons name="lock-closed-outline" size={16} color={Colors.danger} style={{ marginRight: 8 }} />
          <Text style={[styles.btnText, { color: Colors.danger }]}>Lock App</Text>
        </TouchableOpacity>
      </Section>

      <View style={styles.footer}>
        <Text style={styles.footerText}>Key Nest v1.0</Text>
        <Text style={styles.footerText}>Supports TOTP · HOTP · SHA1 · SHA256 · SHA512</Text>
      </View>
    </ScrollView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={sStyles.section}>
      <Text style={sStyles.sectionTitle}>{title}</Text>
      <View style={sStyles.card}>{children}</View>
    </View>
  );
}

function Field({
  label, value, onChangeText, placeholder, secureTextEntry, keyboardType
}: {
  label: string; value: string; onChangeText: (v: string) => void;
  placeholder?: string; secureTextEntry?: boolean; keyboardType?: 'numeric' | 'default';
}) {
  return (
    <View style={fStyles.wrap}>
      <Text style={fStyles.label}>{label}</Text>
      <TextInput
        style={fStyles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={Colors.textMuted}
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType || 'default'}
        autoCapitalize="none"
        autoCorrect={false}
      />
    </View>
  );
}

const sStyles = StyleSheet.create({
  section: { marginBottom: 24 },
  sectionTitle: {
    fontSize: 12, fontWeight: '700', color: Colors.textSecondary,
    textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 10, marginLeft: 4,
  },
  card: {
    backgroundColor: Colors.card, borderRadius: Colors.radius,
    borderWidth: 1, borderColor: Colors.border, padding: 16, gap: 12,
  },
});

const fStyles = StyleSheet.create({
  wrap: { gap: 6 },
  label: { fontSize: 12, color: Colors.textSecondary, fontWeight: '500' },
  input: {
    backgroundColor: Colors.surface, borderRadius: Colors.radiusSm,
    borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: 12, height: 44, color: Colors.text, fontSize: 14,
  },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { paddingHorizontal: 16 },
  pageTitle: {
    fontSize: 26, fontWeight: '700', color: Colors.text,
    fontFamily: 'Inter_700Bold', marginBottom: 24, paddingTop: 8,
  },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rowLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  rowLabel: { fontSize: 15, color: Colors.text, fontWeight: '500' },
  fields: { gap: 12 },
  hint: { fontSize: 13, color: Colors.textSecondary, lineHeight: 18 },
  sectionHint: { fontSize: 13, color: Colors.textSecondary },
  testResult: { fontSize: 13, textAlign: 'center' },
  error: { color: Colors.danger, fontSize: 13 },
  success: { color: Colors.accent, fontSize: 13 },
  btnRow: { flexDirection: 'row', gap: 10 },
  btn: {
    flex: 1, flexDirection: 'row', height: 44,
    borderRadius: Colors.radiusSm, alignItems: 'center', justifyContent: 'center',
  },
  btnPrimary: { backgroundColor: Colors.primary },
  btnOutline: { borderWidth: 1, borderColor: Colors.primary },
  btnDanger: { borderWidth: 1, borderColor: Colors.danger },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  footer: { alignItems: 'center', gap: 4, marginTop: 16 },
  footerText: { fontSize: 12, color: Colors.textMuted },
});
