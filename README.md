# DebtWise

DebtWise is a premium, glassmorphic debt-management and payoff-strategy planner designed to help users optimize and accelerate their path to financial freedom. By aggregating credit cards, personal loans, auto loans, and mortgages in one beautiful interface, DebtWise simulates month-by-month payment flows and compares mathematical optimization strategies to minimize total interest paid and time-to-payoff.

---

## Key Features

- **Strategic Payoff Engine**: Month-by-month simulations for leading payment methodologies:
  - **Debt Avalanche** (mathematically optimizes for lowest interest paid by targeting high APRs first).
  - **Debt Snowball** (focuses on psychological momentum by targeting lowest balances first).
  - **Highest Payment** (prioritizes freeing up monthly cash flow by targeting largest minimum payments).
  - **Custom Ordering** (enables full user-defined sequencing and per-debt extra payments).
- **Interactive Visual Dashboard**: A high-contrast, premium dark bento-grid layout using glassmorphic UI elements and responsive interactive charts (Recharts) to show long-term payoff timelines and interest comparisons.
- **Plaid Bank Integration**: Securely links bank accounts to automatically pull real-time balances, interest rates (APRs), and next payment due dates.
- **Stripe Subscriptions**: Seamless subscription model supporting monthly and annual billing packages, fully guarded by backend routing and Stripe webhooks.
- **Automated Reminders**: Built-in daily reminder loop providing email (Resend) and SMS (Twilio) notifications 3 days before and on the actual due date, complete with strict duplicate logging.
- **Brute-Force Lockout Guard**: Rate-limits login attempts per IP/account to prevent brute-force attacks.

---

## Tech Stack

### Frontend
- **Framework**: React 19 & React Router 7
- **Styling**: Tailwind CSS & Radix UI Primitives (Glassmorphism design tokens)
- **Charts**: Recharts (with glow-effect lines and custom tooltips)
- **Notifications**: Sonner

### Backend
- **Framework**: FastAPI (Python 3.8+)
- **Database**: MongoDB (via Motor async driver)
- **Authentication**: JWT HttpOnly Cookies & Emergent OAuth Session integration
- **Payment & Linking**: Stripe SDK, Plaid SDK
- **Messaging**: Resend API (Email), Twilio SDK (SMS)

---

## Project Structure

```text
├── backend/
│   ├── server.py              # FastAPI server containing endpoints, middleware, and reminder loop
│   ├── requirements.txt       # Python dependencies
│   └── tests/                 # Backend pytest suite (health, auth, CRUD, strategy, billing, reminders)
├── frontend/
│   ├── src/
│   │   ├── pages/             # Landing, Login, Dashboard, Debts, Strategies, Settings, Simulator
│   │   ├── components/        # AppLayout, Nav, Glass Cards, Custom UI components
│   │   └── App.js             # Router config, protected routing, notifications
│   ├── package.json           # Frontend dependencies and run scripts
│   └── tailwind.config.js     # Glassmorphic design variables and configurations
├── design_guidelines.json     # Premium aesthetic guidelines (colors, typography, fonts)
└── README.md                  # This file
```

---

## Configuration & Environment Variables

Create a `.env` file in the `backend/` directory with the following variables:

```bash
# Core
MONGO_URL=mongodb://localhost:27017
DB_NAME=debtwise
JWT_SECRET=your_jwt_signing_secret_here
FRONTEND_URL=http://localhost:3000

# Plaid (Optional)
PLAID_CLIENT_ID=your_plaid_client_id
PLAID_SECRET=your_plaid_secret
PLAID_ENV=sandbox

# Stripe (Optional)
STRIPE_API_KEY=your_stripe_secret_key

# Resend Email (Optional)
RESEND_API_KEY=your_resend_api_key
SENDER_EMAIL=onboarding@resend.dev

# Twilio SMS (Optional)
TWILIO_ACCOUNT_SID=your_twilio_sid
TWILIO_AUTH_TOKEN=your_twilio_token
TWILIO_FROM=your_twilio_phone_number
```

---

## Getting Started

### 1. Backend Setup
1. Navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Create and activate a virtual environment:
   ```bash
   python3 -m venv venv
   source venv/bin/activate
   ```
3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Start the FastAPI development server:
   ```bash
   uvicorn server:app --reload --port 8000
   ```

### 2. Frontend Setup
1. Navigate to the frontend directory:
   ```bash
   cd ../frontend
   ```
2. Install package dependencies:
   ```bash
   npm install
   ```
3. Start the React development server:
   ```bash
   npm start
   ```
   The application will open automatically at [http://localhost:3000](http://localhost:3000).

---

## Running Tests

To verify that all services and database endpoints are operating correctly, run the comprehensive backend test suite:

```bash
pytest backend/tests
```

All 47 tests (covering auth flow, strategy engine simulations, brute-force lockout, reminders, and subscription management) should execute and pass successfully.
