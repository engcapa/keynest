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
  syncedAt?: string;
}

export function parseOtpUri(uri: string): Partial<OTPAccount> | null {
  try {
    const parsed = OTPAuth.URI.parse(uri);
    if (parsed instanceof OTPAuth.TOTP) {
      return {
        uri,
        name: parsed.label || parsed.issuer || 'Unknown',
        issuer: parsed.issuer || '',
        secret: parsed.secret.base32,
        algorithm: (parsed.algorithm as OTPAlgorithm) || 'SHA1',
        digits: (parsed.digits as 6 | 8) || 6,
        period: parsed.period || 30,
        type: 'totp',
        counter: 0,
        pinned: false,
      };
    } else if (parsed instanceof OTPAuth.HOTP) {
      return {
        uri,
        name: parsed.label || parsed.issuer || 'Unknown',
        issuer: parsed.issuer || '',
        secret: parsed.secret.base32,
        algorithm: (parsed.algorithm as OTPAlgorithm) || 'SHA1',
        digits: (parsed.digits as 6 | 8) || 6,
        period: 30,
        type: 'hotp',
        counter: parsed.counter || 0,
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

export async function deterministicId(params: {
  secret: string;
  algorithm: OTPAlgorithm;
  type: OTPType;
  digits: 6 | 8;
  period: number;
}): Promise<string> {
  const normalizedSecret = (params.secret || '').replace(/\s/g, '').toUpperCase();
  const input = `${normalizedSecret}|${params.algorithm}|${params.type}|${params.digits}|${params.period}`;
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const encoder = new TextEncoder();
    const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(input));
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hex.slice(0, 32);
  }
  let h1 = 5381;
  let h2 = 52711;
  for (let i = 0; i < input.length; i++) {
    const c = input.charCodeAt(i);
    h1 = (((h1 << 5) + h1) ^ c) >>> 0;
    h2 = (((h2 << 5) + h2) + c) >>> 0;
  }
  return (h1.toString(16).padStart(8, '0') + h2.toString(16).padStart(8, '0')).repeat(2).slice(0, 32);
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
