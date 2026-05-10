import { useState } from 'react'
import { validateSecret, parseOtpAuthUrl } from '../lib/totp.js'

function CloseIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M18 6L6 18M6 6l12 12"/>
    </svg>
  )
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2)
}

export default function AddAccountModal({ onAdd, onClose }) {
  const [mode, setMode] = useState('manual')
  const [otpUrl, setOtpUrl] = useState('')
  const [name, setName] = useState('')
  const [issuer, setIssuer] = useState('')
  const [secret, setSecret] = useState('')
  const [digits, setDigits] = useState(6)
  const [period, setPeriod] = useState(30)
  const [algorithm, setAlgorithm] = useState('SHA1')
  const [error, setError] = useState('')

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) onClose()
  }

  const handleUrlParse = () => {
    const parsed = parseOtpAuthUrl(otpUrl.trim())
    if (!parsed) {
      setError('Invalid otpauth:// URL. Please check and try again.')
      return
    }
    setError('')
    setName(parsed.name)
    setIssuer(parsed.issuer)
    setSecret(parsed.secret)
    setDigits(parsed.digits)
    setPeriod(parsed.period)
    setAlgorithm(parsed.algorithm)
    setMode('manual')
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    setError('')

    if (!name.trim()) {
      setError('Account name is required.')
      return
    }

    if (!validateSecret(secret)) {
      setError('Invalid secret key. Must be a valid Base32 string (at least 8 characters).')
      return
    }

    onAdd({
      id: generateId(),
      name: name.trim(),
      issuer: issuer.trim(),
      secret: secret.replace(/\s/g, '').toUpperCase(),
      digits: Number(digits),
      period: Number(period),
      algorithm,
    })
  }

  return (
    <div className="modal-overlay" onClick={handleOverlayClick}>
      <div className="modal">
        <div className="modal-header">
          <div className="modal-title">Add Account</div>
          <button className="modal-close" onClick={onClose}>
            <CloseIcon />
          </button>
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
          <button
            style={{
              flex: 1,
              padding: '8px',
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 600,
              background: mode === 'manual' ? 'var(--accent)' : 'var(--bg3)',
              color: mode === 'manual' ? '#fff' : 'var(--text)',
              border: '1px solid',
              borderColor: mode === 'manual' ? 'var(--accent)' : 'var(--border)',
              cursor: 'pointer',
            }}
            onClick={() => setMode('manual')}
          >
            Manual entry
          </button>
          <button
            style={{
              flex: 1,
              padding: '8px',
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 600,
              background: mode === 'url' ? 'var(--accent)' : 'var(--bg3)',
              color: mode === 'url' ? '#fff' : 'var(--text)',
              border: '1px solid',
              borderColor: mode === 'url' ? 'var(--accent)' : 'var(--border)',
              cursor: 'pointer',
            }}
            onClick={() => setMode('url')}
          >
            OTP URL
          </button>
        </div>

        {mode === 'url' ? (
          <div className="form">
            <div className="field">
              <label>otpauth:// URL</label>
              <input
                type="text"
                placeholder="otpauth://totp/Example:user@email.com?secret=..."
                value={otpUrl}
                onChange={e => setOtpUrl(e.target.value)}
                autoFocus
              />
              <span className="field-hint">Paste the full OTP auth URL from your service.</span>
            </div>
            {error && <div className="error-msg">{error}</div>}
            <div className="form-actions">
              <button className="btn-secondary" onClick={onClose}>Cancel</button>
              <button className="btn-primary" onClick={handleUrlParse}>Parse URL</button>
            </div>
          </div>
        ) : (
          <form className="form" onSubmit={handleSubmit}>
            <div className="field">
              <label>Account name *</label>
              <input
                type="text"
                placeholder="user@example.com"
                value={name}
                onChange={e => setName(e.target.value)}
                autoFocus={mode === 'manual'}
              />
            </div>

            <div className="field">
              <label>Issuer / Service</label>
              <input
                type="text"
                placeholder="Google, GitHub, etc."
                value={issuer}
                onChange={e => setIssuer(e.target.value)}
              />
            </div>

            <div className="field">
              <label>Secret key *</label>
              <input
                type="text"
                placeholder="JBSWY3DPEHPK3PXP"
                value={secret}
                onChange={e => setSecret(e.target.value)}
                style={{ fontFamily: 'ui-monospace, monospace', letterSpacing: '1px' }}
              />
              <span className="field-hint">Base32 encoded secret from your provider.</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
              <div className="field">
                <label>Digits</label>
                <select value={digits} onChange={e => setDigits(Number(e.target.value))}>
                  <option value={6}>6</option>
                  <option value={8}>8</option>
                </select>
              </div>
              <div className="field">
                <label>Period (s)</label>
                <select value={period} onChange={e => setPeriod(Number(e.target.value))}>
                  <option value={30}>30</option>
                  <option value={60}>60</option>
                </select>
              </div>
              <div className="field">
                <label>Algorithm</label>
                <select value={algorithm} onChange={e => setAlgorithm(e.target.value)}>
                  <option value="SHA1">SHA1</option>
                  <option value="SHA256">SHA256</option>
                  <option value="SHA512">SHA512</option>
                </select>
              </div>
            </div>

            {error && <div className="error-msg">{error}</div>}

            <div className="form-actions">
              <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
              <button type="submit" className="btn-primary">Add account</button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
