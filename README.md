# Key Nest

A professional multi-factor authentication (MFA) app that works as both an Android mobile app and a web application. Built with Expo (React Native) and an optional Express.js backend for remote sync.

## Features

- **TOTP & HOTP support** — compatible with Google Authenticator and all standard OTP algorithms (SHA1, SHA256, SHA512)
- **QR code scanning** — scan `otpauth://` QR codes on Android to add accounts instantly
- **Manual entry** — add accounts by entering the secret key and configuring parameters
- **Pin / Top accounts** — pin multiple accounts to the top of the list; pinned accounts are sorted among themselves by the active sort rule
- **Tap to copy** — tap the OTP code to copy it to the clipboard, with visual confirmation
- **View secret key** — reveal the raw Base32 secret for any account directly in the card
- **Local storage** — accounts saved in AsyncStorage for fully offline use on mobile
- **MySQL sync** — optionally connect a remote MySQL database for backup and multi-device access
- **Password protection** — app requires a password on every open
- **Search & sort** — find accounts quickly; sort by name, issuer, or date added
- **Rename & delete** — full CRUD management of accounts
- **Live countdown** — real-time timer and progress bar showing when each OTP code refreshes
- **Dark theme** — deep navy blue UI with teal-green OTP codes

## Tech Stack

| Layer | Technology |
|---|---|
| Mobile / Web frontend | Expo 52 (React Native + Web via Metro) |
| Navigation | Expo Router 4 |
| OTP engine | `otpauth` library |
| Local storage | AsyncStorage + expo-secure-store |
| Remote sync | Express.js API + MySQL 2 |
| Language | TypeScript |

## Getting Started

### Prerequisites

- Node.js 18+
- pnpm, npm, or yarn
- (Optional) Android device or emulator for mobile
- (Optional) MySQL 8+ server for remote sync

### Install dependencies

```bash
npm install
```

### Run the frontend (Expo)

```bash
npm start          # Expo DevTools (choose web / Android)
npm run web        # Web only on port 8081
npm run android    # Android device / emulator
```

### Run the backend (optional)

```bash
npm run server     # Express API on port 5000
```

The backend is only needed for MySQL sync. If you use the app in local-only mode, you can skip it.

### Environment variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `5000` | Port the Express server listens on |

## Project Structure

```
app/
  (auth)/          Login / setup screen
  (tabs)/          Main tabs (Accounts + Settings)
  add.tsx          Add new account modal
  scan.tsx         QR code scanner (Android)
  edit/[id].tsx    Edit / view account modal
components/
  AccountCard.tsx  OTP card with copy, pin, view-key actions
  CountdownRing.tsx  Circular countdown indicator
contexts/
  AccountsContext.tsx  Accounts state, sort, pin, sync
  AuthContext.tsx      Password auth state
constants/
  colors.ts        Design token palette
lib/
  otp.ts           TOTP/HOTP generation, parsing, formatting
  storage.ts       AsyncStorage + SecureStore helpers
  query-client.ts  API request helper
server/
  index.ts         Express entry point
  db.ts            MySQL connection management
  routes/
    accounts.ts    CRUD API for accounts
    settings.ts    MySQL config test endpoint
```

## MySQL Schema

Run this once on your MySQL server:

```sql
CREATE DATABASE IF NOT EXISTS keynest;
USE keynest;

CREATE TABLE IF NOT EXISTS mfa_accounts (
  id          VARCHAR(36)  NOT NULL PRIMARY KEY,
  uri         TEXT,
  name        VARCHAR(255) NOT NULL,
  issuer      VARCHAR(255) DEFAULT '',
  secret      TEXT         NOT NULL,
  algorithm   VARCHAR(10)  DEFAULT 'SHA1',
  digits      INT          DEFAULT 6,
  period      INT          DEFAULT 30,
  type        VARCHAR(10)  DEFAULT 'totp',
  counter     INT          DEFAULT 0,
  pinned      TINYINT(1)   DEFAULT 0,
  created_at  DATETIME     DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

## Releases

Pre-built binaries are published via GitHub Actions on every tagged release (`v*`):

| Platform | Architecture | Asset |
|---|---|---|
| Linux | x86_64 (amd64) | `keynest-server-linux-x64` |
| Linux | AArch64 (arm64) | `keynest-server-linux-arm64` |
| macOS | x86_64 | `keynest-server-macos-x64` |
| macOS | Apple Silicon | `keynest-server-macos-arm64` |
| Windows 10+ | x86_64 | `keynest-server-win-x64.exe` |
| Windows 10+ | AArch64 | `keynest-server-win-arm64.exe` |
| Android | universal | `keynest.apk` |

## License

MIT — see [LICENSE](LICENSE) for details.
