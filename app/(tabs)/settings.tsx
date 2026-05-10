import React, { useEffect, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ScrollView, Platform, Alert, Switch,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';
import { Tooltip } from '@/components/Tooltip';
import { useAuth } from '@/contexts/AuthContext';
import { useAccounts } from '@/contexts/AccountsContext';
import type { MysqlConfig, MysqlSslMode } from '@/lib/storage';
import {
  getIdleLockMinutes, setIdleLockMinutes,
  IDLE_LOCK_OPTIONS, DEFAULT_IDLE_LOCK_MINUTES,
} from '@/lib/storage';
import { testMysqlConnection } from '@/lib/mysql-client';

const DEFAULT_MYSQL: MysqlConfig = {
  host: '',
  port: 3306,
  user: '',
  password: '',
  database: '',
  sslMode: 'REQUIRED',
  autoSync: true,
};

function formatWhen(iso: string | null): string {
  if (!iso) return 'never';
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString();
  } catch {
    return iso;
  }
}

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const { logout, changePassword, isAnonymous } = useAuth();
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [pwError, setPwError] = useState('');
  const [pwSuccess, setPwSuccess] = useState(false);
  const [idleMinutes, setIdleMinutes] = useState<number>(DEFAULT_IDLE_LOCK_MINUTES);

  useEffect(() => {
    (async () => {
      setIdleMinutes(await getIdleLockMinutes());
    })();
  }, []);

  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const bottomPad = Platform.OS === 'web' ? 34 : insets.bottom;

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

      <Section title="Remote Sync">
        {Platform.OS === 'android' ? <MysqlConfigCard /> : (
          <Text style={styles.hint}>
            Remote MySQL sync is configured on the server by your administrator. When enabled, this app
            automatically syncs accounts with the remote database. No client-side setup is required.
            {'\n\n'}
            The web password is managed by the server. To preset it, write `auth.passwordHash` into
            `keynest.config.json`; otherwise the first visitor is prompted to create one.
          </Text>
        )}
      </Section>

      <Section title="Security">
        {isAnonymous ? (
          <Text style={styles.hint}>
            Offline mode — no password is set on this device. Your accounts are kept locally only.
            Lock this session from the Session card below, or log in with a password to enable auto-lock and remote sync.
          </Text>
        ) : (
          <>
            <Text style={styles.sectionHint}>Change your app password</Text>
            <Field label="Current Password" value={oldPassword} onChangeText={setOldPassword} secureTextEntry placeholder="Current password" />
            <Field label="New Password" value={newPassword} onChangeText={setNewPassword} secureTextEntry placeholder="New password (min 4 chars)" />
            {pwError ? <Text style={styles.error}>{pwError}</Text> : null}
            {pwSuccess ? <Text style={styles.success}>Password changed successfully</Text> : null}
            <Tooltip label="Save your new password">
              <TouchableOpacity style={[styles.btn, styles.btnPrimary]} onPress={handleChangePassword} accessibilityRole="button" accessibilityLabel="Change password">
                <Text style={styles.btnText}>Change Password</Text>
              </TouchableOpacity>
            </Tooltip>

            <View style={{ height: 8 }} />
            <Text style={styles.sectionHint}>Auto-lock when idle</Text>
            <View style={styles.chipRow}>
              {IDLE_LOCK_OPTIONS.map(m => {
                const active = idleMinutes === m;
                const label = m === 0 ? 'Never' : `${m} min`;
                return (
                  <Tooltip key={m} label={m === 0 ? 'Disable auto-lock' : `Lock after ${m} minute${m === 1 ? '' : 's'} of inactivity`}>
                    <TouchableOpacity
                      style={[styles.chip, active && styles.chipActive]}
                      onPress={async () => {
                        setIdleMinutes(m);
                        await setIdleLockMinutes(m);
                      }}
                      accessibilityRole="button"
                      accessibilityLabel={label}
                      accessibilityState={{ selected: active }}
                    >
                      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
                    </TouchableOpacity>
                  </Tooltip>
                );
              })}
            </View>
          </>
        )}
      </Section>

      <Section title="Session">
        <Tooltip label="Lock the app and return to the login screen">
          <TouchableOpacity style={[styles.btn, styles.btnDanger]} onPress={handleLogout} accessibilityRole="button" accessibilityLabel="Lock app">
            <Ionicons name="lock-closed-outline" size={16} color={Colors.danger} style={{ marginRight: 8 }} />
            <Text style={[styles.btnText, { color: Colors.danger }]}>Lock App</Text>
          </TouchableOpacity>
        </Tooltip>
      </Section>

      <View style={styles.footer}>
        <Text style={styles.footerText}>Key Nest v1.0</Text>
        <Text style={styles.footerText}>Supports TOTP · HOTP · SHA1 · SHA256 · SHA512</Text>
      </View>
    </ScrollView>
  );
}

