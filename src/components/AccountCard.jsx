import { useState, useEffect, useCallback } from 'react'
import { generateTOTP, getSecondsRemaining, colorForAccount } from '../lib/totp.js'

function TrashIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/>
    </svg>
  )
}

function CopyIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2"/>
      <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6L9 17l-5-5"/>
    </svg>
  )
}

export default function AccountCard({ account, onDelete }) {
  const { id, name, issuer, secret, digits = 6, period = 30, algorithm = 'SHA1' } = account
  const [otp, setOtp] = useState('')
  const [secondsLeft, setSecondsLeft] = useState(0)
  const [copied, setCopied] = useState(false)

  const refresh = useCallback(() => {
    const code = generateTOTP(secret, digits, period, algorithm)
    if (code) setOtp(code)
    setSecondsLeft(getSecondsRemaining(period))
  }, [secret, digits, period, algorithm])

  useEffect(() => {
    refresh()
    const tick = setInterval(() => {
      const secs = getSecondsRemaining(period)
      setSecondsLeft(secs)
      if (secs === period) {
        const code = generateTOTP(secret, digits, period, algorithm)
        if (code) setOtp(code)
      }
    }, 1000)
    return () => clearInterval(tick)
  }, [refresh, secret, digits, period, algorithm])

  const handleCopy = async () => {
    if (!otp) return
    try {
      await navigator.clipboard.writeText(otp)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }

  const progress = (secondsLeft / period) * 100
  const urgent = secondsLeft <= 5

  const initial = (issuer || name || '?')[0].toUpperCase()
  const color = colorForAccount(issuer || name)

  const formatted = otp
    ? digits === 6
      ? otp.slice(0, 3) + ' ' + otp.slice(3)
      : otp
    : '--- ---'

  return (
    <div className="account-card">
      <div className="account-header">
        <div className="account-info">
          <div className="account-avatar" style={{ background: color }}>
            {initial}
          </div>
          <div>
            <div className="account-name">{issuer || name}</div>
            {issuer && <div className="account-issuer">{name}</div>}
          </div>
        </div>
        <div className="account-actions">
          <button
            className="btn-icon danger"
            onClick={() => onDelete(id)}
            title="Remove account"
          >
            <TrashIcon />
          </button>
        </div>
      </div>

      <div className="otp-display">
        <div className="otp-code">{formatted}</div>
        <button
          className={`otp-copy-btn${copied ? ' copied' : ''}`}
          onClick={handleCopy}
          title="Copy code"
        >
          {copied ? <CheckIcon /> : <CopyIcon />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>

      <div className="progress-bar-wrap">
        <div
          className={`progress-bar${urgent ? ' urgent' : ''}`}
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  )
}
