import React, { useState, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform,
  Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Redirect } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';
import { useAuth } from '@/contexts/AuthContext';

export default function LoginScreen() {
  const { isAuthenticated, hasPassword, login, setupPassword } = useAuth();
  const insets = useSafeAreaInsets();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const shakeAnim = useRef(new Animated.Value(0)).current;

  if (isAuthenticated && hasPassword) {
    return <Redirect href="/(tabs)" />;
  }

  const shake = () => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 6, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -6, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 60, useNativeDriver: true }),
    ]).start();
  };

  const handleSubmit = async () => {
    setError('');
    if (!password.trim()) { setError('Password cannot be empty'); return; }

    if (!hasPassword) {
      if (password.length < 4) { setError('Password must be at least 4 characters'); return; }
      if (password !== confirm) { setError('Passwords do not match'); shake(); return; }
      setLoading(true);
      await setupPassword(password);
      setLoading(false);
      return;
    }

    setLoading(true);
    const ok = await login(password);
    setLoading(false);
    if (!ok) {
      setError('Incorrect password');
      shake();
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    }
  };

  const topInset = Platform.OS === 'web' ? 67 : insets.top;

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: topInset }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.inner}>
        <View style={styles.logoWrap}>
          <View style={styles.logoCircle}>
            <Ionicons name="shield-checkmark" size={42} color={Colors.primary} />
          </View>
          <Text style={styles.appName}>MFA Vault</Text>
          <Text style={styles.subtitle}>
            {hasPassword ? 'Enter your password to unlock' : 'Create a password to protect your codes'}
          </Text>
        </View>

        <Animated.View style={[styles.form, { transform: [{ translateX: shakeAnim }] }]}>
          <View style={styles.inputWrap}>
            <Ionicons name="lock-closed-outline" size={18} color={Colors.textSecondary} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              placeholder="Password"
              placeholderTextColor={Colors.textMuted}
              secureTextEntry={!showPass}
              autoFocus
              returnKeyType={!hasPassword ? 'next' : 'done'}
              onSubmitEditing={hasPassword ? handleSubmit : undefined}
            />
            <TouchableOpacity onPress={() => setShowPass(p => !p)} hitSlop={8}>
              <Ionicons name={showPass ? 'eye-off-outline' : 'eye-outline'} size={18} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {!hasPassword && (
            <View style={styles.inputWrap}>
              <Ionicons name="lock-closed-outline" size={18} color={Colors.textSecondary} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                value={confirm}
                onChangeText={setConfirm}
                placeholder="Confirm password"
                placeholderTextColor={Colors.textMuted}
                secureTextEntry={!showPass}
                returnKeyType="done"
                onSubmitEditing={handleSubmit}
              />
            </View>
          )}

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <TouchableOpacity
            style={[styles.btn, loading && styles.btnDisabled]}
            onPress={handleSubmit}
            disabled={loading}
            activeOpacity={0.8}
          >
            <Text style={styles.btnText}>
              {loading ? 'Please wait...' : hasPassword ? 'Unlock' : 'Create Password'}
            </Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  inner: { flex: 1, paddingHorizontal: 32, justifyContent: 'center' },
  logoWrap: { alignItems: 'center', marginBottom: 48 },
  logoCircle: {
    width: 90, height: 90, borderRadius: 24,
    backgroundColor: Colors.card,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: Colors.border,
    marginBottom: 20,
  },
  appName: { fontSize: 28, fontWeight: '700', color: Colors.text, fontFamily: 'Inter_700Bold' },
  subtitle: { fontSize: 14, color: Colors.textSecondary, marginTop: 8, textAlign: 'center' },
  form: { gap: 12 },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.card, borderRadius: Colors.radiusSm,
    borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: 14, height: 52,
  },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, color: Colors.text, fontSize: 16 },
  error: { color: Colors.danger, fontSize: 13, textAlign: 'center' },
  btn: {
    backgroundColor: Colors.primary, borderRadius: Colors.radiusSm,
    height: 52, alignItems: 'center', justifyContent: 'center',
    marginTop: 4,
  },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '700', fontFamily: 'Inter_700Bold' },
});
