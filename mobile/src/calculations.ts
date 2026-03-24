import type {
  Debt,
  PayoffPlan,
  PayoffScheduleMonth,
  BalanceTransferOption,
  ConsolidationOption,
  ScoreSimulation,
  CashFlowImpact,
  UtilizationResult,
} from './types';

// ──────────────────────────────────────
// Payoff Plans (Avalanche & Snowball)
// ──────────────────────────────────────

export function calculatePayoffPlan(
  debts: Debt[],
  strategy: 'avalanche' | 'snowball',
  extraMonthly: number = 0
): PayoffPlan {
  if (debts.length === 0) {
    return {
      strategy,
      totalInterestPaid: 0,
      totalPaid: 0,
      payoffMonths: 0,
      payoffDate: new Date().toISOString().slice(0, 7),
      monthlySchedule: [],
      debtPayoffOrder: [],
    };
  }

  // Clone balances
  const balances = debts.map((d) => d.balance);
  const rates = debts.map((d) => d.apr / 100 / 12); // monthly rate
  const mins = debts.map((d) => d.minimumPayment);

  const totalMinPayment = mins.reduce((s, m) => s + m, 0);
  const totalMonthlyBudget = totalMinPayment + extraMonthly;

  const schedule: PayoffScheduleMonth[] = [];
  const debtPayoffOrder: { debtId: number; name: string; payoffMonth: number }[] = [];
  const paidOff = new Set<number>();

  let totalInterest = 0;
  let totalPaid = 0;
  let month = 0;
  const maxMonths = 600; // 50-year safety cap

  const now = new Date();

  while (balances.some((b, i) => b > 0.01 && !paidOff.has(i)) && month < maxMonths) {
    month++;
    const date = new Date(now.getFullYear(), now.getMonth() + month, 1);
    const dateStr = date.toISOString().slice(0, 7);

    let monthPayment = 0;
    let monthPrincipal = 0;
    let monthInterest = 0;

    // First: apply interest and minimum payments
    let availableExtra = totalMonthlyBudget;
    for (let i = 0; i < debts.length; i++) {
      if (balances[i] <= 0.01) continue;
      const interest = balances[i] * rates[i];
      totalInterest += interest;
      monthInterest += interest;
      balances[i] += interest;

      const minPay = Math.min(mins[i], balances[i]);
      balances[i] -= minPay;
      monthPayment += minPay;
      monthPrincipal += minPay - interest;
      availableExtra -= minPay;
      totalPaid += minPay;

      if (balances[i] <= 0.01) {
        balances[i] = 0;
        paidOff.add(i);
        debtPayoffOrder.push({
          debtId: debts[i].id,
          name: debts[i].name,
          payoffMonth: month,
        });
      }
    }

    // Then: apply extra payment to priority debt
    if (availableExtra > 0) {
      const sorted = debts
        .map((d, i) => ({ idx: i, apr: d.apr, balance: balances[i] }))
        .filter((d) => d.balance > 0.01);

      if (strategy === 'avalanche') {
        sorted.sort((a, b) => b.apr - a.apr); // highest APR first
      } else {
        sorted.sort((a, b) => a.balance - b.balance); // smallest balance first
      }

      for (const target of sorted) {
        if (availableExtra <= 0) break;
        const extra = Math.min(availableExtra, balances[target.idx]);
        balances[target.idx] -= extra;
        monthPayment += extra;
        monthPrincipal += extra;
        availableExtra -= extra;
        totalPaid += extra;

        if (balances[target.idx] <= 0.01) {
          balances[target.idx] = 0;
          if (!paidOff.has(target.idx)) {
            paidOff.add(target.idx);
            debtPayoffOrder.push({
              debtId: debts[target.idx].id,
              name: debts[target.idx].name,
              payoffMonth: month,
            });
          }
        }
      }
    }

    const remaining = balances.reduce((s, b) => s + b, 0);
    schedule.push({
      month,
      date: dateStr,
      payment: Math.round(monthPayment * 100) / 100,
      principal: Math.round(monthPrincipal * 100) / 100,
      interest: Math.round(monthInterest * 100) / 100,
      remainingBalance: Math.round(remaining * 100) / 100,
    });
  }

  const payoffDate =
    schedule.length > 0 ? schedule[schedule.length - 1].date : new Date().toISOString().slice(0, 7);

  return {
    strategy,
    totalInterestPaid: Math.round(totalInterest * 100) / 100,
    totalPaid: Math.round(totalPaid * 100) / 100,
    payoffMonths: month,
    payoffDate,
    monthlySchedule: schedule,
    debtPayoffOrder,
  };
}

// ──────────────────────────────────────
// Balance Transfer Screening
// ──────────────────────────────────────

