import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Alert, Platform, Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Colors } from '@/constants/colors';
import { Tooltip } from '@/components/Tooltip';
import { generateCode, formatCode, getTimeRemaining, getTimeProgress, getAvatarColor, getInitials } from '@/lib/otp';
import type { OTPAccount } from '@/lib/otp';
import { useAccounts } from '@/contexts/AccountsContext';
import { router } from 'expo-router';

interface AccountCardProps {
  account: OTPAccount;
}

function TimerBar({ period, isLow }: { period: number; isLow: boolean }) {
  const anim = React.useRef(new Animated.Value(getTimeProgress(period))).current;

  useEffect(() => {
    const tick = () => {
      anim.setValue(getTimeProgress(period));
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [period]);

  return (
    <View style={timerStyles.track}>
      <Animated.View style={[timerStyles.fill, {
        backgroundColor: isLow ? Colors.danger : Colors.accent,
        width: anim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
      }]} />
    </View>
  );
}

const timerStyles = StyleSheet.create({
  track: { height: 2, backgroundColor: Colors.border, borderRadius: 1, marginTop: 10, overflow: 'hidden' },
  fill: { height: 2, borderRadius: 1 },
});

function CopiedBadge({ visible }: { visible: boolean }) {
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 150, useNativeDriver: true }),
        Animated.delay(800),
        Animated.timing(opacity, { toValue: 0, duration: 300, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  return (
    <Animated.View style={[badgeStyles.badge, { opacity }]} pointerEvents="none">
      <Ionicons name="checkmark-circle" size={13} color={Colors.accent} />
      <Text style={badgeStyles.text}>Copied</Text>
    </Animated.View>
  );
}

const badgeStyles = StyleSheet.create({
  badge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: Colors.accentDim, borderRadius: 20,
    paddingHorizontal: 10, paddingVertical: 4,
    position: 'absolute', right: 0, top: -2,
  },
  text: { fontSize: 12, color: Colors.accent, fontWeight: '600' },
});

export default function AccountCard({ account }: AccountCardProps) {
  const [code, setCode] = useState(() => generateCode(account));
  const [remaining, setRemaining] = useState(() => getTimeRemaining(account.period));
  const [copyKey, setCopyKey] = useState(0);
  const [showSecret, setShowSecret] = useState(false);
  const { deleteAccount, togglePin } = useAccounts();
  const avatarColor = getAvatarColor(account.name);
  const initials = getInitials(account.name);
  const isLow = remaining <= 5;

  useEffect(() => {
    const update = () => {
      setCode(generateCode(account));
      setRemaining(getTimeRemaining(account.period));
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [account]);

  const handleCopy = useCallback(async () => {
    try {
      if (Platform.OS !== 'web') {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
      const raw = code.replace(/\s/g, '');
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(raw);
      }
      setCopyKey(k => k + 1);
    } catch { /* ignore */ }
  }, [code]);

  const handleEdit = useCallback(() => {
    router.push(`/edit/${account.id}` as any);
  }, [account.id]);

  const handlePin = useCallback(async () => {
    if (Platform.OS !== 'web') {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    await togglePin(account.id);
  }, [account.id, togglePin]);

  const handleDelete = useCallback(() => {
    const doDelete = () => {
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      }
      deleteAccount(account.id);
    };

    if (Platform.OS === 'web') {
      if (window.confirm(`Delete "${account.name}"?`)) doDelete();
    } else {
      Alert.alert('Delete Account', `Remove "${account.name}"?`, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: doDelete },
      ]);
    }
  }, [account, deleteAccount]);

  const formatSecret = (s: string) => {
    return s.replace(/(.{4})/g, '$1 ').trim();
  };

  return (
    <View style={[styles.card, account.pinned && styles.cardPinned]}>
      <View style={styles.row}>
        <View style={[styles.avatar, { backgroundColor: avatarColor + '33' }]}>
          <Text style={[styles.avatarText, { color: avatarColor }]}>{initials}</Text>
        </View>
        <View style={styles.info}>
          <View style={styles.nameRow}>
            <Text style={styles.name} numberOfLines={1}>{account.name}</Text>
            {account.pinned && (
              <Ionicons name="pin" size={11} color={Colors.primary} style={styles.pinBadge} />
            )}
          </View>
          {account.issuer ? (
            <Text style={styles.issuer} numberOfLines={1}>{account.issuer}</Text>
          ) : null}
        </View>
        <View style={styles.actions}>
          <Tooltip label={account.pinned ? 'Unpin account' : 'Pin account to top'}>
            <TouchableOpacity onPress={handlePin} style={styles.iconBtn} hitSlop={8} accessibilityRole="button" accessibilityLabel={account.pinned ? 'Unpin' : 'Pin'}>
              <Ionicons
                name={account.pinned ? 'pin' : 'pin-outline'}
                size={18}
                color={account.pinned ? Colors.primary : Colors.textSecondary}
              />
            </TouchableOpacity>
          </Tooltip>
          <Tooltip label="Copy current code">
            <TouchableOpacity onPress={handleCopy} style={styles.iconBtn} hitSlop={8} accessibilityRole="button" accessibilityLabel="Copy code">
              <Ionicons name="copy-outline" size={18} color={Colors.textSecondary} />
            </TouchableOpacity>
          </Tooltip>
          <Tooltip label="Edit account">
            <TouchableOpacity onPress={handleEdit} style={styles.iconBtn} hitSlop={8} accessibilityRole="button" accessibilityLabel="Edit account">
              <Ionicons name="pencil-outline" size={18} color={Colors.textSecondary} />
            </TouchableOpacity>
          </Tooltip>
          <Tooltip label="Delete account">
            <TouchableOpacity onPress={handleDelete} style={styles.iconBtn} hitSlop={8} accessibilityRole="button" accessibilityLabel="Delete account">
              <Ionicons name="trash-outline" size={18} color={Colors.danger} />
            </TouchableOpacity>
          </Tooltip>
        </View>
      </View>

      <View style={styles.codeWrap}>
        <Tooltip label="Tap to copy">
          <TouchableOpacity onPress={handleCopy} activeOpacity={0.7} style={styles.codeTouchable} accessibilityRole="button" accessibilityLabel="Copy code">
            <Text style={[styles.code, isLow && styles.codeLow]}>
              {formatCode(code)}
            </Text>
          </TouchableOpacity>
        </Tooltip>
        <CopiedBadge key={copyKey} visible={copyKey > 0} />
      </View>

      <View style={styles.footer}>
        <Text style={[styles.meta, isLow && { color: Colors.danger }]}>
          {account.type.toUpperCase()} · {account.algorithm} · {remaining}s
        </Text>
        <View style={styles.footerRight}>
          <Tooltip label={showSecret ? 'Hide secret key' : 'Reveal secret key'}>
            <TouchableOpacity onPress={() => setShowSecret(v => !v)} style={styles.eyeBtn} hitSlop={8} accessibilityRole="button" accessibilityLabel={showSecret ? 'Hide secret' : 'Show secret'}>
              <Ionicons
                name={showSecret ? 'eye-off-outline' : 'eye-outline'}
                size={16}
                color={Colors.textMuted}
              />
            </TouchableOpacity>
          </Tooltip>
          {account.type === 'totp' && (
            <View style={[styles.dot, { backgroundColor: isLow ? Colors.danger : Colors.accent }]} />
          )}
        </View>
      </View>

      {showSecret && (
        <View style={styles.secretBox}>
          <Text style={styles.secretLabel}>Secret Key</Text>
          <Text style={styles.secretValue} selectable>{formatSecret(account.secret)}</Text>
        </View>
      )}

      {account.type === 'totp' && (
        <TimerBar period={account.period} isLow={isLow} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.card,
    borderRadius: Colors.radius,
    padding: 16,
    marginHorizontal: 16,
    marginVertical: 6,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cardPinned: {
    borderColor: Colors.primary + '55',
    backgroundColor: Colors.card,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: {
    fontSize: 15,
    fontWeight: '700',
  },
  info: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  name: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text,
    flexShrink: 1,
  },
  pinBadge: {
    marginTop: 1,
  },
  issuer: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  actions: {
    flexDirection: 'row',
    gap: 2,
  },
  iconBtn: {
    padding: 6,
  },
  codeWrap: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
  },
  codeTouchable: {
    flex: 1,
  },
  code: {
    fontSize: 36,
    fontWeight: '700',
    color: Colors.accent,
    letterSpacing: 4,
    fontVariant: ['tabular-nums'],
  },
  codeLow: {
    color: Colors.danger,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  footerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  meta: {
    fontSize: 11,
    color: Colors.textMuted,
  },
  eyeBtn: {
    padding: 2,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  secretBox: {
    marginTop: 10,
    backgroundColor: Colors.surface,
    borderRadius: Colors.radiusSm,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  secretLabel: {
    fontSize: 10,
    color: Colors.textMuted,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  secretValue: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    letterSpacing: 1,
  },
});
