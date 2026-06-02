# DebtWise — PRD

## Original problem statement
> Build an app that manages a person's debt profile. Let users add all kinds of debt (credit card, personal loan, car loan, student loan, etc.). The main goal is to suggest different payoff methods (avalanche, snowball, etc.) so users resolve debt strategically. UI must be professional, smooth, and glassy.

## User choices (Feb 2026)
- Auth: BOTH JWT email/password AND Google OAuth
- Strategies: Full suite — Avalanche, Snowball, Highest Payment, Custom
- Visualizations: Full dashboard (timeline, pie, interest comparison, progress)
- Extras: Extra-payment simulator + payment reminders + core debt mgmt
- Style: Dark theme with deep navy/teal glass panels

## Architecture
- **Backend**: FastAPI + MongoDB (Motor). JWT (httpOnly cookies) + Google OAuth session exchange.
- **Frontend**: React 19 + react-router 7 + Shadcn UI + Recharts + Lucide icons + Sonner toasts.
- **Theme**: deep-navy `#020617` base, glass panels (rgba 15/23/42 + backdrop-blur-xl), Outfit display + Manrope body fonts.

## User personas
- Borrower mapping multiple debts who wants the cheapest/fastest path to debt-free.
- Behavior-driven payer who needs early wins (Snowball).
- Cash-flow strapped user who needs to free monthly budget first (Highest Payment).

## Implemented (2026-02-21, updated iter 3)
- Auth: register/login/logout/me, JWT cookies, brute-force lockout, admin seeding, `/api/auth/session` for Google OAuth session exchange.
- Debts CRUD (user-scoped) with 7 debt types and **strict `due_date`** (Python `date`, rejects invalid like Feb 31).
- Strategy engine: month-by-month simulation for Avalanche, Snowball, Highest Payment, Custom with snowball roll-over of freed minimums + freed per-debt extras. Capped at 600 months.
- `/api/strategies/calculate` accepts `custom_order` + **`per_debt_extra`** (per-debt $/mo overrides).
- `/api/strategies/compare` + `/api/reminders/upcoming`.
- Pages: Landing, Login, Dashboard, Debts (mm/dd/yy picker), Strategies (4 cards including Custom), StrategyDetail, **StrategyCustom (DnD priority + per-debt extra)**, Simulator (gated), Settings (profile + phone + notifications + subscription + sign out).
- Subscription (Stripe): $5/mo, $50/yr "Save 17%". Free=3 debts, Premium=unlimited + Simulator + Custom. Webhook + soft-fail status polling.
- **Notifications**: Resend (email) + Twilio (SMS) helpers, no-op gracefully when keys missing. Daily reminder loop fires 3 days before and on the due date with reminder_log dedupe. `POST /api/reminders/test` for users to verify their setup.
- CORS: `allow_origin_regex` for any *.preview.emergentagent.com subdomain.

## Pending integration credentials
- `RESEND_API_KEY` + `SENDER_EMAIL` (Resend) — backend `.env`
- `TWILIO_ACCOUNT_SID` + `TWILIO_AUTH_TOKEN` + `TWILIO_FROM` (Twilio) — backend `.env`
- When keys are blank, reminder loop and `/api/reminders/test` return `{sent: false, reason: '…not configured'}`.

## Backlog (P1/P2)
- P1: Drag-and-drop ordering for "Custom" strategy.
- P1: Recurring extra-payment scenarios (every other month, lump sum at month X).
- P2: CSV import for debts.
- P2: Email/SMS payment reminder delivery (currently shown in-app).
- P2: Sharable read-only debt-free milestone page.

## Test credentials
- Admin: `admin@debtwise.app` / `Admin@123`
