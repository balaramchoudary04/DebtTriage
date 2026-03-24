import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const debts = sqliteTable("debts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  type: text("type").notNull(), // credit_card, student_loan, auto_loan, personal_loan
  balance: real("balance").notNull(),
  creditLimit: real("credit_limit"), // for credit cards
  apr: real("apr").notNull(),
  minimumPayment: real("minimum_payment").notNull(),
  dueDay: integer("due_day").notNull(), // day of month
  lender: text("lender"),
  accountLast4: text("account_last4"),
  isDeferred: integer("is_deferred", { mode: "boolean" }).default(false),
  promoAprEnd: text("promo_apr_end"), // ISO date string
  promoApr: real("promo_apr"),
});

export const insertDebtSchema = createInsertSchema(debts).omit({ id: true });
export type InsertDebt = z.infer<typeof insertDebtSchema>;
export type Debt = typeof debts.$inferSelect;

// Types for frontend calculations (not persisted)
export const debtTypeLabels: Record<string, string> = {
  credit_card: "Credit Card",
  student_loan: "Student Loan",
  auto_loan: "Auto Loan",
  personal_loan: "Personal Loan",
};

export interface PayoffScheduleMonth {
  month: number;
  date: string;
  payment: number;
  principal: number;
  interest: number;
  remainingBalance: number;
}

export interface PayoffPlan {
  strategy: "avalanche" | "snowball";
  totalInterestPaid: number;
  totalPaid: number;
  payoffMonths: number;
  payoffDate: string;
  monthlySchedule: PayoffScheduleMonth[];
  debtPayoffOrder: { debtId: number; name: string; payoffMonth: number }[];
}

export interface BalanceTransferOption {
  name: string;
  introApr: number;
  introPeriodMonths: number;
  transferFee: number; // percentage
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

export interface ScoreSimulation {
  currentEstimate: [number, number];
  afterActions: {
    action: string;
    impact: [number, number]; // range of score change
    newEstimate: [number, number];
    timeframe: string;
  }[];
}

export interface CashFlowImpact {
  currentMonthlyMinimums: number;
  avalancheMonthly: number;
  snowballMonthly: number;
  savingsVsMinimums: number;
  extraPaymentRecommended: number;
}
