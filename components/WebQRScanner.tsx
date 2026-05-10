import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Colors } from '@/constants/colors';

type ScannerState = 'initializing' | 'scanning' | 'no-camera' | 'permission-denied' | 'error';

interface WebQRScannerProps {
  onScan: (data: string) => void;
  onClose: () => void;
}

export default function WebQRScanner({ onScan, onClose }: WebQRScannerProps) {
  const [state, setState] = useState<ScannerState>('initializing');
  const [errorMsg, setErrorMsg] = useState('');
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const scannedRef = useRef(false);

  useEffect(() => {
    const scannerId = 'web-qr-reader';
    const scanner = new Html5Qrcode(scannerId);
    scannerRef.current = scanner;

    Html5Qrcode.getCameras()
      .then((cameras) => {
        if (!cameras || cameras.length === 0) {
          setState('no-camera');
          return;
        }
        return scanner.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 240, height: 240 } },
          (decodedText) => {
            if (scannedRef.current) return;
            if (!decodedText.startsWith('otpauth://')) {
              setErrorMsg('Not a valid authenticator QR code');
              setTimeout(() => setErrorMsg(''), 2500);
              return;
            }
            scannedRef.current = true;
            scanner.stop().catch(() => {});
            onScan(decodedText);
          },
          () => {},
        );
      })
      .then(() => {
        if (!scannedRef.current && scannerRef.current?.isScanning) {
          setState('scanning');
        }
      })
      .catch((err: any) => {
        const msg = String(err?.message || err || '');
        if (msg.includes('Permission') || msg.includes('NotAllowed')) {
          setState('permission-denied');
        } else {
          setState('no-camera');
        }
      });

    return () => {
      if (scanner.isScanning) {
        scanner.stop().catch(() => {});
      }
    };
  }, [onScan]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const scanner = scannerRef.current || new Html5Qrcode('web-qr-reader-file');
      const result = await scanner.scanFile(file, false);
      if (!result.startsWith('otpauth://')) {
        setErrorMsg('Not a valid authenticator QR code');
        setTimeout(() => setErrorMsg(''), 2500);
        return;
      }
      onScan(result);
    } catch {
      setErrorMsg('No QR code found in image');
      setTimeout(() => setErrorMsg(''), 2500);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const showUploadOnly = state === 'no-camera' || state === 'permission-denied';

  return (
    <div style={styles.wrapper}>
      {/* Close button */}
      <button onClick={onClose} style={styles.closeBtn} aria-label="Close scanner" title="Close scanner">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>

      {/* Camera preview area */}
      {!showUploadOnly && (
        <div style={styles.cameraArea}>
          <div id="web-qr-reader" ref={containerRef} style={styles.readerContainer} />
          {state === 'initializing' && (
            <div style={styles.overlay}>
              <p style={styles.statusText}>Starting camera...</p>
            </div>
          )}
        </div>
      )}

      {/* Fallback message when no camera */}
      {showUploadOnly && (
        <div style={styles.fallbackArea}>
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke={Colors.textMuted} strokeWidth="1.5">
            <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
            <circle cx="12" cy="13" r="4" />
          </svg>
          <p style={styles.fallbackTitle}>
            {state === 'permission-denied' ? 'Camera permission denied' : 'No camera available'}
          </p>
          <p style={styles.fallbackBody}>Upload a QR code image instead</p>
        </div>
      )}

      {/* Error toast */}
      {errorMsg && <div style={styles.errorToast}>{errorMsg}</div>}

      {/* Bottom toolbar */}
      <div style={styles.toolbar}>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileUpload}
          style={{ display: 'none' }}
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          style={styles.uploadBtn}
          aria-label="Upload QR code image"
          title="Upload a QR code image from your device"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
          <span>Upload Image</span>
        </button>
      </div>

      {/* Hidden container for file scanning */}
      <div id="web-qr-reader-file" style={{ display: 'none' }} />
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrapper: {
    position: 'fixed',
    inset: 0,
    backgroundColor: '#000',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
  },
  closeBtn: {
    position: 'absolute',
    top: 16,
    left: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.6)',
    border: 'none',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    zIndex: 10,
  },
  cameraArea: {
    position: 'relative',
    width: '100%',
    maxWidth: 400,
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  readerContainer: {
    width: '100%',
    maxWidth: 400,
  },
  overlay: {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusText: {
    color: Colors.textSecondary,
    fontSize: 14,
  },
  fallbackArea: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    gap: 12,
  },
  fallbackTitle: {
    color: Colors.text,
    fontSize: 18,
    fontWeight: '700',
    margin: 0,
  },
  fallbackBody: {
    color: Colors.textSecondary,
    fontSize: 14,
    margin: 0,
  },
  errorToast: {
    position: 'absolute',
    bottom: 100,
    left: '50%',
    transform: 'translateX(-50%)',
    backgroundColor: Colors.dangerDim,
    color: Colors.danger,
    padding: '10px 20px',
    borderRadius: 8,
    fontSize: 13,
    fontWeight: '600',
  },
  toolbar: {
    padding: '20px 0 40px',
    display: 'flex',
    justifyContent: 'center',
  },
  uploadBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.card,
    color: Colors.text,
    border: `1px solid ${Colors.border}`,
    borderRadius: 10,
    padding: '12px 24px',
    fontSize: 15,
    fontWeight: '600',
    cursor: 'pointer',
  },
};
