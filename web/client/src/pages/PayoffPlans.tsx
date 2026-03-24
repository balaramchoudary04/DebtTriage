import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Debt } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingDown, DollarSign, Calendar, ArrowDown, CheckCircle } from "lucide-react";
import {
  calculatePayoffPlan,
  formatCurrency,
  formatCurrencyExact,
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
  BarChart,
  Bar,
  Legend,
} from "recharts";
import { Link } from "wouter";

export default function PayoffPlans() {
  const [extraMonthly, setExtraMonthly] = useState(100);

  const { data: debts, isLoading } = useQuery<Debt[]>({
    queryKey: ["/api/debts"],
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-80 rounded-lg" />
      </div>
    );
  }

  if (!debts || debts.length === 0) {
    return (
      <div className="text-center py-24">
        <TrendingDown className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-30" />
        <p className="text-sm text-muted-foreground">Add debts first to see payoff plans.</p>
        <Link href="/debts">
          <Button variant="outline" size="sm" className="mt-4">Go to My Debts</Button>
        </Link>
      </div>
    );
  }

  const avalanche = calculatePayoffPlan(debts, "avalanche", extraMonthly);
  const snowball = calculatePayoffPlan(debts, "snowball", extraMonthly);
  const minimumsOnly = calculatePayoffPlan(debts, "avalanche", 0);

  const interestSaved = minimumsOnly.totalInterestPaid - avalanche.totalInterestPaid;
  const avVsSnow = snowball.totalInterestPaid - avalanche.totalInterestPaid;
  const timeSavedMonths = minimumsOnly.payoffMonths - avalanche.payoffMonths;
  const totalMinPayment = debts.reduce((s, d) => s + d.minimumPayment, 0);

  // Comparison chart data
  const maxLen = Math.max(avalanche.monthlySchedule.length, snowball.monthlySchedule.length);
  const comparisonData = [];
  for (let i = 0; i < maxLen; i += 3) {
    const avMonth = avalanche.monthlySchedule[i];
    const snMonth = snowball.monthlySchedule[i];
    comparisonData.push({
      date: avMonth?.date || snMonth?.date || "",
      avalanche: avMonth?.remainingBalance || 0,
      snowball: snMonth?.remainingBalance || 0,
    });
  }

  // Interest comparison bar data
  const interestComparison = [
    { name: "Minimums Only", interest: minimumsOnly.totalInterestPaid, fill: "hsl(var(--muted-foreground))" },
    { name: "Avalanche", interest: avalanche.totalInterestPaid, fill: "hsl(183, 85%, 28%)" },
    { name: "Snowball", interest: snowball.totalInterestPaid, fill: "hsl(142, 55%, 40%)" },
  ];

  return (
    <div className="space-y-6" data-testid="payoff-page">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Payoff Plans</h1>
        <p className="text-sm text-muted-foreground mt-1">Compare avalanche vs snowball strategies and see how extra payments accelerate payoff</p>
      </div>

      {/* Extra payment slider */}
      <Card>
        <CardContent className="pt-5 pb-4 px-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium">Extra Monthly Payment</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Beyond your {formatCurrency(totalMinPayment)}/mo minimum
              </p>
            </div>
            <div className="flex items-center gap-4 min-w-[280px]">
              <Slider
                value={[extraMonthly]}
                onValueChange={([v]) => setExtraMonthly(v)}
                min={0}
                max={Math.max(1000, totalMinPayment * 2)}
                step={25}
                className="flex-1"
                data-testid="extra-payment-slider"
              />
              <span className="text-lg font-semibold tabular-nums w-20 text-right" data-testid="extra-amount">
                {formatCurrency(extraMonthly)}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="bg-primary/5 border-primary/15">
          <CardContent className="pt-5 pb-4 px-5">
            <DollarSign className="w-4 h-4 text-primary mb-2" />
            <p className="text-xs text-muted-foreground">Interest Saved vs Minimums</p>
            <p className="text-xl font-semibold tabular-nums text-primary mt-1" data-testid="interest-saved">
              {formatCurrency(interestSaved)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-4 px-5">
            <Calendar className="w-4 h-4 text-muted-foreground mb-2" />
            <p className="text-xs text-muted-foreground">Time Saved</p>
            <p className="text-xl font-semibold tabular-nums mt-1" data-testid="time-saved">
              {formatMonths(timeSavedMonths)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-4 px-5">
            <ArrowDown className="w-4 h-4 text-muted-foreground mb-2" />
            <p className="text-xs text-muted-foreground">Avalanche vs Snowball</p>
            <p className="text-xl font-semibold tabular-nums mt-1">
              {formatCurrency(Math.abs(avVsSnow))} {avVsSnow > 0 ? "less" : "more"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Strategy tabs */}
      <Tabs defaultValue="comparison">
        <TabsList>
          <TabsTrigger value="comparison">Comparison</TabsTrigger>
          <TabsTrigger value="avalanche">Avalanche</TabsTrigger>
          <TabsTrigger value="snowball">Snowball</TabsTrigger>
        </TabsList>

        <TabsContent value="comparison" className="space-y-4 mt-4">
          {/* Balance over time comparison */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Balance Over Time</CardTitle>
            </CardHeader>
            <CardContent className="pb-4">
              <div className="h-64" data-testid="comparison-chart">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={comparisonData}>
                    <defs>
                      <linearGradient id="avGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(183, 85%, 28%)" stopOpacity={0.15} />
                        <stop offset="95%" stopColor="hsl(183, 85%, 28%)" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="snGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(142, 55%, 40%)" stopOpacity={0.15} />
                        <stop offset="95%" stopColor="hsl(142, 55%, 40%)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(v) => v.slice(2)} interval="preserveStartEnd" stroke="hsl(var(--muted-foreground))" />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`} width={48} stroke="hsl(var(--muted-foreground))" />
                    <Tooltip
                      formatter={(value: number, name: string) => [formatCurrency(value), name === "avalanche" ? "Avalanche" : "Snowball"]}
                      contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                    />
                    <Area type="monotone" dataKey="avalanche" stroke="hsl(183, 85%, 28%)" strokeWidth={2} fill="url(#avGrad)" name="avalanche" />
                    <Area type="monotone" dataKey="snowball" stroke="hsl(142, 55%, 40%)" strokeWidth={2} fill="url(#snGrad)" name="snowball" />
                    <Legend
                      formatter={(value: string) => value === "avalanche" ? "Avalanche" : "Snowball"}
                      wrapperStyle={{ fontSize: 12 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Interest comparison */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Total Interest Paid</CardTitle>
            </CardHeader>
            <CardContent className="pb-4">
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={interestComparison} layout="vertical">
                    <XAxis type="number" tickFormatter={(v) => formatCurrency(v)} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                    <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                    <Tooltip
                      formatter={(value: number) => [formatCurrencyExact(value), "Interest"]}
                      contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                    />
                    <Bar dataKey="interest" radius={[0, 4, 4, 0]}>
                      {interestComparison.map((entry, i) => (
                        <Bar key={i} dataKey="interest" fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Side-by-side summary */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-sm font-medium">Avalanche Method</CardTitle>
                  <Badge variant="secondary" className="text-xs">Saves Most Interest</Badge>
                </div>
              </CardHeader>
              <CardContent className="pb-4 text-sm space-y-2">
                <p className="text-xs text-muted-foreground">Pays highest APR first. Mathematically optimal.</p>
                <div className="grid grid-cols-2 gap-y-2 mt-3">
                  <span className="text-muted-foreground text-xs">Payoff Date</span>
                  <span className="text-right tabular-nums font-medium text-xs">{avalanche.payoffDate}</span>
                  <span className="text-muted-foreground text-xs">Total Interest</span>
                  <span className="text-right tabular-nums font-medium text-xs">{formatCurrencyExact(avalanche.totalInterestPaid)}</span>
                  <span className="text-muted-foreground text-xs">Total Paid</span>
                  <span className="text-right tabular-nums font-medium text-xs">{formatCurrencyExact(avalanche.totalPaid)}</span>
                  <span className="text-muted-foreground text-xs">Timeline</span>
                  <span className="text-right tabular-nums font-medium text-xs">{formatMonths(avalanche.payoffMonths)}</span>
                </div>
                <div className="mt-3 pt-3 border-t border-border space-y-1.5">
                  <p className="text-xs font-medium">Payoff Order</p>
                  {avalanche.debtPayoffOrder.map((d, i) => (
                    <div key={d.debtId} className="flex items-center gap-2 text-xs">
                      <span className="w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-medium shrink-0">{i + 1}</span>
                      <span>{d.name}</span>
                      <span className="text-muted-foreground ml-auto tabular-nums">Month {d.payoffMonth}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-sm font-medium">Snowball Method</CardTitle>
                  <Badge variant="secondary" className="text-xs">Faster Quick Wins</Badge>
                </div>
              </CardHeader>
              <CardContent className="pb-4 text-sm space-y-2">
                <p className="text-xs text-muted-foreground">Pays smallest balance first. Motivational momentum.</p>
                <div className="grid grid-cols-2 gap-y-2 mt-3">
                  <span className="text-muted-foreground text-xs">Payoff Date</span>
                  <span className="text-right tabular-nums font-medium text-xs">{snowball.payoffDate}</span>
                  <span className="text-muted-foreground text-xs">Total Interest</span>
                  <span className="text-right tabular-nums font-medium text-xs">{formatCurrencyExact(snowball.totalInterestPaid)}</span>
                  <span className="text-muted-foreground text-xs">Total Paid</span>
                  <span className="text-right tabular-nums font-medium text-xs">{formatCurrencyExact(snowball.totalPaid)}</span>
                  <span className="text-muted-foreground text-xs">Timeline</span>
                  <span className="text-right tabular-nums font-medium text-xs">{formatMonths(snowball.payoffMonths)}</span>
                </div>
                <div className="mt-3 pt-3 border-t border-border space-y-1.5">
                  <p className="text-xs font-medium">Payoff Order</p>
                  {snowball.debtPayoffOrder.map((d, i) => (
                    <div key={d.debtId} className="flex items-center gap-2 text-xs">
                      <span className="w-5 h-5 rounded-full bg-green-500/10 text-green-600 dark:text-green-400 flex items-center justify-center text-[10px] font-medium shrink-0">{i + 1}</span>
                      <span>{d.name}</span>
                      <span className="text-muted-foreground ml-auto tabular-nums">Month {d.payoffMonth}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="avalanche" className="mt-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Avalanche Monthly Schedule</CardTitle>
            </CardHeader>
            <CardContent className="pb-4 px-0">
              <div className="overflow-x-auto max-h-96">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-card z-10">
                    <tr className="border-b border-border text-muted-foreground">
                      <th className="text-left font-medium px-5 pb-2">Month</th>
                      <th className="text-right font-medium px-3 pb-2">Payment</th>
                      <th className="text-right font-medium px-3 pb-2">Principal</th>
                      <th className="text-right font-medium px-3 pb-2">Interest</th>
                      <th className="text-right font-medium px-5 pb-2">Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {avalanche.monthlySchedule.map((m) => (
                      <tr key={m.month} className="border-b border-border/50">
                        <td className="px-5 py-1.5 tabular-nums">{m.date}</td>
                        <td className="px-3 py-1.5 text-right tabular-nums">{formatCurrencyExact(m.payment)}</td>
                        <td className="px-3 py-1.5 text-right tabular-nums text-green-600 dark:text-green-400">{formatCurrencyExact(m.principal)}</td>
                        <td className="px-3 py-1.5 text-right tabular-nums text-destructive">{formatCurrencyExact(m.interest)}</td>
                        <td className="px-5 py-1.5 text-right tabular-nums font-medium">{formatCurrencyExact(m.remainingBalance)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="snowball" className="mt-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Snowball Monthly Schedule</CardTitle>
            </CardHeader>
            <CardContent className="pb-4 px-0">
              <div className="overflow-x-auto max-h-96">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-card z-10">
                    <tr className="border-b border-border text-muted-foreground">
                      <th className="text-left font-medium px-5 pb-2">Month</th>
                      <th className="text-right font-medium px-3 pb-2">Payment</th>
                      <th className="text-right font-medium px-3 pb-2">Principal</th>
                      <th className="text-right font-medium px-3 pb-2">Interest</th>
                      <th className="text-right font-medium px-5 pb-2">Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {snowball.monthlySchedule.map((m) => (
                      <tr key={m.month} className="border-b border-border/50">
                        <td className="px-5 py-1.5 tabular-nums">{m.date}</td>
                        <td className="px-3 py-1.5 text-right tabular-nums">{formatCurrencyExact(m.payment)}</td>
                        <td className="px-3 py-1.5 text-right tabular-nums text-green-600 dark:text-green-400">{formatCurrencyExact(m.principal)}</td>
                        <td className="px-3 py-1.5 text-right tabular-nums text-destructive">{formatCurrencyExact(m.interest)}</td>
                        <td className="px-5 py-1.5 text-right tabular-nums font-medium">{formatCurrencyExact(m.remainingBalance)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
