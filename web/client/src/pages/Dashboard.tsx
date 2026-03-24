import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import type { Debt } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  CreditCard,
  TrendingDown,
  TrendingUp,
  DollarSign,
  Clock,
  AlertTriangle,
  ArrowRight,
  Plus,
  Gauge,
} from "lucide-react";
import {
  calculatePayoffPlan,
  calculateUtilization,
  formatCurrency,
  formatPercent,
  formatMonths,
} from "@/lib/calculations";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { apiRequest } from "@/lib/queryClient";

const COLORS = [
  "hsl(183, 85%, 28%)",
  "hsl(142, 55%, 40%)",
  "hsl(24, 75%, 52%)",
  "hsl(262, 55%, 52%)",
  "hsl(340, 60%, 52%)",
  "hsl(38, 92%, 50%)",
];

export default function Dashboard() {
  const { data: debts, isLoading } = useQuery<Debt[]>({
    queryKey: ["/api/debts"],
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-28 rounded-lg" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Skeleton className="h-72 rounded-lg" />
          <Skeleton className="h-72 rounded-lg" />
        </div>
      </div>
    );
  }

  if (!debts || debts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center" data-testid="empty-state">
        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-6">
          <CreditCard className="w-8 h-8 text-muted-foreground" />
        </div>
        <h2 className="text-xl font-semibold mb-2">No debts added yet</h2>
        <p className="text-muted-foreground text-sm max-w-sm mb-6">
          Add your credit card, student loan, auto loan, or personal loan details to get personalized payoff strategies and score insights.
        </p>
        <Link href="/debts">
          <Button data-testid="add-first-debt">
            <Plus className="w-4 h-4 mr-2" />
            Add Your First Debt
          </Button>
        </Link>
      </div>
    );
  }

  const totalDebt = debts.reduce((s, d) => s + d.balance, 0);
  const totalMinPayment = debts.reduce((s, d) => s + d.minimumPayment, 0);
  const highestApr = Math.max(...debts.map((d) => d.apr));
  const utilization = calculateUtilization(debts);

  const avalanche = calculatePayoffPlan(debts, "avalanche", 0);
  const snowball = calculatePayoffPlan(debts, "snowball", 0);
  const interestSaved = snowball.totalInterestPaid - avalanche.totalInterestPaid;

  // Chart data: balance over time (avalanche)
  const chartData = avalanche.monthlySchedule
    .filter((_, i) => i % 3 === 0 || i === avalanche.monthlySchedule.length - 1)
    .map((m) => ({
      date: m.date,
      balance: m.remainingBalance,
    }));

  // Pie data: debt breakdown by type
  const typeBreakdown = debts.reduce(
    (acc, d) => {
      const key = d.type;
      acc[key] = (acc[key] || 0) + d.balance;
      return acc;
    },
    {} as Record<string, number>
  );
  const pieData = Object.entries(typeBreakdown).map(([name, value]) => ({
    name: name
      .split("_")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" "),
    value: Math.round(value),
  }));

  // Urgency alerts
  const alerts: string[] = [];
  if (utilization.overall > 50) alerts.push(`Credit utilization at ${formatPercent(utilization.overall)} — target below 30%`);
  const highAprDebts = debts.filter((d) => d.apr > 20);
  if (highAprDebts.length > 0) alerts.push(`${highAprDebts.length} debt(s) above 20% APR — consider balance transfer`);
  if (avalanche.payoffMonths > 60) alerts.push(`Current payoff timeline: ${formatMonths(avalanche.payoffMonths)} at minimums only`);

  return (
    <div className="space-y-6" data-testid="dashboard">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">Overview of your debt picture and fastest paths to freedom</p>
      </div>

      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="space-y-2" data-testid="alerts">
          {alerts.map((alert, i) => (
            <div
              key={i}
              className="flex items-start gap-3 p-3 rounded-lg bg-destructive/8 border border-destructive/20 text-sm"
            >
              <AlertTriangle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
              <span>{alert}</span>
            </div>
          ))}
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" data-testid="kpi-cards">
        <Card>
          <CardContent className="pt-5 pb-4 px-5">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Total Debt</p>
              <DollarSign className="w-4 h-4 text-muted-foreground" />
            </div>
            <p className="text-xl font-semibold mt-2 tabular-nums" data-testid="total-debt">
              {formatCurrency(totalDebt)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">{debts.length} accounts</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5 pb-4 px-5">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Monthly Minimum</p>
              <Clock className="w-4 h-4 text-muted-foreground" />
            </div>
            <p className="text-xl font-semibold mt-2 tabular-nums" data-testid="monthly-min">
              {formatCurrency(totalMinPayment)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">across all debts</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5 pb-4 px-5">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Highest APR</p>
              <TrendingUp className="w-4 h-4 text-destructive" />
            </div>
            <p className="text-xl font-semibold mt-2 tabular-nums" data-testid="highest-apr">
              {formatPercent(highestApr)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {debts.find((d) => d.apr === highestApr)?.name}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5 pb-4 px-5">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Utilization</p>
              <Gauge className="w-4 h-4 text-muted-foreground" />
            </div>
            <p className={`text-xl font-semibold mt-2 tabular-nums ${utilization.overall > 30 ? "text-destructive" : "text-green-600 dark:text-green-400"}`} data-testid="utilization">
              {utilization.totalLimit > 0 ? formatPercent(utilization.overall) : "N/A"}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {utilization.totalLimit > 0 ? `${formatCurrency(utilization.totalBalance)} of ${formatCurrency(utilization.totalLimit)}` : "No credit cards"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Payoff comparison banner */}
      <Card className="bg-primary/5 border-primary/15">
        <CardContent className="py-4 px-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <TrendingDown className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium">Avalanche saves {formatCurrency(Math.abs(interestSaved))} in interest</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Payoff in {formatMonths(avalanche.payoffMonths)} (avalanche) vs {formatMonths(snowball.payoffMonths)} (snowball) at minimum payments
              </p>
            </div>
            <Link href="/payoff">
              <Button variant="outline" size="sm" data-testid="view-plans">
                Compare Plans <ArrowRight className="w-3 h-3 ml-1" />
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Balance over time */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Projected Balance (Avalanche)</CardTitle>
          </CardHeader>
          <CardContent className="pb-4">
            <div className="h-56" data-testid="balance-chart">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="balanceGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(183, 85%, 28%)" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="hsl(183, 85%, 28%)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 11 }}
                    tickFormatter={(v) => v.slice(2)}
                    interval="preserveStartEnd"
                    stroke="hsl(var(--muted-foreground))"
                  />
                  <YAxis
                    tick={{ fontSize: 11 }}
                    tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                    width={48}
                    stroke="hsl(var(--muted-foreground))"
                  />
                  <Tooltip
                    formatter={(value: number) => [formatCurrency(value), "Balance"]}
                    contentStyle={{
                      background: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="balance"
                    stroke="hsl(183, 85%, 28%)"
                    strokeWidth={2}
                    fill="url(#balanceGrad)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Debt type breakdown */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Debt Breakdown</CardTitle>
          </CardHeader>
          <CardContent className="pb-4">
            <div className="h-44" data-testid="pie-chart">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={65}
                    strokeWidth={2}
                    stroke="hsl(var(--card))"
                  >
                    {pieData.map((_, index) => (
                      <Cell key={index} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number) => formatCurrency(value)}
                    contentStyle={{
                      background: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-1.5 mt-2">
              {pieData.map((entry, i) => (
                <div key={entry.name} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ background: COLORS[i % COLORS.length] }}
                    />
                    <span className="text-muted-foreground">{entry.name}</span>
                  </div>
                  <span className="tabular-nums font-medium">{formatCurrency(entry.value)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Debt table */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium">All Debts</CardTitle>
            <Link href="/debts">
              <Button variant="ghost" size="sm" className="text-xs">
                Manage <ArrowRight className="w-3 h-3 ml-1" />
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent className="pb-4 px-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm" data-testid="debt-table">
              <thead>
                <tr className="border-b border-border text-xs text-muted-foreground">
                  <th className="text-left font-medium px-5 pb-2">Name</th>
                  <th className="text-left font-medium px-3 pb-2">Type</th>
                  <th className="text-right font-medium px-3 pb-2">Balance</th>
                  <th className="text-right font-medium px-3 pb-2">APR</th>
                  <th className="text-right font-medium px-3 pb-2">Min Payment</th>
                  <th className="text-right font-medium px-5 pb-2">Payoff</th>
                </tr>
              </thead>
              <tbody>
                {debts
                  .sort((a, b) => b.apr - a.apr)
                  .map((debt) => {
                    const singlePlan = calculatePayoffPlan([debt], "avalanche", 0);
                    return (
                      <tr key={debt.id} className="border-b border-border/50 last:border-0">
                        <td className="px-5 py-2.5 font-medium">{debt.name}</td>
                        <td className="px-3 py-2.5">
                          <Badge variant="secondary" className="text-xs font-normal">
                            {debt.type.split("_").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")}
                          </Badge>
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums">{formatCurrency(debt.balance)}</td>
                        <td className={`px-3 py-2.5 text-right tabular-nums ${debt.apr > 20 ? "text-destructive font-medium" : ""}`}>
                          {formatPercent(debt.apr)}
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums">{formatCurrency(debt.minimumPayment)}</td>
                        <td className="px-5 py-2.5 text-right tabular-nums text-muted-foreground">
                          {formatMonths(singlePlan.payoffMonths)}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
