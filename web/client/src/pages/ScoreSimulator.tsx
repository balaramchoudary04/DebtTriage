import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Debt } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Gauge, TrendingUp, ArrowUp, ArrowDown, Target, Info } from "lucide-react";
import { Link } from "wouter";
import {
  calculateUtilization,
  simulateScoreImpact,
  formatCurrency,
  formatPercent,
} from "@/lib/calculations";

function ScoreGauge({ low, high, label }: { low: number; high: number; label: string }) {
  const mid = (low + high) / 2;
  const pct = ((mid - 300) / 550) * 100;
  let color = "text-destructive";
  if (mid >= 740) color = "text-green-600 dark:text-green-400";
  else if (mid >= 670) color = "text-yellow-500";
  else if (mid >= 580) color = "text-orange-500";

  return (
    <div className="text-center">
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <p className={`text-2xl font-bold tabular-nums ${color}`}>{low}–{high}</p>
      <div className="w-full h-2 bg-muted rounded-full mt-2 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${Math.min(pct, 100)}%`,
            background: `linear-gradient(90deg, hsl(0, 72%, 48%), hsl(38, 92%, 50%), hsl(142, 55%, 40%))`,
          }}
        />
      </div>
      <div className="flex justify-between text-[10px] text-muted-foreground mt-0.5">
        <span>300</span>
        <span>580</span>
        <span>670</span>
        <span>740</span>
        <span>850</span>
      </div>
    </div>
  );
}