const BALANCE_TRANSFER_OFFERS: Omit<
  BalanceTransferOption,
  'estimatedSavings' | 'monthlyPayment' | 'totalCost'
>[] = [
  { name: 'Chase Slate Edge', introApr: 0, introPeriodMonths: 21, transferFee: 3, regularApr: 21.49 },
  { name: 'Citi Simplicity', introApr: 0, introPeriodMonths: 21, transferFee: 3, regularApr: 19.24 },
  { name: 'BankAmericard', introApr: 0, introPeriodMonths: 18, transferFee: 3, regularApr: 16.24 },
  { name: 'Discover it Balance Transfer', introApr: 0, introPeriodMonths: 18, transferFee: 3, regularApr: 17.24 },
  { name: 'Wells Fargo Reflect', introApr: 0, introPeriodMonths: 21, transferFee: 3, regularApr: 18.24 },
  { name: 'US Bank Visa Platinum', introApr: 0, introPeriodMonths: 18, transferFee: 3, regularApr: 18.49 },
];

export function screenBalanceTransfers(creditCardDebts: Debt[]): BalanceTransferOption[] {
  if (creditCardDebts.length === 0) return [];

  const totalCCBalance = creditCardDebts.reduce((s, d) => s + d.balance, 0);
  const avgApr = creditCardDebts.reduce((s, d) => s + d.apr * d.balance, 0) / totalCCBalance;

  return BALANCE_TRANSFER_OFFERS.map((offer) => {
    const transferFeeCost = totalCCBalance * (offer.transferFee / 100);
    const monthlyPayment = totalCCBalance / offer.introPeriodMonths;
    const totalCost = totalCCBalance + transferFeeCost;

    // Compare to current interest cost over the intro period
    const currentMonthlyInterest = totalCCBalance * (avgApr / 100 / 12);
    const currentInterestOverPeriod = currentMonthlyInterest * offer.introPeriodMonths;
    const estimatedSavings = currentInterestOverPeriod - transferFeeCost;

    return {
      ...offer,
      estimatedSavings: Math.round(estimatedSavings * 100) / 100,
      monthlyPayment: Math.round(monthlyPayment * 100) / 100,
      totalCost: Math.round(totalCost * 100) / 100,
    };
  })
    .filter((o) => o.estimatedSavings > 0)
    .sort((a, b) => b.estimatedSavings - a.estimatedSavings);
}

// ──────────────────────────────────────
// Consolidation Screening
// ──────────────────────────────────────

export function screenConsolidation(debts: Debt[]): ConsolidationOption[] {
  if (debts.length < 2) return [];

  const totalBalance = debts.reduce((s, d) => s + d.balance, 0);
  const weightedApr = debts.reduce((s, d) => s + d.apr * d.balance, 0) / totalBalance;

  // Estimate current total interest (paying minimums only)
  let currentTotalInterest = 0;
  {
    const bal = debts.map((d) => d.balance);
    const rates = debts.map((d) => d.apr / 100 / 12);
    const mins = debts.map((d) => d.minimumPayment);
    for (let m = 0; m < 360; m++) {
      let allZero = true;
      for (let i = 0; i < debts.length; i++) {
        if (bal[i] <= 0.01) continue;
        allZero = false;
        const interest = bal[i] * rates[i];
        currentTotalInterest += interest;
        bal[i] += interest;
        const pay = Math.min(mins[i], bal[i]);
        bal[i] -= pay;
      }
      if (allZero) break;
    }
  }

  const consolidationRates = [
    { name: 'SoFi Personal Loan', apr: 8.99, terms: [36, 60, 84] },
    { name: 'LightStream', apr: 7.49, terms: [36, 60, 84] },
    { name: 'Marcus by Goldman Sachs', apr: 9.99, terms: [36, 48, 60] },
    { name: 'Discover Personal Loan', apr: 8.24, terms: [36, 60, 84] },
    { name: 'Upgrade Personal Loan', apr: 9.49, terms: [36, 60, 84] },
  ];

  const options: ConsolidationOption[] = [];

  for (const lender of consolidationRates) {
    if (lender.apr >= weightedApr) continue; // Only show if it would lower rate

    for (const term of lender.terms) {
      const monthlyRate = lender.apr / 100 / 12;
      const monthlyPayment =
        (totalBalance * (monthlyRate * Math.pow(1 + monthlyRate, term))) /
        (Math.pow(1 + monthlyRate, term) - 1);
      const totalPaid = monthlyPayment * term;
      const totalInterest = totalPaid - totalBalance;
      const savings = currentTotalInterest - totalInterest;

      if (savings > 0) {
        options.push({
          name: `${lender.name} (${term}mo)`,
          apr: lender.apr,
          termMonths: term,
          monthlyPayment: Math.round(monthlyPayment * 100) / 100,
          totalInterest: Math.round(totalInterest * 100) / 100,
          totalPaid: Math.round(totalPaid * 100) / 100,
          savings: Math.round(savings * 100) / 100,
        });
      }
    }
  }

  return options.sort((a, b) => b.savings - a.savings);
}

