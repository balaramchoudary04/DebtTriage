import { useQuery } from "@tanstack/react-query";
import type { Debt } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { ArrowLeftRight, CheckCircle, AlertTriangle, ExternalLink } from "lucide-react";
import {
  screenBalanceTransfers,
  screenConsolidation,
  formatCurrency,
  formatCurrencyExact,
  formatPercent,
} from "@/lib/calculations";

export default function TransferConsolidation() {
  const { data: debts, isLoading } = useQuery<Debt[]>({
    queryKey: ["/api/debts"],
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-60 rounded-lg" />
      </div>
    );
  }

  if (!debts || debts.length === 0) {
    return (
      <div className="text-center py-24">
        <ArrowLeftRight className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-30" />
        <p className="text-sm text-muted-foreground">Add debts first to see transfer and consolidation options.</p>
        <Link href="/debts">
          <Button variant="outline" size="sm" className="mt-4">Go to My Debts</Button>
        </Link>
      </div>
    );
  }

  const ccDebts = debts.filter((d) => d.type === "credit_card");
  const btOptions = screenBalanceTransfers(ccDebts);
  const consolidationOptions = screenConsolidation(debts);

  const totalCCBalance = ccDebts.reduce((s, d) => s + d.balance, 0);
  const totalAllBalance = debts.reduce((s, d) => s + d.balance, 0);
  const avgCCRate = ccDebts.length > 0
    ? ccDebts.reduce((s, d) => s + d.apr * d.balance, 0) / totalCCBalance
    : 0;

  return (
    <div className="space-y-6" data-testid="transfer-page">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Transfer & Consolidation</h1>
        <p className="text-sm text-muted-foreground mt-1">Screen balance transfer cards and personal loan consolidation offers</p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-5 pb-4 px-5">
            <p className="text-xs text-muted-foreground">Credit Card Balance</p>
            <p className="text-xl font-semibold tabular-nums mt-1">{formatCurrency(totalCCBalance)}</p>
            <p className="text-xs text-muted-foreground mt-1">{ccDebts.length} card(s) avg {formatPercent(avgCCRate)} APR</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-4 px-5">
            <p className="text-xs text-muted-foreground">Total All Debts</p>
            <p className="text-xl font-semibold tabular-nums mt-1">{formatCurrency(totalAllBalance)}</p>
            <p className="text-xs text-muted-foreground mt-1">{debts.length} account(s)</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-4 px-5">
            <p className="text-xs text-muted-foreground">Best Potential Savings</p>
            <p className="text-xl font-semibold tabular-nums mt-1 text-green-600 dark:text-green-400">
              {formatCurrency(Math.max(
                btOptions[0]?.estimatedSavings || 0,
                consolidationOptions[0]?.savings || 0
              ))}
            </p>
            <p className="text-xs text-muted-foreground mt-1">estimated across all options</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="balance-transfer">
        <TabsList>
          <TabsTrigger value="balance-transfer">Balance Transfer</TabsTrigger>
          <TabsTrigger value="consolidation">Loan Consolidation</TabsTrigger>
        </TabsList>

        {/* Balance Transfer Tab */}
        <TabsContent value="balance-transfer" className="space-y-4 mt-4">
          {ccDebts.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-sm text-muted-foreground">No credit card debts to transfer</p>
              </CardContent>
            </Card>
          ) : btOptions.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <CheckCircle className="w-8 h-8 mx-auto mb-3 text-green-500" />
                <p className="text-sm font-medium">No beneficial transfers found</p>
                <p className="text-xs text-muted-foreground mt-1">Your current rates are competitive enough that transfer fees would negate savings.</p>
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="flex items-start gap-3 p-3 rounded-lg bg-primary/5 border border-primary/15 text-sm">
                <AlertTriangle className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-xs">How balance transfers work</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Transfer your CC balance to a card with a 0% intro APR. You pay a one-time transfer fee (typically 3%) but save months of interest.
                    The key: pay off the full balance before the intro period ends, or the regular APR kicks in.
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                {btOptions.map((opt, i) => (
                  <Card key={i}>
                    <CardContent className="pt-5 pb-4 px-5">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-medium text-sm">{opt.name}</h3>
                            {i === 0 && <Badge className="bg-green-500/10 text-green-600 dark:text-green-400 border-0 text-xs">Best Savings</Badge>}
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            {opt.introApr}% APR for {opt.introPeriodMonths} months · {opt.transferFee}% transfer fee · Then {formatPercent(opt.regularApr)}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-semibold tabular-nums text-green-600 dark:text-green-400">
                            Save {formatCurrency(opt.estimatedSavings)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formatCurrencyExact(opt.monthlyPayment)}/mo to pay off in intro period
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-4 gap-4 mt-4 pt-3 border-t border-border">
                        <div>
                          <p className="text-xs text-muted-foreground">Intro APR</p>
                          <p className="text-sm font-semibold tabular-nums text-green-600 dark:text-green-400">{opt.introApr}%</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Intro Period</p>
                          <p className="text-sm font-semibold tabular-nums">{opt.introPeriodMonths}mo</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Transfer Fee</p>
                          <p className="text-sm font-semibold tabular-nums">{formatCurrencyExact(totalCCBalance * opt.transferFee / 100)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Total Cost</p>
                          <p className="text-sm font-semibold tabular-nums">{formatCurrency(opt.totalCost)}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </>
          )}
        </TabsContent>

        {/* Consolidation Tab */}
        <TabsContent value="consolidation" className="space-y-4 mt-4">
          {debts.length < 2 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-sm text-muted-foreground">Need at least 2 debts for consolidation analysis</p>
              </CardContent>
            </Card>
          ) : consolidationOptions.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <CheckCircle className="w-8 h-8 mx-auto mb-3 text-green-500" />
                <p className="text-sm font-medium">No beneficial consolidation options</p>
                <p className="text-xs text-muted-foreground mt-1">Your current weighted rate is already competitive. Focus on the avalanche method instead.</p>
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="flex items-start gap-3 p-3 rounded-lg bg-primary/5 border border-primary/15 text-sm">
                <AlertTriangle className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-xs">How consolidation works</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Take out a single personal loan at a lower rate to pay off all your existing debts. You get one fixed monthly payment, a
                    set payoff date, and potentially significant interest savings. Rates shown are representative; your actual rate depends on credit score and income.
                  </p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm" data-testid="consolidation-table">
                  <thead>
                    <tr className="border-b border-border text-xs text-muted-foreground">
                      <th className="text-left font-medium px-4 pb-2">Lender</th>
                      <th className="text-right font-medium px-3 pb-2">APR</th>
                      <th className="text-right font-medium px-3 pb-2">Term</th>
                      <th className="text-right font-medium px-3 pb-2">Monthly</th>
                      <th className="text-right font-medium px-3 pb-2">Total Interest</th>
                      <th className="text-right font-medium px-4 pb-2">Savings</th>
                    </tr>
                  </thead>
                  <tbody>
                    {consolidationOptions.slice(0, 10).map((opt, i) => (
                      <tr key={i} className="border-b border-border/50">
                        <td className="px-4 py-2.5 font-medium">
                          {opt.name}
                          {i === 0 && (
                            <Badge className="ml-2 bg-green-500/10 text-green-600 dark:text-green-400 border-0 text-[10px]">Best</Badge>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums">{formatPercent(opt.apr)}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums">{opt.termMonths}mo</td>
                        <td className="px-3 py-2.5 text-right tabular-nums">{formatCurrencyExact(opt.monthlyPayment)}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums">{formatCurrency(opt.totalInterest)}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums font-medium text-green-600 dark:text-green-400">
                          {formatCurrency(opt.savings)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
