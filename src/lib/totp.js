import * as OTPAuth from 'otpauth'

export function generateTOTP(secret, digits = 6, period = 30, algorithm = 'SHA1') {
  try {
    const totp = new OTPAuth.TOTP({
      secret: OTPAuth.Secret.fromBase32(secret.replace(/\s/g, '').toUpperCase()),
      digits,
      period,
      algorithm,
    })
    return totp.generate()
  } catch {
    return null
  }
}

export function getSecondsRemaining(period = 30) {
  const now = Math.floor(Date.now() / 1000)
  return period - (now % period)
}

export function parseOtpAuthUrl(url) {
  try {
    const parsed = OTPAuth.URI.parse(url)
    if (parsed instanceof OTPAuth.TOTP) {
      return {
        name: parsed.label || 'Account',
        issuer: parsed.issuer || '',
        secret: parsed.secret.base32,
        digits: parsed.digits,
        period: parsed.period,
        algorithm: parsed.algorithm,
      }
    }
    return null
  } catch {
    return null
  }
}

export function validateSecret(secret) {
  try {
    const cleaned = secret.replace(/\s/g, '').toUpperCase()
    OTPAuth.Secret.fromBase32(cleaned)
    return cleaned.length >= 8
  } catch {
    return false
  }
}

const COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#f43f5e',
  '#f97316', '#eab308', '#22c55e', '#14b8a6',
  '#06b6d4', '#3b82f6',
]

export function colorForAccount(name) {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) | 0
  }
  return COLORS[Math.abs(hash) % COLORS.length]
}