// ──────────────────────────────────────
// Credit Score Simulation
// ──────────────────────────────────────

export function simulateScoreImpact(
  debts: Debt[],
  currentScoreRange: [number, number]
): ScoreSimulation {
  const ccDebts = debts.filter((d) => d.type === 'credit_card');
  const totalLimit = ccDebts.reduce((s, d) => s + (d.creditLimit || 0), 0);
  const totalCCBalance = ccDebts.reduce((s, d) => s + d.balance, 0);
  const utilization = totalLimit > 0 ? (totalCCBalance / totalLimit) * 100 : 0;

  const actions: ScoreSimulation['afterActions'] = [];

  // Action 1: Pay down to 30% utilization
  if (utilization > 30 && totalLimit > 0) {
    const targetBalance = totalLimit * 0.3;
    const paydownNeeded = totalCCBalance - targetBalance;
    const impact: [number, number] = [15, 40];
    actions.push({
      action: `Pay down $${paydownNeeded.toFixed(0)} to reach 30% utilization`,
      impact,
      newEstimate: [currentScoreRange[0] + impact[0], currentScoreRange[1] + impact[1]],
      timeframe: '1-2 billing cycles',
    });
  }

  // Action 2: Pay down to 10% utilization
  if (utilization > 10 && totalLimit > 0) {
    const targetBalance = totalLimit * 0.1;
    const paydownNeeded = totalCCBalance - targetBalance;
    const impact: [number, number] = [25, 65];
    actions.push({
      action: `Pay down $${paydownNeeded.toFixed(0)} to reach 10% utilization`,
      impact,
      newEstimate: [
        currentScoreRange[0] + impact[0],
        Math.min(currentScoreRange[1] + impact[1], 850),
      ],
      timeframe: '1-2 billing cycles',
    });
  }

  // Action 3: Remove late payments (dispute/goodwill)
  const hasHighBalance = debts.some((d) => d.balance > d.minimumPayment * 3);
  if (hasHighBalance) {
    const impact: [number, number] = [20, 100];
    actions.push({
      action: 'Remove late payment marks via goodwill or dispute letters',
      impact,
      newEstimate: [
        Math.min(currentScoreRange[0] + impact[0], 850),
        Math.min(currentScoreRange[1] + impact[1], 850),
      ],
      timeframe: '30-90 days after acceptance',
    });
  }

  // Action 4: Keep old accounts open
  actions.push({
    action: 'Keep oldest credit accounts open (increase avg age)',
    impact: [5, 15],
    newEstimate: [
      Math.min(currentScoreRange[0] + 5, 850),
      Math.min(currentScoreRange[1] + 15, 850),
    ],
    timeframe: 'Ongoing (avoid closing old cards)',
  });

  // Action 5: Pay all bills on time for 6 months
  actions.push({
    action: 'Make every payment on time for 6 consecutive months',
    impact: [10, 30],
    newEstimate: [
      Math.min(currentScoreRange[0] + 10, 850),
      Math.min(currentScoreRange[1] + 30, 850),
    ],
    timeframe: '6 months',
  });

  return {
    currentEstimate: currentScoreRange,
    afterActions: actions,
  };
}

// ──────────────────────────────────────
// Cash Flow Analysis
// ──────────────────────────────────────

export function analyzeCashFlow(debts: Debt[], extraMonthly: number): CashFlowImpact {
  const currentMinimums = debts.reduce((s, d) => s + d.minimumPayment, 0);
  const totalBudget = currentMinimums + extraMonthly;

  return {
    currentMonthlyMinimums: Math.round(currentMinimums * 100) / 100,
    avalancheMonthly: Math.round(totalBudget * 100) / 100,
    snowballMonthly: Math.round(totalBudget * 100) / 100,
    savingsVsMinimums: 0,
    extraPaymentRecommended: Math.round(Math.max(currentMinimums * 0.2, 50) * 100) / 100,
  };
}

// ──────────────────────────────────────
// Utilization Calculator
// ──────────────────────────────────────

