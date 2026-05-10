# Key Nest

A multi-factor authentication (MFA) authenticator app that works as both an Android/mobile app (Expo) and a web application.

## Features

- **TOTP & HOTP support** — compatible with Google Authenticator and all standard algorithms (SHA1, SHA256, SHA512)
- **QR code scanning** — scan QR codes on Android to add accounts instantly
- **Manual entry** — add accounts by entering the secret key and parameters
- **Local storage** — accounts saved locally (AsyncStorage) for offline use on mobile
- **MySQL sync** — optionally configure a remote MySQL database for backup and multi-device access
- **Password protection** — app requires password on every open
- **Search & sort** — find accounts quickly; sort by name, issuer, or date added
- **Rename & delete** — full CRUD for managing accounts
- **Live countdown** — real-time timer showing when each code refreshes

## Architecture

- **Frontend**: Expo (React Native + Web) running on port 8081
- **Backend**: Express.js API server running on port 3000
- **Local DB**: AsyncStorage (for offline mobile use)
- **Remote DB**: MySQL (optional, configured via `keynest.config.json` on the server)

## Workflows

- `Start Frontend` — starts the Expo dev server (port 8081)
- `Start Backend` — starts the Express API server (port 3000)

## Project Structure

```
app/               # Expo Router screens
  (auth)/          # Login/setup screen
  (tabs)/          # Main tabs (Accounts + Settings)
  add.tsx          # Add new account modal
  scan.tsx         # QR code scanner
  edit/[id].tsx    # Edit account modal
components/        # Shared UI components
contexts/          # React context providers (Auth, Accounts)
constants/         # Color theme
hooks/             # Custom hooks
lib/               # Utilities (OTP generation, storage, API client)
server/            # Express.js backend
  routes/          # API route handlers
  db.ts            # MySQL connection management
assets/images/     # App icon
```

## User Preferences

- Dark theme (deep navy blue: #0A0B14)
- OTP codes displayed in teal-green (#00DFA0), large and prominent
- Clean, minimal UI inspired by professional security tools
- Code shown as groups with spaces (e.g., "123 456")
