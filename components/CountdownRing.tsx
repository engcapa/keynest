import React, { useEffect, useRef } from 'react';
import { Animated, View, Text, StyleSheet, Platform } from 'react-native';
import { Colors } from '@/constants/colors';
import { getTimeRemaining, getTimeProgress } from '@/lib/otp';

interface CountdownRingProps {
  period: number;
  size?: number;
}

export function CountdownRing({ period, size = 44 }: CountdownRingProps) {
  const remaining = getTimeRemaining(period);
  const progress = getTimeProgress(period);
  const isLow = remaining <= 5;
  const color = isLow ? Colors.danger : Colors.accent;

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <View style={[styles.track, {
        width: size,
        height: size,
        borderRadius: size / 2,
        borderColor: Colors.border,
        borderWidth: 3,
      }]}>
        <View style={[styles.fill, {
          borderColor: color,
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: 3,
          opacity: progress,
        }]} />
      </View>
      <View style={styles.textContainer}>
        <Text style={[styles.text, { color, fontSize: size / 3 }]}>
          {remaining}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  track: {
    position: 'absolute',
  },
  fill: {
    position: 'absolute',
  },
  textContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontWeight: '700',
  },
});