export function calculateUtilization(debts: Debt[]): UtilizationResult {
  const ccDebts = debts.filter((d) => d.type === 'credit_card');
  const totalLimit = ccDebts.reduce((s, d) => s + (d.creditLimit || 0), 0);
  const totalBalance = ccDebts.reduce((s, d) => s + d.balance, 0);
  const overall = totalLimit > 0 ? (totalBalance / totalLimit) * 100 : 0;

  const perCard = ccDebts.map((d) => ({
    name: d.name,
    balance: d.balance,
    limit: d.creditLimit || 0,
    utilization: d.creditLimit ? (d.balance / d.creditLimit) * 100 : 0,
  }));

  return { overall, totalLimit, totalBalance, perCard };
}

// ──────────────────────────────────────
// Letter Generator
// ──────────────────────────────────────

export function generateLetter(
  type: 'dispute' | 'hardship' | 'goodwill',
  data: {
    name: string;
    address: string;
    accountNumber: string;
    creditorName: string;
    creditorAddress: string;
    details: string;
    amount?: string;
  }
): string {
  const today = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  if (type === 'dispute') {
    return `${data.name}
${data.address}

${today}

${data.creditorName}
${data.creditorAddress}

Re: Dispute of Account Information
Account Number: ${data.accountNumber}

To Whom It May Concern:

I am writing to formally dispute the following information on my credit report that is inaccurate and request that it be corrected or removed immediately.

Account in Question: ${data.creditorName} — Account ending in ${data.accountNumber}

Details of Dispute:
${data.details}

Under the Fair Credit Reporting Act (FCRA), Section 611 (15 U.S.C. § 1681i), I have the right to dispute inaccurate information on my credit report. You are required to investigate this dispute within 30 days and provide me with the results.

I request that you:
1. Investigate this dispute and correct the inaccurate information
2. Provide me with copies of any documents used to verify this debt
3. Remove any inaccurate negative marks from my credit report
4. Send me an updated copy of my credit report showing the corrections

I have enclosed copies of supporting documentation for your review. Please confirm receipt of this dispute in writing.

Sincerely,

${data.name}

Enclosures: [List any supporting documents]`;
  }

  if (type === 'hardship') {
    return `${data.name}
${data.address}

${today}

${data.creditorName}
${data.creditorAddress}

Re: Request for Financial Hardship Assistance
Account Number: ${data.accountNumber}
${data.amount ? `Current Balance: $${data.amount}` : ''}

To Whom It May Concern:

I am writing to request financial hardship assistance for my account listed above. I am experiencing financial difficulties due to the following circumstances:

${data.details}

Despite this hardship, I remain committed to fulfilling my financial obligations and am reaching out proactively to find a workable solution before my account falls further behind.

I respectfully request that you consider one or more of the following accommodations:
1. Temporary reduction of my interest rate
2. Reduction or waiver of minimum payment requirements for a specified period
3. Waiver of late fees and penalty interest charges
4. A modified payment plan that fits my current budget
5. Temporary forbearance or deferment of payments

My current monthly income is [income amount] and my essential monthly expenses are [expense amount]. I can afford to pay approximately [proposed payment] per month during this hardship period.

I expect my financial situation to improve within [timeframe] because [reason for expected improvement].

I would appreciate the opportunity to discuss this request and find a mutually acceptable solution. Please contact me at your earliest convenience.

Sincerely,

${data.name}`;
  }

  // goodwill
  return `${data.name}
${data.address}

${today}

${data.creditorName}
${data.creditorAddress}

Re: Goodwill Adjustment Request
Account Number: ${data.accountNumber}

To Whom It May Concern:

I am writing to respectfully request a goodwill adjustment to remove the late payment mark(s) on my account referenced above.

I have been a loyal customer of ${data.creditorName} and have generally maintained a positive payment history. However, I experienced a late payment due to the following circumstances:

${data.details}

Since that time, I have taken the following steps to ensure this does not happen again:
- Set up automatic payments to prevent future missed due dates
- Created calendar reminders for payment deadlines
- Built an emergency fund to handle unexpected expenses

My account is now current and in good standing. I understand that this negative mark is technically accurate, but I am hoping you will consider my overall history and grant a goodwill adjustment to remove it.

This late payment mark is significantly impacting my credit score and my ability to [specific goal - e.g., secure a mortgage, refinance student loans, etc.]. Your consideration of this request would be deeply appreciated.

Thank you for your time and for the continued service you provide.

Sincerely,

${data.name}`;
}

// ──────────────────────────────────────
// Format Helpers
// ──────────────────────────────────────

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatCurrencyExact(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
}

export function formatPercent(value: number): string {
  return `${value.toFixed(2)}%`;
}

export function formatMonths(months: number): string {
  const years = Math.floor(months / 12);
  const remaining = months % 12;
  if (years === 0) return `${remaining}mo`;
  if (remaining === 0) return `${years}yr`;
  return `${years}yr ${remaining}mo`;
}
