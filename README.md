# DebtTriage

A full-stack debt management platform that helps users take control of their finances through smart payoff strategies, credit score simulation, and automated letter generation. Built as both a **React web application** and an **Expo React Native iOS app** with shared financial calculation logic.

---

## Features

### Debt Management
- Add credit card, student loan, auto loan, and personal loan accounts
- Paste statement text to auto-import balances, APRs, and minimum payments
- Track credit utilization per card with visual progress bars

### Payoff Strategy Engine
- **Avalanche Method** — targets highest APR first to minimize total interest
- **Snowball Method** — targets smallest balance first for motivational quick wins
- Side-by-side comparison with projected balance charts
- Adjustable extra monthly payment slider showing real-time impact on payoff timeline and interest savings

### Balance Transfer & Consolidation Screening
- Screens 6 real balance transfer card offers (Chase Slate Edge, Citi Simplicity, BankAmericard, Discover, Wells Fargo Reflect, US Bank Visa Platinum)
- Screens 5 personal loan consolidation lenders (SoFi, LightStream, Marcus, Discover, Upgrade)
- Calculates estimated savings, monthly payment, and transfer fees for each option

### Credit Score Simulator
- Input your current score range and see per-card utilization breakdown
- Paydown simulator shows how a lump sum changes utilization and estimated score
- Ranked action items (reduce utilization to 30%/10%, remove late marks, on-time payments) with point-range estimates and timeframes

### Letter Generator
- **Dispute Letters** — challenge inaccurate credit report entries under the FCRA
- **Hardship Letters** — request payment relief during financial difficulty
- **Goodwill Letters** — request removal of accurate late payment marks
- Quick-fill from saved debt accounts
- Copy to clipboard or share/download as text file

### Dashboard
- KPI cards: Total Debt, Monthly Minimum, Highest APR, Credit Utilization
- Alert banners for high APR (>20%) and utilization (>30%)
- Projected balance chart (avalanche method)
- Debt breakdown by type with donut chart (web) or list view (mobile)

---

## Tech Stack

### Web Application (`/web`)
| Technology | Purpose |
|---|---|
| React 18 + TypeScript | Frontend framework |
| Vite | Build tool and dev server |
| Tailwind CSS + shadcn/ui | Styling and component library |
| Recharts | Data visualization (area charts, pie charts, bar charts) |
| Express.js | Backend API server |
| Drizzle ORM + SQLite | Database and ORM |
| TanStack Query | Data fetching and cache management |

### Mobile Application (`/mobile`)
| Technology | Purpose |
|---|---|
| Expo SDK 52 + TypeScript | React Native framework |
| expo-router | File-based tab navigation |
| expo-sqlite | On-device SQLite database |
| react-native-chart-kit | Line charts for payoff projections |
| expo-clipboard / expo-sharing | Letter copy and share functionality |
| expo-haptics | Tactile feedback on actions |

### Shared
- Financial calculation engine (payoff plans, balance transfer screening, consolidation analysis, score simulation, letter generation)
- Format utilities (currency, percentage, month formatting)

---

## Project Structure

```
DebtTriage/
├── web/                          # React web application
│   ├── client/src/
│   │   ├── pages/                # 6 page components
│   │   │   ├── Dashboard.tsx
│   │   │   ├── Debts.tsx
│   │   │   ├── PayoffPlans.tsx
│   │   │   ├── TransferConsolidation.tsx
│   │   │   ├── ScoreSimulator.tsx
│   │   │   └── LetterGenerator.tsx
│   │   ├── components/           # Layout, sidebar
│   │   └── lib/                  # Calculations engine, API client
│   ├── server/                   # Express API routes + SQLite storage
│   ├── shared/                   # Schema + types shared between client/server
│   └── package.json
│
├── mobile/                       # Expo React Native iOS app
│   ├── app/
│   │   ├── _layout.tsx           # Root layout with providers
│   │   └── (tabs)/              # 6 tab screens
│   │       ├── index.tsx         # Dashboard
│   │       ├── debts.tsx         # Debt management
│   │       ├── payoff.tsx        # Payoff plans
│   │       ├── transfer.tsx      # Transfer & consolidation
│   │       ├── score.tsx         # Score simulator
│   │       └── letters.tsx       # Letter generator
│   ├── src/
│   │   ├── calculations.ts      # Ported financial engine
│   │   ├── database.ts          # expo-sqlite CRUD layer
│   │   ├── DebtContext.tsx       # React context state management
│   │   ├── theme.ts             # Colors, typography, dark mode
│   │   └── types.ts             # TypeScript interfaces
│   └── package.json
│
└── README.md
```

---

## Getting Started

### Web Application

```bash
cd web
npm install
npm run dev
```

Opens at `http://localhost:5000`. The web app uses Express + SQLite on the backend and React + Vite on the frontend.

### Mobile Application

```bash
cd mobile
npm install
npx expo start
```

Scan the QR code with **Expo Go** on your iPhone (same Wi-Fi network), or press `i` to open in the iOS Simulator (requires Xcode).

See [`mobile/README.md`](mobile/README.md) for full setup instructions including TestFlight deployment.

---

## Architecture

### Financial Calculation Engine

The core engine is shared between both platforms and handles:

- **Amortization schedules** — month-by-month principal, interest, and remaining balance projections with configurable extra payments
- **Strategy comparison** — avalanche (highest APR first) vs snowball (lowest balance first) with payoff order tracking
- **Balance transfer screening** — compares 0% intro APR offers against current weighted average rate, factoring in transfer fees
- **Consolidation analysis** — screens personal loan rates across multiple term lengths, comparing total interest to current payoff path
- **Score impact modeling** — estimates FICO score changes based on utilization reduction, late payment removal, and payment history improvements
- **Statement parsing** — regex-based extraction of balance, APR, minimum payment, credit limit, and account number from pasted statement text

### Data Storage

- **Web**: Server-side SQLite via Drizzle ORM with Express REST API
- **Mobile**: On-device SQLite via expo-sqlite — all data stays on the phone, no server needed, fully private

---

## Dark Mode

Both platforms support automatic dark mode based on system preference, with manual toggle available in the web version's sidebar.

---

## License

MIT