export default function ScoreSimulator() {
  const [scoreRange, setScoreRange] = useState<[number, number]>([620, 680]);
  const [paydownAmount, setPaydownAmount] = useState(0);

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
        <Gauge className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-30" />
        <p className="text-sm text-muted-foreground">Add debts first to simulate score impact.</p>
        <Link href="/debts">
          <Button variant="outline" size="sm" className="mt-4">Go to My Debts</Button>
        </Link>
      </div>
    );
  }

  const utilization = calculateUtilization(debts);
  const simulation = simulateScoreImpact(debts, scoreRange);

  // Paydown simulator
  const ccDebts = debts.filter((d) => d.type === "credit_card");
  const totalCCBalance = ccDebts.reduce((s, d) => s + d.balance, 0);
  const totalLimit = ccDebts.reduce((s, d) => s + (d.creditLimit || 0), 0);
  const afterPaydownBalance = Math.max(0, totalCCBalance - paydownAmount);
  const afterPaydownUtil = totalLimit > 0 ? (afterPaydownBalance / totalLimit) * 100 : 0;

  // Estimate score impact of paydown
  let paydownScoreBoost: [number, number] = [0, 0];
  if (utilization.overall > 30 && afterPaydownUtil <= 30) {
    paydownScoreBoost = [15, 40];
  } else if (utilization.overall > 10 && afterPaydownUtil <= 10) {
    paydownScoreBoost = [25, 65];
  } else if (paydownAmount > 0 && utilization.overall > afterPaydownUtil) {
    const utilDrop = utilization.overall - afterPaydownUtil;
    paydownScoreBoost = [Math.round(utilDrop * 0.5), Math.round(utilDrop * 1.5)];
  }

  return (
    <div className="space-y-6" data-testid="score-page">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Score Simulator</h1>
        <p className="text-sm text-muted-foreground mt-1">See how actions affect your credit utilization and estimated score range</p>
      </div>

      {/* Current score input */}
      <Card>
        <CardContent className="pt-5 pb-4 px-5">
          <div className="flex flex-col sm:flex-row sm:items-end gap-6">
            <div className="flex-1">
              <Label className="text-xs mb-2 block">Your Current Score Range (estimate)</Label>
              <div className="flex items-center gap-3">
                <Input
                  type="number"
                  min={300}
                  max={850}
                  value={scoreRange[0]}
                  onChange={(e) => setScoreRange([parseInt(e.target.value) || 300, scoreRange[1]])}
                  className="w-24 tabular-nums"
                  data-testid="score-low"
                />
                <span className="text-muted-foreground">to</span>
                <Input
                  type="number"
                  min={300}
                  max={850}
                  value={scoreRange[1]}
                  onChange={(e) => setScoreRange([scoreRange[0], parseInt(e.target.value) || 850])}
                  className="w-24 tabular-nums"
                  data-testid="score-high"
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1">Check Credit Karma, your bank app, or annualcreditreport.com</p>
            </div>
            <div className="w-64">
              <ScoreGauge low={scoreRange[0]} high={scoreRange[1]} label="Current Estimate" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Utilization breakdown */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Credit Card Utilization</CardTitle>
        </CardHeader>
        <CardContent className="pb-4 px-5 space-y-4">
          {/* Overall */}
          <div>
            <div className="flex items-center justify-between text-sm mb-1.5">
              <span className="text-muted-foreground">Overall Utilization</span>
              <span className={`font-semibold tabular-nums ${utilization.overall > 30 ? "text-destructive" : "text-green-600 dark:text-green-400"}`}>
                {utilization.totalLimit > 0 ? formatPercent(utilization.overall) : "N/A"}
              </span>
            </div>
            {utilization.totalLimit > 0 && (
              <div className="relative h-3 bg-muted rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    utilization.overall > 50 ? "bg-destructive" : utilization.overall > 30 ? "bg-yellow-500" : "bg-green-500"
                  }`}
                  style={{ width: `${Math.min(utilization.overall, 100)}%` }}
                />
                {/* Target markers */}
                <div className="absolute top-0 bottom-0 w-px bg-foreground/30" style={{ left: "10%" }} />
                <div className="absolute top-0 bottom-0 w-px bg-foreground/30" style={{ left: "30%" }} />
              </div>
            )}
            <div className="flex justify-between text-[10px] text-muted-foreground mt-0.5">
              <span>0%</span>
              <span className="ml-[8%]">10% ideal</span>
              <span className="ml-[14%]">30% max</span>
              <span className="ml-auto">100%</span>
            </div>
          </div>

          {/* Per card */}
          {utilization.perCard.length > 0 && (
            <div className="space-y-2 pt-2">
              <p className="text-xs font-medium">Per Card</p>
              {utilization.perCard.map((card) => (
                <div key={card.name} className="flex items-center gap-3 text-xs">
                  <span className="w-32 truncate text-muted-foreground">{card.name}</span>
                  <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${card.utilization > 50 ? "bg-destructive" : card.utilization > 30 ? "bg-yellow-500" : "bg-green-500"}`}
                      style={{ width: `${Math.min(card.utilization, 100)}%` }}
                    />
                  </div>
                  <span className="w-20 text-right tabular-nums">
                    {formatPercent(card.utilization)} ({formatCurrency(card.balance)}/{formatCurrency(card.limit)})
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Paydown simulator */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Paydown Simulator</CardTitle>
        </CardHeader>
        <CardContent className="pb-4 px-5">
          <p className="text-xs text-muted-foreground mb-3">See how a lump-sum payment would change your utilization and score</p>
          <div className="flex items-center gap-4">
            <Slider
              value={[paydownAmount]}
              onValueChange={([v]) => setPaydownAmount(v)}
              min={0}
              max={Math.ceil(totalCCBalance / 100) * 100}
              step={50}
              className="flex-1"
              data-testid="paydown-slider"
            />
            <span className="text-lg font-semibold tabular-nums w-24 text-right" data-testid="paydown-amount">
              {formatCurrency(paydownAmount)}
            </span>
          </div>

          {paydownAmount > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4 pt-3 border-t border-border">
              <div>
                <p className="text-xs text-muted-foreground">New Utilization</p>
                <p className={`text-lg font-semibold tabular-nums ${afterPaydownUtil > 30 ? "text-destructive" : "text-green-600 dark:text-green-400"}`}>
                  {formatPercent(afterPaydownUtil)}
                </p>
                <p className="text-xs text-muted-foreground">
                  from {formatPercent(utilization.overall)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Estimated Score Boost</p>
                <p className="text-lg font-semibold tabular-nums text-green-600 dark:text-green-400">
                  +{paydownScoreBoost[0]} to +{paydownScoreBoost[1]}
                </p>
                <p className="text-xs text-muted-foreground">points (1-2 billing cycles)</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">New Score Estimate</p>
                <p className="text-lg font-semibold tabular-nums">
                  {Math.min(scoreRange[0] + paydownScoreBoost[0], 850)}–{Math.min(scoreRange[1] + paydownScoreBoost[1], 850)}
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Action impact table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Score Impact Actions</CardTitle>
        </CardHeader>
        <CardContent className="pb-4 px-5">
          <p className="text-xs text-muted-foreground mb-4">Ranked actions and their estimated impact on your score</p>
          <div className="space-y-3" data-testid="score-actions">
            {simulation.afterActions.map((action, i) => (
              <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-muted/30">
                <div className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-medium shrink-0 mt-0.5">
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{action.action}</p>
                  <div className="flex items-center gap-3 mt-1">
                    <Badge variant="secondary" className="text-xs">
                      <ArrowUp className="w-3 h-3 mr-1 text-green-500" />
                      +{action.impact[0]} to +{action.impact[1]} pts
                    </Badge>
                    <span className="text-xs text-muted-foreground">{action.timeframe}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    New estimate: {action.newEstimate[0]}–{action.newEstimate[1]}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Disclaimer */}
      <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/30 text-xs text-muted-foreground">
        <Info className="w-4 h-4 shrink-0 mt-0.5" />
        <p>
          Score estimates are approximate and based on general FICO scoring factors. Your actual score depends on payment history,
          credit age, mix, recent inquiries, and other factors not modeled here. Check your actual score through Credit Karma,
          your bank, or annualcreditreport.com for the most accurate picture.
        </p>
      </div>
    </div>
  );
}
