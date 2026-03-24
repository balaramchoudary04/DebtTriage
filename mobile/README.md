# DebtTriage — Expo React Native App

A mobile debt management app for iOS (and Android) built with Expo SDK 52, TypeScript, and expo-router. Track debts, compare payoff strategies, screen balance transfers/consolidation options, simulate credit score improvements, and generate creditor letters — all stored locally with SQLite.

---

## Prerequisites

- **Node.js** 18+ — [nodejs.org](https://nodejs.org)
- **npm** 9+ (comes with Node.js)
- **Expo CLI** — installed automatically via `npx expo`
- **For iOS Simulator**: Xcode 15+ from the Mac App Store (macOS only)
- **For physical iPhone**: [Expo Go](https://apps.apple.com/app/expo-go/id982107779) from the App Store

---

## Installation & Local Development

```bash
# 1. Navigate into the project
cd DebtTriageApp

# 2. Install dependencies
npm install

# 3. Start the development server
npx expo start
```

The Metro bundler will start and show a QR code in the terminal.

---

## Running on Device / Simulator

### iPhone via Expo Go (easiest, no account needed)

1. Install **Expo Go** from the App Store on your iPhone
2. Make sure your iPhone and Mac are on the **same Wi-Fi network**
3. Run `npx expo start`
4. Open the Camera app on your iPhone and scan the QR code shown in the terminal
5. The app will open in Expo Go

### iOS Simulator (Mac only)

1. Install Xcode from the Mac App Store
2. Open Xcode at least once to accept the license agreement
3. Run `npx expo start --ios` or press `i` in the Expo CLI

### Android Emulator

1. Install Android Studio and set up an AVD (Android Virtual Device)
2. Run `npx expo start --android` or press `a` in the Expo CLI

---

## Testing with Sample Data

Once the app launches:

1. Tap **My Debts** (bottom tab)
2. Tap **+ Add** to add your first debt
3. Fill in name, type, balance, APR, minimum payment
4. Tap **Save**

Repeat for 2–3 debts to see the Dashboard, Payoff Plans, and Transfer screens populate with real data.

---

## Building for TestFlight (iOS Distribution)

### Requirements

- An **Apple Developer Account** ($99/year) — [developer.apple.com](https://developer.apple.com)
- **EAS CLI** installed globally

### Setup EAS Build

```bash
# Install EAS CLI globally
npm install -g eas-cli

# Log in to your Expo account (create one free at expo.dev)
eas login

# Initialize EAS in the project
eas build:configure
```

### Build for iOS (TestFlight)

```bash
# Build an IPA for App Store distribution
eas build --platform ios --profile production
```

EAS Build runs in the cloud — no Xcode required on your machine.

After the build completes (typically 10–20 minutes), download the `.ipa` from [expo.dev](https://expo.dev) and upload it to App Store Connect using **Transporter** or **Xcode**.

### Submit to TestFlight

1. Log in to [App Store Connect](https://appstoreconnect.apple.com)
2. Create a new app with bundle ID `com.debttriage.app`
3. Upload the `.ipa` via Transporter
4. Go to **TestFlight** tab and add testers by email

> **Note**: Apple requires all apps to have a valid App Store Connect account, a bundle ID registered in your developer account, and App Store review for public TestFlight distribution.

---

## Project Structure

```
DebtTriageApp/
├── app/
│   ├── _layout.tsx           Root layout (DebtProvider, SafeArea, GestureHandler)
│   └── (tabs)/
│       ├── _layout.tsx       Tab bar with 6 tabs
│       ├── index.tsx         Dashboard — KPI cards, alerts, payoff summary
│       ├── debts.tsx         My Debts — add/edit/delete debts, paste statement
│       ├── payoff.tsx        Payoff Plans — Avalanche vs Snowball with chart
│       ├── transfer.tsx      Transfer & Consolidation options
│       ├── score.tsx         Score Simulator — gauge, utilization, action items
│       └── letters.tsx       Letter Generator — dispute/hardship/goodwill
├── src/
│   ├── types.ts              TypeScript interfaces for all domain objects
│   ├── database.ts           expo-sqlite SDK 52 database layer
│   ├── calculations.ts       Financial calculation engine (ported from web)
│   ├── DebtContext.tsx       React context + state management
│   └── theme.ts              Colors, typography, spacing, useTheme hook
├── assets/
│   ├── icon.png              App icon (1024×1024)
│   └── splash.png            Splash screen
├── app.json                  Expo configuration
├── package.json              Dependencies
└── tsconfig.json             TypeScript config
```

---

## Key Features

| Feature | Description |
|---|---|
| **Dashboard** | Total debt, monthly minimums, highest APR, credit utilization |
| **My Debts** | Full CRUD for debts with utilization bars for credit cards |
| **Paste Statement** | Auto-parse balance/APR/minimum from pasted statement text |
| **Payoff Plans** | Avalanche and Snowball strategies with balance chart |
| **Extra Payments** | Slider to see impact of extra monthly payments |
| **Balance Transfers** | Screen 6 real 0% APR offers with savings estimate |
| **Loan Consolidation** | Screen 5 personal loan lenders for debt consolidation |
| **Score Simulator** | Ranked actions with point impact estimates |
| **Paydown Simulator** | See how a lump sum affects credit utilization |
| **Letter Generator** | Generate dispute, hardship, and goodwill letters |
| **Dark Mode** | Full dark mode support via `useColorScheme()` |
| **Local Storage** | All data stored on-device with expo-sqlite (no account required) |

---

## Environment & Dependencies

| Package | Version | Purpose |
|---|---|---|
| expo | ~52.0.0 | Core SDK |
| expo-router | ~4.0.0 | File-based routing |
| expo-sqlite | ~15.0.0 | Local SQLite database |
| expo-clipboard | ~7.0.0 | Copy letters to clipboard |
| expo-sharing | ~13.0.0 | Share letter files |
| expo-file-system | ~18.0.0 | Write letter files for sharing |
| expo-haptics | ~14.0.0 | Tactile feedback |
| react-native-chart-kit | ^6.12.0 | Balance payoff line chart |
| react-native-svg | 15.8.0 | Required by chart-kit |
| @react-native-async-storage/async-storage | 1.23.1 | Small key-value preferences |

---

## Privacy

All data is stored **locally on the device** using SQLite. No data is sent to any server, no account is required, and no network connection is needed for any functionality.
