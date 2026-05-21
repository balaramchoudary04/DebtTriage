# DebtWise — PRD

## Original problem statement
> Build an app that manages a person's debt profile. Let users add all kinds of debt (credit card, personal loan, car loan, student loan, etc.). The main goal is to suggest different payoff methods (avalanche, snowball, etc.) so users resolve debt strategically. UI must be professional, smooth, and glassy.

## User choices (Feb 2026)
- Auth: BOTH JWT email/password AND Emergent Google OAuth
- Strategies: Full suite — Avalanche, Snowball, Highest Payment, Custom
- Visualizations: Full dashboard (timeline, pie, interest comparison, progress)
- Extras: Extra-payment simulator + payment reminders + core debt mgmt
- Style: Dark theme with deep navy/teal glass panels

## Architecture
- **Backend**: FastAPI + MongoDB (Motor). JWT (httpOnly cookies) + Emergent OAuth session exchange.
- **Frontend**: React 19 + react-router 7 + Shadcn UI + Recharts + Lucide icons + Sonner toasts.
- **Theme**: deep-navy `#020617` base, glass panels (rgba 15/23/42 + backdrop-blur-xl), Outfit display + Manrope body fonts.

## User personas
- Borrower mapping multiple debts who wants the cheapest/fastest path to debt-free.
- Behavior-driven payer who needs early wins (Snowball).
- Cash-flow strapped user who needs to free monthly budget first (Highest Payment).

## Implemented (2026-02-21)
- Auth: register/login/logout/me, JWT cookies, brute-force lockout, admin seeding, `/api/auth/session` for Emergent OAuth.
- Debts CRUD (user-scoped) with 7 debt types.
- Strategy engine: month-by-month simulation for Avalanche, Snowball, Highest Payment, Custom with snowball roll-over of freed minimums, capped at 600 months.
- `POST /api/strategies/calculate` + `POST /api/strategies/compare` + `GET /api/reminders/upcoming`.
- Pages: Landing, Login (email + Google), Dashboard (4 metrics + donut + payoff line + strategy compare + reminders), Debts (CRUD dialog), Strategies (3-card compare + slider + 2 charts), StrategyDetail (timeline + per-debt amortization table), Simulator (baseline vs boosted line chart with interest/months saved).
- Mobile responsive layout with sticky top nav.
- All interactive elements have `data-testid`.

## Backlog (P1/P2)
- P1: Drag-and-drop ordering for "Custom" strategy.
- P1: Recurring extra-payment scenarios (every other month, lump sum at month X).
- P2: CSV import for debts.
- P2: Email/SMS payment reminder delivery (currently shown in-app).
- P2: Sharable read-only debt-free milestone page.

## Test credentials
- Admin: `admin@debtwise.app` / `Admin@123`
