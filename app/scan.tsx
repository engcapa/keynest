import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';

let CameraView: any = null;
let useCameraPermissions: any = null;
let WebQRScanner: any = null;

if (Platform.OS !== 'web') {
  const CameraModule = require('expo-camera');
  CameraView = CameraModule.CameraView;
  useCameraPermissions = CameraModule.useCameraPermissions;
} else {
  WebQRScanner = require('@/components/WebQRScanner').default;
}

function NativeScanner() {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const insets = useSafeAreaInsets();

  if (!permission) {
    return (
      <View style={styles.center}>
        <Text style={styles.fallbackBody}>Loading camera...</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.center}>
        <Ionicons name="camera-outline" size={48} color={Colors.textMuted} />
        <Text style={styles.fallbackTitle}>Camera Permission Required</Text>
        <Text style={styles.fallbackBody}>Allow camera access to scan QR codes</Text>
        <TouchableOpacity style={styles.permBtn} onPress={requestPermission}>
          <Text style={styles.permBtnText}>Allow Camera</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const handleBarCodeScanned = ({ data }: { data: string }) => {
    if (scanned) return;
    if (!data.startsWith('otpauth://')) {
      return;
    }
    setScanned(true);
    router.replace({ pathname: '/add', params: { uri: data } } as any);
  };

  return (
    <View style={{ flex: 1 }}>
      <CameraView
        style={StyleSheet.absoluteFillObject}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={handleBarCodeScanned}
      />
      <View style={[styles.overlay, { paddingTop: insets.top + 16 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.closeBtn}>
          <Ionicons name="close" size={24} color="#fff" />
        </TouchableOpacity>
      </View>
      <View style={styles.scanFrame}>
        <View style={styles.scanBox}>
          <View style={[styles.corner, styles.cornerTL]} />
          <View style={[styles.corner, styles.cornerTR]} />
          <View style={[styles.corner, styles.cornerBL]} />
          <View style={[styles.corner, styles.cornerBR]} />
        </View>
        <Text style={styles.scanHint}>Point at a QR code to scan</Text>
      </View>
    </View>
  );
}

export default function ScanScreen() {
  if (Platform.OS === 'web') {
    return (
      <View style={styles.container}>
        <WebQRScanner
          onScan={(data: string) => {
            router.replace({ pathname: '/add', params: { uri: data } } as any);
          }}
          onClose={() => router.back()}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <NativeScanner />
    </View>
  );
}

const CORNER_SIZE = 24;
const CORNER_THICKNESS = 4;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  center: {
    flex: 1, backgroundColor: Colors.background,
    alignItems: 'center', justifyContent: 'center', padding: 40,
  },
  fallbackTitle: { fontSize: 18, fontWeight: '700', color: Colors.text, marginTop: 16 },
  fallbackBody: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center', marginTop: 8, lineHeight: 20 },
  permBtn: {
    marginTop: 20, backgroundColor: Colors.primary,
    paddingHorizontal: 28, paddingVertical: 12, borderRadius: Colors.radiusSm,
  },
  permBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, padding: 16 },
  closeBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center', justifyContent: 'center',
  },
  scanFrame: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center', justifyContent: 'center',
  },
  scanBox: { width: 240, height: 240, position: 'relative', marginBottom: 24 },
  scanHint: { color: '#fff', fontSize: 14, fontWeight: '600' },
  corner: { position: 'absolute', width: CORNER_SIZE, height: CORNER_SIZE, borderColor: Colors.accent },
  cornerTL: { top: 0, left: 0, borderTopWidth: CORNER_THICKNESS, borderLeftWidth: CORNER_THICKNESS },
  cornerTR: { top: 0, right: 0, borderTopWidth: CORNER_THICKNESS, borderRightWidth: CORNER_THICKNESS },
  cornerBL: { bottom: 0, left: 0, borderBottomWidth: CORNER_THICKNESS, borderLeftWidth: CORNER_THICKNESS },
  cornerBR: { bottom: 0, right: 0, borderBottomWidth: CORNER_THICKNESS, borderRightWidth: CORNER_THICKNESS },
});
