# DebtWise

DebtWise is a web application designed to help users track and pay off their personal debts (credit cards, student loans, mortgages, etc.) strategically. It simulates month-by-month payment schedules and compares payoff strategies like Avalanche and Snowball to show users the most cost-effective and fastest path to becoming debt-free.

This is a full-stack project built with a React frontend and a FastAPI backend, utilizing MongoDB for data persistence.

## Features

- **Payoff Simulator**: Month-by-month calculations for:
  - **Avalanche**: Targets the highest interest rate first to save the most money.
  - **Snowball**: Targets the lowest balance first for quick psychological wins.
  - **Highest Payment**: Prioritizes freeing up monthly cash flow.
  - **Custom**: Allows manual ordering of debts and custom monthly extra payments.
- **Interactive Dashboard**: Built with Recharts to show payoff timelines, debt breakdown, and total interest comparisons over time.
- **Plaid Integration**: Links bank accounts to pull credit card and loan details (balances, APRs, and due dates) automatically.
- **Stripe Subscriptions**: Payment flow handling monthly/annual premium plans, gated by webhook integration.
- **Automated Reminders**: Background worker sending email (Resend API) and SMS (Twilio) payment alerts 3 days before and on the payment due date.
- **Security**: Secure JWT-based cookie authentication and rate-limiting to prevent brute-force login attempts.

## Tech Stack

- **Frontend**: React 19, React Router 7, Tailwind CSS, Radix UI, Recharts, Sonner.
- **Backend**: FastAPI, MongoDB (Motor async driver), Pydantic v2.
- **Integrations**: Plaid API, Stripe API, Resend, Twilio.
- **Testing**: Pytest.

## Project Structure

```text
├── backend/
│   ├── server.py              # API routes, middleware, and background reminder loop
│   ├── requirements.txt       # Backend packages
│   └── tests/                 # Pytest suite
└── frontend/
    ├── src/
    │   ├── pages/             # Dashboard, Debts, Strategies, Settings, Simulator
    │   ├── components/        # Layout and UI modules
    │   └── App.js             # Routing and contexts
    └── package.json           # Frontend packages
```

## Setup & Installation

### Backend Setup

1. Move into the backend directory and set up a virtual environment:
   ```bash
   cd backend
   python3 -m venv venv
   source venv/bin/activate
   ```
2. Install Python packages:
   ```bash
   pip install -r requirements.txt
   ```
3. Create a `.env` file in the `backend/` directory:
   ```env
   MONGO_URL=mongodb://localhost:27017
   DB_NAME=debtwise
   JWT_SECRET=your_secret_key
   FRONTEND_URL=http://localhost:3000

   # Optional Integrations
   PLAID_CLIENT_ID=your_id
   PLAID_SECRET=your_secret
   PLAID_ENV=sandbox
   STRIPE_API_KEY=your_key
   RESEND_API_KEY=your_key
   SENDER_EMAIL=your_email
   TWILIO_ACCOUNT_SID=your_sid
   TWILIO_AUTH_TOKEN=your_token
   TWILIO_FROM=your_number
   ```
4. Run the server:
   ```bash
   uvicorn server:app --reload --port 8000
   ```

### Frontend Setup

1. Move into the frontend directory:
   ```bash
   cd ../frontend
   ```
2. Install Node packages:
   ```bash
   npm install
   ```
3. Start the React app:
   ```bash
   npm start
   ```
   Open [http://localhost:3000](http://localhost:3000) to view the app.

## Running Tests

To run the backend tests:
```bash
pytest backend/tests
```
