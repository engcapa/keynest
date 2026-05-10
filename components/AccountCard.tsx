import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Alert, Platform, Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Colors } from '@/constants/colors';
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

export default function AccountCard({ account }: AccountCardProps) {
  const [code, setCode] = useState(() => generateCode(account));
  const [remaining, setRemaining] = useState(() => getTimeRemaining(account.period));
  const { deleteAccount } = useAccounts();
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
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(code.replace(/\s/g, ''));
      }
    } catch { /* ignore */ }
  }, [code]);

  const handleEdit = useCallback(() => {
    router.push(`/edit/${account.id}` as any);
  }, [account.id]);

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

  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <View style={[styles.avatar, { backgroundColor: avatarColor + '33' }]}>
          <Text style={[styles.avatarText, { color: avatarColor }]}>{initials}</Text>
        </View>
        <View style={styles.info}>
          <Text style={styles.name} numberOfLines={1}>{account.name}</Text>
          {account.issuer ? (
            <Text style={styles.issuer} numberOfLines={1}>{account.issuer}</Text>
          ) : null}
        </View>
        <View style={styles.actions}>
          <TouchableOpacity onPress={handleCopy} style={styles.iconBtn} hitSlop={8}>
            <Ionicons name="copy-outline" size={18} color={Colors.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleEdit} style={styles.iconBtn} hitSlop={8}>
            <Ionicons name="pencil-outline" size={18} color={Colors.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleDelete} style={styles.iconBtn} hitSlop={8}>
            <Ionicons name="trash-outline" size={18} color={Colors.danger} />
          </TouchableOpacity>
        </View>
      </View>

      <TouchableOpacity onPress={handleCopy} activeOpacity={0.7}>
        <Text style={[styles.code, isLow && styles.codeLow]}>
          {formatCode(code)}
        </Text>
      </TouchableOpacity>

      <View style={styles.footer}>
        <Text style={[styles.meta, isLow && { color: Colors.danger }]}>
          {account.type.toUpperCase()} · {account.algorithm} · {remaining}s
        </Text>
        <View style={styles.dotRow}>
          {account.type === 'totp' && (
            <View style={[styles.dot, { backgroundColor: isLow ? Colors.danger : Colors.accent }]} />
          )}
        </View>
      </View>

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
  name: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text,
  },
  issuer: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  actions: {
    flexDirection: 'row',
    gap: 4,
  },
  iconBtn: {
    padding: 6,
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
  meta: {
    fontSize: 11,
    color: Colors.textMuted,
  },
  dotRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
});