function MysqlConfigCard() {
  const { mysqlConfig, saveMysqlConfig, removeMysqlConfig, syncWithRemote, isSyncing, syncError, lastSyncAt } = useAccounts();
  const [draft, setDraft] = useState<MysqlConfig>(mysqlConfig ?? DEFAULT_MYSQL);
  const [testMsg, setTestMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    if (mysqlConfig) setDraft(mysqlConfig);
  }, [mysqlConfig]);

  const setField = <K extends keyof MysqlConfig>(key: K, value: MysqlConfig[K]) => {
    setDraft(prev => ({ ...prev, [key]: value }));
    setTestMsg(null);
    setSaveMsg(null);
  };

  const validate = (): string | null => {
    if (!draft.host.trim()) return 'Host is required';
    if (!draft.database.trim()) return 'Database is required';
    if (!draft.user.trim()) return 'User is required';
    if (!Number.isFinite(draft.port) || draft.port <= 0) return 'Port must be a positive number';
    return null;
  };

  const onTest = async () => {
    const err = validate();
    if (err) { setTestMsg({ kind: 'err', text: err }); return; }
    setTesting(true);
    setTestMsg(null);
    try {
      const res = await testMysqlConnection(draft);
      if (res.ok) setTestMsg({ kind: 'ok', text: 'Connection successful' });
      else setTestMsg({ kind: 'err', text: res.error || 'Connection failed' });
    } finally {
      setTesting(false);
    }
  };

  const onSave = async () => {
    const err = validate();
    if (err) { setTestMsg({ kind: 'err', text: err }); return; }
    setTesting(true);
    try {
      const res = await testMysqlConnection(draft);
      if (!res.ok) {
        setTestMsg({ kind: 'err', text: res.error || 'Connection failed — not saved' });
        return;
      }
      await saveMysqlConfig(draft);
      setSaveMsg('Saved');
      setTestMsg({ kind: 'ok', text: 'Connection successful' });
      setTimeout(() => setSaveMsg(null), 2000);
    } finally {
      setTesting(false);
    }
  };

  const onClear = () => {
    Alert.alert('Remove MySQL config?', 'Local accounts stay on this device. Remote rows are not deleted.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          await removeMysqlConfig();
          setDraft(DEFAULT_MYSQL);
          setTestMsg(null);
          setSaveMsg(null);
        },
      },
    ]);
  };

  const onSyncNow = async () => {
    if (validate()) { setTestMsg({ kind: 'err', text: 'Save a valid config before syncing' }); return; }
    await syncWithRemote();
  };

  const toggleSsl = () => {
    const next: MysqlSslMode = draft.sslMode === 'REQUIRED' ? 'DISABLED' : 'REQUIRED';
    setField('sslMode', next);
  };

  return (
    <View style={{ gap: 12 }}>
      <Text style={styles.sectionHint}>
        Connect directly to your MySQL server. Credentials stay on this device (SecureStore).
      </Text>

      <Field label="Host" value={draft.host} onChangeText={v => setField('host', v)} placeholder="db.example.com" />
      <Field
        label="Port"
        value={String(draft.port)}
        onChangeText={v => setField('port', parseInt(v, 10) || 0)}
        placeholder="3306"
        keyboardType="numeric"
      />
      <Field label="Database" value={draft.database} onChangeText={v => setField('database', v)} placeholder="keynest" />
      <Field label="User" value={draft.user} onChangeText={v => setField('user', v)} placeholder="keynest" />
      <Field label="Password" value={draft.password} onChangeText={v => setField('password', v)} secureTextEntry placeholder="password" />

      <View style={styles.row}>
        <Text style={styles.rowLabel}>Require SSL</Text>
        <Tooltip label="When on, the connection to MySQL must use TLS">
          <Switch
            value={draft.sslMode === 'REQUIRED'}
            onValueChange={toggleSsl}
            trackColor={{ false: Colors.border, true: Colors.primaryDim }}
            thumbColor={draft.sslMode === 'REQUIRED' ? Colors.primary : Colors.textMuted}
            accessibilityLabel="Require SSL"
          />
        </Tooltip>
      </View>

      <View style={styles.row}>
        <Text style={styles.rowLabel}>Auto-sync on launch</Text>
        <Tooltip label="Pull accounts from MySQL every time the app starts">
          <Switch
            value={draft.autoSync !== false}
            onValueChange={v => setField('autoSync', v)}
            trackColor={{ false: Colors.border, true: Colors.primaryDim }}
            thumbColor={draft.autoSync !== false ? Colors.primary : Colors.textMuted}
            accessibilityLabel="Auto-sync on launch"
          />
        </Tooltip>
      </View>

      {testMsg?.kind === 'err' ? <Text style={styles.error}>{testMsg.text}</Text> : null}
      {testMsg?.kind === 'ok' ? <Text style={styles.success}>{testMsg.text}</Text> : null}
      {saveMsg ? <Text style={styles.success}>{saveMsg}</Text> : null}
      {syncError ? <Text style={styles.error}>{syncError}</Text> : null}

      <Text style={styles.metaLine}>Last sync: {formatWhen(lastSyncAt)}</Text>

      <View style={styles.btnRow}>
        <Tooltip label="Test the connection without saving">
          <TouchableOpacity
            style={[styles.btn, styles.btnSecondary, testing && styles.btnDisabled]}
            onPress={onTest}
            disabled={testing}
            accessibilityRole="button"
            accessibilityLabel="Test connection"
          >
            <Text style={[styles.btnText, { color: Colors.text }]}>{testing ? 'Testing...' : 'Test'}</Text>
          </TouchableOpacity>
        </Tooltip>
        <Tooltip label="Save config after a successful connection test">
          <TouchableOpacity
            style={[styles.btn, styles.btnPrimary, testing && styles.btnDisabled]}
            onPress={onSave}
            disabled={testing}
            accessibilityRole="button"
            accessibilityLabel="Save MySQL config"
          >
            <Text style={styles.btnText}>Save</Text>
          </TouchableOpacity>
        </Tooltip>
      </View>

      <View style={styles.btnRow}>
        <Tooltip label="Pull accounts from MySQL now">
          <TouchableOpacity
            style={[styles.btn, styles.btnSecondary, (isSyncing || !mysqlConfig) && styles.btnDisabled]}
            onPress={onSyncNow}
            disabled={isSyncing || !mysqlConfig}
            accessibilityRole="button"
            accessibilityLabel="Sync now"
          >
            <Text style={[styles.btnText, { color: Colors.text }]}>{isSyncing ? 'Syncing...' : 'Sync now'}</Text>
          </TouchableOpacity>
        </Tooltip>
        <Tooltip label="Remove the saved config from this device">
          <TouchableOpacity
            style={[styles.btn, styles.btnDanger, !mysqlConfig && styles.btnDisabled]}
            onPress={onClear}
            disabled={!mysqlConfig}
            accessibilityRole="button"
            accessibilityLabel="Clear MySQL config"
          >
            <Text style={[styles.btnText, { color: Colors.danger }]}>Clear</Text>
          </TouchableOpacity>
        </Tooltip>
      </View>
    </View>
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
      <Tooltip label={label}>
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
          accessibilityLabel={label}
        />
      </Tooltip>
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
  hint: { fontSize: 13, color: Colors.textSecondary, lineHeight: 18 },
  sectionHint: { fontSize: 13, color: Colors.textSecondary },
  error: { color: Colors.danger, fontSize: 13 },
  success: { color: Colors.accent, fontSize: 13 },
  metaLine: { color: Colors.textMuted, fontSize: 12 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rowLabel: { color: Colors.text, fontSize: 14 },
  btnRow: { flexDirection: 'row', gap: 8 },
  btn: {
    flex: 1, flexDirection: 'row', height: 44,
    borderRadius: Colors.radiusSm, alignItems: 'center', justifyContent: 'center',
  },
  btnPrimary: { backgroundColor: Colors.primary },
  btnSecondary: { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  btnDanger: { borderWidth: 1, borderColor: Colors.danger },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  footer: { alignItems: 'center', gap: 4, marginTop: 16 },
  footerText: { fontSize: 12, color: Colors.textMuted },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  chip: {
    paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: 20, borderWidth: 1, borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  chipActive: { backgroundColor: Colors.primaryDim, borderColor: Colors.primary },
  chipText: { color: Colors.textSecondary, fontSize: 13, fontWeight: '600' },
  chipTextActive: { color: Colors.primary },
});
