# DebtWise

DebtWise is a strategic debt-payoff planner designed to help individuals organize credit cards, personal loans, auto loans, and mortgages, and determine the most cost-effective path to becoming debt-free. 

Rather than just tracking balances, the application simulates month-by-month payment flows and compounding interest over time. It visually compares different financial optimization methodologies—allowing users to see exactly how much money and time they can save by altering their payment behaviors.

---

## Core Payoff Strategy Engine

The heart of DebtWise is an async simulation engine that models month-by-month amortization schedules. When a user adds an extra monthly payment, the engine simulates how that money is distributed alongside standard minimums, and calculates the exact payoff month and total interest paid for four distinct strategies:

1. **Debt Avalanche (Mathematical Optimization)**: Targets the debt with the highest interest rate (APR) first. This strategy is mathematically proven to minimize the total interest paid over the life of the debts.
2. **Debt Snowball (Psychological Momentum)**: Targets the debt with the lowest remaining balance first. By clearing smaller debts quickly, it builds immediate psychological momentum and reduces the sheer number of open accounts.
3. **Highest Payment (Cash Flow Relief)**: Targets the debt with the largest monthly minimum payment first. This strategy is designed to free up monthly cash flow as quickly as possible for cash-strapped users.
4. **Custom Sequencing**: Allows users to manually drag-and-drop their debts into a custom payoff order, or configure specific extra monthly payments on a per-debt basis.

### The "Snowball" Roll-over Effect
Across all strategies, the engine automatically simulates the rollover effect: when a specific debt is fully paid off, its entire minimum payment (along with any custom extra payments allocated to it) is rolled into the payment pool for the next active debt in line, compounding the speed of the payoff.

---

## System Overview

* **Visual Dashboard**: Integrates interactive charts (built with Recharts) that map out the user's customized payoff timeline, showing the decline of total remaining balance month-by-month and a breakdown of debt categories.
* **Plaid Account Syncing**: Links directly to financial institutions to securely import active credit card and loan accounts, capturing real-time balances, interest rates, and next payment due dates automatically.
* **Subscription Management**: Integrates Stripe checkout and webhooks to manage premium accounts, granting users access to unlimited debt slots, custom payoff sequencing, and the interactive simulator.
* **Background Reminders**: Runs a recurring daily worker that calculates upcoming payment due dates and sends automated email (via Resend) and SMS (via Twilio) alerts 3 days before and on the actual due date to prevent missed payments.
* **Security & Lockout**: Implements secure HTTP-only JWT cookies for session management and a brute-force prevention system that locks out accounts/IPs after consecutive failed login attempts.

---

## Tech Stack & Architecture

DebtWise is designed as a decoupled full-stack application:

* **Frontend (React)**: Built as a single-page application using React 19, React Router 7, Radix UI primitives, and Tailwind CSS. It uses a high-contrast dark theme with glassmorphic cards and glowing visual states.
* **Backend (FastAPI)**: A lightweight, asynchronous Python API using Pydantic v2 for strict request validation and structured schemas.
* **Database (MongoDB)**: Utilizes the Motor async driver to manage user records, active debts, encrypted Plaid items, transaction states, and reminder logs.
* **Testing (Pytest)**: Integrates a comprehensive integration and unit test suite covering auth flows, strategy simulations, limits, and automated workers.

---

## Running the Project

* **Backend Dev Server**: `uvicorn server:app --reload` (started within the `backend` directory)
* **Frontend Dev Server**: `npm start` (started within the `frontend` directory)
* **Run Tests**: `pytest backend/tests`
