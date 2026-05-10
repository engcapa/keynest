import * as OTPAuth from 'otpauth';

export type OTPAlgorithm = 'SHA1' | 'SHA256' | 'SHA512';
export type OTPType = 'totp' | 'hotp';

export interface OTPAccount {
  id: string;
  uri: string;
  name: string;
  issuer: string;
  secret: string;
  algorithm: OTPAlgorithm;
  digits: 6 | 8;
  period: number;
  type: OTPType;
  counter: number;
  pinned: boolean;
  createdAt: string;
  updatedAt: string;
}

export function parseOtpUri(uri: string): Partial<OTPAccount> | null {
  try {
    if (uri.startsWith('otpauth://totp/')) {
      const totp = OTPAuth.TOTP.parse(uri);
      return {
        uri,
        name: totp.label || totp.issuer || 'Unknown',
        issuer: totp.issuer || '',
        secret: totp.secret.base32,
        algorithm: (totp.algorithm as OTPAlgorithm) || 'SHA1',
        digits: (totp.digits as 6 | 8) || 6,
        period: totp.period || 30,
        type: 'totp',
        counter: 0,
        pinned: false,
      };
    } else if (uri.startsWith('otpauth://hotp/')) {
      const hotp = OTPAuth.HOTP.parse(uri);
      return {
        uri,
        name: hotp.label || hotp.issuer || 'Unknown',
        issuer: hotp.issuer || '',
        secret: hotp.secret.base32,
        algorithm: (hotp.algorithm as OTPAlgorithm) || 'SHA1',
        digits: (hotp.digits as 6 | 8) || 6,
        period: 30,
        type: 'hotp',
        counter: hotp.counter || 0,
        pinned: false,
      };
    }
    return null;
  } catch {
    return null;
  }
}

export function buildOtpUri(account: Partial<OTPAccount>): string {
  const type = account.type || 'totp';
  const label = encodeURIComponent(account.name || 'Account');
  const secret = account.secret || '';
  const issuer = encodeURIComponent(account.issuer || '');
  const algorithm = account.algorithm || 'SHA1';
  const digits = account.digits || 6;
  const period = account.period || 30;

  let uri = `otpauth://${type}/${label}?secret=${secret}&algorithm=${algorithm}&digits=${digits}`;
  if (issuer) uri += `&issuer=${issuer}`;
  if (type === 'totp') uri += `&period=${period}`;
  if (type === 'hotp') uri += `&counter=${account.counter || 0}`;
  return uri;
}

export function generateCode(account: OTPAccount): string {
  try {
    const secret = OTPAuth.Secret.fromBase32(account.secret);
    if (account.type === 'totp') {
      const totp = new OTPAuth.TOTP({
        secret,
        algorithm: account.algorithm,
        digits: account.digits,
        period: account.period,
      });
      return totp.generate();
    } else {
      const hotp = new OTPAuth.HOTP({
        secret,
        algorithm: account.algorithm,
        digits: account.digits,
        counter: account.counter,
      });
      return hotp.generate();
    }
  } catch {
    return '------';
  }
}

export function formatCode(code: string): string {
  if (code.length === 6) {
    return code.slice(0, 3) + ' ' + code.slice(3);
  } else if (code.length === 8) {
    return code.slice(0, 4) + ' ' + code.slice(4);
  }
  return code;
}

export function getTimeRemaining(period: number = 30): number {
  const epoch = Math.floor(Date.now() / 1000);
  return period - (epoch % period);
}

export function getTimeProgress(period: number = 30): number {
  const remaining = getTimeRemaining(period);
  return remaining / period;
}

export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

export function getAvatarColor(name: string): string {
  const colors = [
    '#4B8BFF', '#FF6B6B', '#FFD93D', '#6BCB77',
    '#9B59B6', '#E67E22', '#1ABC9C', '#E91E63',
    '#00BCD4', '#FF5722', '#607D8B', '#795548',
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

export function getInitials(name: string): string {
  const parts = name.trim().split(/[\s:@_-]+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}
