// ──────────────────────────────────────
// Core Domain Types
// ──────────────────────────────────────

export interface Debt {
  id: number;
  name: string;
  type: 'credit_card' | 'personal_loan' | 'auto_loan' | 'student_loan' | 'medical' | 'other';
  balance: number;
  creditLimit: number | null;
  apr: number;
  minimumPayment: number;
  dueDay: number;
  lender: string | null;
  accountLast4: string | null;
}

export type DebtInput = Omit<Debt, 'id'>;

// ──────────────────────────────────────
// Payoff Plan Types
// ──────────────────────────────────────

export interface PayoffScheduleMonth {
  month: number;
  date: string;
  payment: number;
  principal: number;
  interest: number;
  remainingBalance: number;
}

export interface PayoffPlan {
  strategy: 'avalanche' | 'snowball';
  totalInterestPaid: number;
  totalPaid: number;
  payoffMonths: number;
  payoffDate: string;
  monthlySchedule: PayoffScheduleMonth[];
  debtPayoffOrder: { debtId: number; name: string; payoffMonth: number }[];
}

// ──────────────────────────────────────
// Transfer & Consolidation Types
// ──────────────────────────────────────

export interface BalanceTransferOption {
  name: string;
  introApr: number;
  introPeriodMonths: number;
  transferFee: number;
  regularApr: number;
  estimatedSavings: number;
  monthlyPayment: number;
  totalCost: number;
}

export interface ConsolidationOption {
  name: string;
  apr: number;
  termMonths: number;
  monthlyPayment: number;
  totalInterest: number;
  totalPaid: number;
  savings: number;
}

// ──────────────────────────────────────
// Score Simulation Types
// ──────────────────────────────────────

export interface ScoreSimulation {
  currentEstimate: [number, number];
  afterActions: {
    action: string;
    impact: [number, number];
    newEstimate: [number, number];
    timeframe: string;
  }[];
}

// ──────────────────────────────────────
// Cash Flow Types
// ──────────────────────────────────────

export interface CashFlowImpact {
  currentMonthlyMinimums: number;
  avalancheMonthly: number;
  snowballMonthly: number;
  savingsVsMinimums: number;
  extraPaymentRecommended: number;
}

// ──────────────────────────────────────
// Utilization Types
// ──────────────────────────────────────

export interface UtilizationResult {
  overall: number;
  totalLimit: number;
  totalBalance: number;
  perCard: {
    name: string;
    balance: number;
    limit: number;
    utilization: number;
  }[];
}
