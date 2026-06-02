import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, fmtMoney } from "../lib/api";
import { STRATEGIES, GlassTooltip } from "../lib/constants";
import { useAuth } from "../contexts/AuthContext";
import { Slider } from "../components/ui/slider";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { TrendingUp, Sparkles, Lock, Crown, Coffee, Tv, Briefcase, Utensils } from "lucide-react";

export default function Simulator() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isPremium = !!(user && user.premium_until && new Date(user.premium_until) > new Date());
  const [extra, setExtra] = useState(0);
  const [strategy, setStrategy] = useState("avalanche");
  const [baseResult, setBaseResult] = useState(null);
  const [boostedResult, setBoostedResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [debts, setDebts] = useState([]);
  const [tab, setTab] = useState("extra"); // "extra" | "refi"

  // Refinancing State
  const [refiApr, setRefiApr] = useState(9.9);
  const [refiTerm, setRefiTerm] = useState(36);
  const [refiFee, setRefiFee] = useState(1.5); // 1.5% origination fee default

  const compute = async (s, val) => {
    if (!isPremium) return;
    setLoading(true);
    try {
      const [base, boosted] = await Promise.all([
        api.post("/strategies/calculate", { strategy: s, extra_payment: 0 }),
        api.post("/strategies/calculate", { strategy: s, extra_payment: val }),
      ]);
      setBaseResult(base.data);
      setBoostedResult(boosted.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isPremium) {
      api.get("/debts").then((r) => setDebts(r.data)).catch(() => {});
      compute(strategy, extra);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [strategy, isPremium]);

  if (!isPremium) {
    return (
      <div data-testid="simulator-locked">
        <div className="mb-10">
          <p className="text-label mb-3">What if</p>
          <h1 className="font-display text-4xl sm:text-5xl font-light tracking-tighter">
            Extra payment simulator.
          </h1>
          <p className="text-slate-400 mt-2 text-sm max-w-2xl">
            See how much faster — and cheaper — your debt disappears with extra monthly payments.
          </p>
        </div>
        <div className="glass rounded-2xl p-12 text-center relative overflow-hidden">
          <div
            className="absolute inset-0 opacity-30 pointer-events-none"
            style={{
              background:
                "radial-gradient(circle at 50% 0%, rgba(37,99,235,0.25), transparent 70%)",
            }}
          />
          <div className="relative z-10">
            <div className="w-16 h-16 rounded-2xl glass-subtle flex items-center justify-center mx-auto mb-6 border-amber-500/30">
              <Lock className="w-7 h-7 text-amber-400" />
            </div>
            <h3 className="font-display text-2xl font-medium tracking-tight mb-3">
              Simulator is a Premium feature
            </h3>
            <p className="text-slate-400 mb-8 max-w-md mx-auto">
              Upgrade to Premium ($5/month or $50/year) to unlock unlimited debts and the
              extra-payment simulator.
            </p>
            <button
              onClick={() => navigate("/settings?upgrade=1")}
              className="bg-blue-600 hover:bg-blue-500 text-white rounded-lg px-6 py-3 font-medium transition-all shadow-[0_0_30px_rgba(37,99,235,0.4)] inline-flex items-center gap-2"
              data-testid="simulator-upgrade-btn"
            >
              <Crown className="w-4 h-4" />
              Upgrade to Premium
            </button>
          </div>
        </div>
      </div>
    );
  }

  const interestSaved =
    baseResult && boostedResult
      ? Math.max(0, baseResult.total_interest - boostedResult.total_interest)
      : 0;
  const monthsSaved =
    baseResult && boostedResult ? Math.max(0, baseResult.months - boostedResult.months) : 0;

  // Merge schedules for chart
  const totalPrincipal = debts.reduce((sum, d) => sum + d.balance, 0);
  const totalMinBaseline = debts.reduce((sum, d) => sum + d.min_payment, 0);

  // Refinancing calculations
  const originationFeeAmt = totalPrincipal * (refiFee / 100);
  const refiLoanAmount = totalPrincipal + originationFeeAmt;
  const refiMonthlyRate = (refiApr / 12) / 100;

  const refiMonthlyPayment = (() => {
    if (refiLoanAmount <= 0) return 0;
    if (refiMonthlyRate <= 0) return refiLoanAmount / refiTerm;
    return (refiLoanAmount * refiMonthlyRate * Math.pow(1 + refiMonthlyRate, refiTerm)) / 
           (Math.pow(1 + refiMonthlyRate, refiTerm) - 1);
  })();

  const refiTotalRepayment = refiMonthlyPayment * refiTerm;
  const refiTotalInterest = Math.max(0, refiTotalRepayment - totalPrincipal);
  const refiInterestSaved = baseResult ? (baseResult.total_interest - refiTotalInterest) : 0;
  const refiMonthlySaved = totalMinBaseline - refiMonthlyPayment;

  const chartData = (() => {
    if (!baseResult) return [];
    if (tab === "extra") {
      if (!boostedResult) return [];
      const maxLen = Math.max(baseResult.schedule.length, boostedResult.schedule.length);
      const data = [];
      for (let i = 0; i < maxLen; i++) {
        data.push({
          month: i + 1,
          baseline: baseResult.schedule[i]?.total_remaining ?? 0,
          boosted: boostedResult.schedule[i]?.total_remaining ?? 0,
        });
      }
      return data;
    } else {
      const maxLen = Math.max(baseResult.schedule.length, refiTerm);
      const data = [];
      let refiRemaining = refiLoanAmount;
      for (let i = 0; i < maxLen; i++) {
        if (i < refiTerm && refiRemaining > 0) {
          const interest = refiRemaining * refiMonthlyRate;
          const principal = refiMonthlyPayment - interest;
          refiRemaining = Math.max(0, refiRemaining - principal);
        } else {
          refiRemaining = 0;
        }
        data.push({
          month: i + 1,
          baseline: baseResult.schedule[i]?.total_remaining ?? 0,
          refi: refiRemaining,
        });
      }
      return data;
    }
  })();

  return (
    <div data-testid="simulator-page">
      <div className="mb-8">
        <p className="text-label mb-3">What if</p>
        <h1 className="font-display text-4xl sm:text-5xl font-light tracking-tighter">
          Financial simulator.
        </h1>
        <p className="text-slate-400 mt-2 text-sm max-w-2xl">
          Model extra payments to see your time and interest savings, or simulate a consolidation refinancing loan.
        </p>
      </div>

      {/* Tab Selector */}
      <div className="flex gap-2 mb-6 border-b border-white/10 pb-4">
        <button
          onClick={() => setTab("extra")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            tab === "extra"
              ? "bg-blue-600 text-white shadow-[0_0_15px_rgba(37,99,235,0.4)]"
              : "bg-white/5 text-slate-400 hover:text-white"
          }`}
          data-testid="tab-extra"
        >
          Extra Payment Simulator
        </button>
        <button
          onClick={() => setTab("refi")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            tab === "refi"
              ? "bg-blue-600 text-white shadow-[0_0_15px_rgba(37,99,235,0.4)]"
              : "bg-white/5 text-slate-400 hover:text-white"
          }`}
          data-testid="tab-refi"
        >
          Refinancing Consolidation
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-8">
        {tab === "extra" ? (
          <div className="glass rounded-2xl p-6 lg:col-span-2" data-testid="sim-controls">
            <div className="mb-6">
              <p className="text-label">Configure</p>
              <h3 className="font-display text-lg font-medium mt-1">Your scenario</h3>
            </div>

            <div className="mb-6">
              <label className="text-xs text-slate-400 tracking-widest uppercase block mb-3">
                Strategy
              </label>
              <div className="grid grid-cols-3 gap-2">
                {STRATEGIES.filter((s) => s.key !== "custom").map((s) => (
                  <button
                    key={s.key}
                    onClick={() => setStrategy(s.key)}
                    className={`p-3 rounded-lg text-sm border transition-all ${
                      strategy === s.key
                        ? "bg-blue-600/15 border-blue-500/40 text-white"
                        : "bg-white/5 border-white/10 text-slate-400 hover:text-white"
                    }`}
                    data-testid={`sim-strategy-${s.key}`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-6">
              <label className="text-xs text-slate-400 tracking-widest uppercase block mb-3">
                Habit Presets (Quick Add)
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: "Skip Coffee", amount: 150, icon: <Coffee className="w-3.5 h-3.5 text-amber-400" /> },
                  { label: "Cut Subs", amount: 50, icon: <Tv className="w-3.5 h-3.5 text-blue-400" /> },
                  { label: "Weekend Gig", amount: 400, icon: <Briefcase className="w-3.5 h-3.5 text-emerald-400" /> },
                  { label: "Eat Out Less", amount: 250, icon: <Utensils className="w-3.5 h-3.5 text-rose-400" /> },
                ].map((p) => (
                  <button
                    key={p.label}
                    type="button"
                    onClick={() => {
                      setExtra(p.amount);
                      compute(strategy, p.amount);
                    }}
                    className={`p-3 rounded-lg border text-left transition-all ${
                      extra === p.amount
                        ? "bg-blue-600/15 border-blue-500/40 text-white"
                        : "bg-white/5 border-white/10 text-slate-400 hover:text-white"
                    }`}
                    data-testid={`sim-preset-${p.label.toLowerCase().replace(/\s+/g, "-")}`}
                  >
                    <div className="flex items-center gap-2 mb-1.5">
                      {p.icon}
                      <span className="text-xs font-semibold">{p.label}</span>
                    </div>
                    <span className="text-sm font-medium text-slate-200">+{fmtMoney(p.amount)}/mo</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-4">
                <label className="text-xs text-slate-400 tracking-widest uppercase">
                  Extra per month
                </label>
                <span className="font-display text-2xl font-light tracking-tight">
                  {fmtMoney(extra)}
                </span>
              </div>
              <Slider
                value={[extra]}
                min={0}
                max={2000}
                step={25}
                onValueChange={(v) => setExtra(v[0])}
                onValueCommit={(v) => compute(strategy, v[0])}
                data-testid="sim-slider"
              />
              <div className="flex justify-between text-xs text-slate-500 mt-2">
                <span>$0</span>
                <span>$500</span>
                <span>$1,000</span>
                <span>$1,500</span>
                <span>$2,000</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="glass rounded-2xl p-6 lg:col-span-2" data-testid="refi-controls">
            <div className="mb-6">
              <p className="text-label">Configure</p>
              <h3 className="font-display text-lg font-medium mt-1">Consolidation loan options</h3>
            </div>

            <div className="mb-6">
              <div className="flex items-center justify-between mb-3">
                <label className="text-xs text-slate-400 tracking-widest uppercase">
                  Loan Interest Rate (APR)
                </label>
                <span className="font-display text-lg font-medium text-blue-400">{refiApr.toFixed(1)}%</span>
              </div>
              <Slider
                value={[refiApr]}
                min={3.0}
                max={25.0}
                step={0.1}
                onValueChange={(v) => setRefiApr(v[0])}
                data-testid="refi-apr-slider"
              />
            </div>

            <div className="mb-6">
              <label className="text-xs text-slate-400 tracking-widest uppercase block mb-3">
                Loan Term (Months)
              </label>
              <div className="grid grid-cols-5 gap-2">
                {[12, 24, 36, 48, 60].map((term) => (
                  <button
                    key={term}
                    onClick={() => setRefiTerm(term)}
                    className={`p-3 rounded-lg text-sm font-medium border text-center transition-all ${
                      refiTerm === term
                        ? "bg-blue-600/15 border-blue-500/40 text-white"
                        : "bg-white/5 border-white/10 text-slate-400 hover:text-white"
                    }`}
                    data-testid={`refi-term-${term}`}
                  >
                    {term} mo
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-2">
              <div className="flex items-center justify-between mb-3">
                <label className="text-xs text-slate-400 tracking-widest uppercase">
                  Origination Fee
                </label>
                <span className="font-display text-lg font-medium text-slate-300">{refiFee.toFixed(1)}%</span>
              </div>
              <Slider
                value={[refiFee]}
                min={0.0}
                max={5.0}
                step={0.5}
                onValueChange={(v) => setRefiFee(v[0])}
                data-testid="refi-fee-slider"
              />
              <div className="flex justify-between text-xs text-slate-500 mt-2">
                <span>0.0% (Fee: $0)</span>
                <span>5.0% (Fee: {fmtMoney(totalPrincipal * 0.05)})</span>
              </div>
            </div>
          </div>
        )}

        {tab === "extra" ? (
          <div className="glass rounded-2xl p-6 relative overflow-hidden" data-testid="sim-impact">
            <div
              className="absolute -top-10 -right-10 w-40 h-40 rounded-full opacity-30 blur-3xl"
              style={{ background: "radial-gradient(circle, #10B981, transparent)" }}
            />
            <div className="relative z-10">
              <div className="flex items-center gap-2 mb-4">
                <Sparkles className="w-4 h-4 text-emerald-400" />
                <span className="text-label">Impact</span>
              </div>
              <div className="mb-6">
                <p className="text-xs text-slate-400 mb-1">Interest saved</p>
                <p className="font-display text-3xl font-light tracking-tight text-emerald-400">
                  {fmtMoney(interestSaved)}
                </p>
              </div>
              <div className="mb-6">
                <p className="text-xs text-slate-400 mb-1">Months saved</p>
                <p className="font-display text-3xl font-light tracking-tight">{monthsSaved}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 mb-1">New debt-free date</p>
                <p className="font-display text-xl font-medium tracking-tight">
                  {boostedResult?.payoff_date || "—"}
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="glass rounded-2xl p-6 relative overflow-hidden" data-testid="refi-impact">
            <div
              className="absolute -top-10 -right-10 w-40 h-40 rounded-full opacity-20 blur-3xl"
              style={{
                background: refiInterestSaved >= 0 
                  ? "radial-gradient(circle, #10B981, transparent)" 
                  : "radial-gradient(circle, #EF4444, transparent)"
              }}
            />
            <div className="relative z-10">
              <div className="flex items-center gap-2 mb-4">
                <Sparkles className="w-4 h-4 text-blue-400" />
                <span className="text-label">Refinance Summary</span>
              </div>
              <div className="mb-6">
                <p className="text-xs text-slate-400 mb-1">Total Loan Amount</p>
                <p className="font-display text-2xl font-light text-slate-100">
                  {fmtMoney(refiLoanAmount)}
                  {refiFee > 0 && <span className="text-xs text-slate-500 block">Includes {fmtMoney(originationFeeAmt)} orig. fee</span>}
                </p>
              </div>
              <div className="mb-6">
                <p className="text-xs text-slate-400 mb-1">Interest Saved</p>
                <p className={`font-display text-3xl font-light tracking-tight ${refiInterestSaved >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                  {refiInterestSaved >= 0 ? fmtMoney(refiInterestSaved) : `-${fmtMoney(Math.abs(refiInterestSaved))}`}
                </p>
              </div>
              <div className="mb-6">
                <p className="text-xs text-slate-400 mb-1">New Monthly Payment</p>
                <p className="font-display text-2xl font-light tracking-tight text-slate-100">
                  {fmtMoney(refiMonthlyPayment)}
                  <span className={`text-xs block mt-1 ${refiMonthlySaved >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                    {refiMonthlySaved >= 0 ? `Saves ${fmtMoney(refiMonthlySaved)}/mo` : `Costs ${fmtMoney(Math.abs(refiMonthlySaved))}/mo more`}
                  </span>
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-400 mb-1">Payoff Duration</p>
                <p className="font-display text-lg font-medium tracking-tight">
                  {refiTerm} months <span className="text-xs text-slate-500 font-normal">vs {baseResult?.months || "—"} mo baseline</span>
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="glass rounded-2xl p-6" data-testid="sim-chart">
        <div className="flex items-center justify-between mb-6">
          <div>
            <p className="text-label">Comparison</p>
            <h3 className="font-display text-lg font-medium mt-1">
              {tab === "extra" 
                ? `Baseline vs. ${fmtMoney(extra)} extra / month`
                : `Baseline Payoff vs. ${refiTerm}-Month Consolidation Loan`}
            </h3>
          </div>
          <TrendingUp className="w-5 h-5 text-blue-400" />
        </div>
        <div className="h-80">
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <XAxis dataKey="month" stroke="#475569" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis
                  stroke="#475569"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => fmtMoney(v)}
                  width={70}
                />
                <Tooltip content={<GlassTooltip formatter={(v) => fmtMoney(v)} />} />
                <Legend wrapperStyle={{ fontSize: 11, color: "#94a3b8" }} />
                <Line
                  type="monotone"
                  dataKey="baseline"
                  name={tab === "extra" ? "Without extra" : "Baseline payoff"}
                  stroke="#64748B"
                  strokeWidth={2}
                  strokeDasharray="4 4"
                  dot={false}
                />
                {tab === "extra" ? (
                  <Line
                    type="monotone"
                    dataKey="boosted"
                    name={`+${fmtMoney(extra)}/mo`}
                    stroke="#10B981"
                    strokeWidth={2.5}
                    dot={false}
                    style={{ filter: "drop-shadow(0 0 8px rgba(16,185,129,0.5))" }}
                  />
                ) : (
                  <Line
                    type="monotone"
                    dataKey="refi"
                    name="Consolidation Loan"
                    stroke="#D946EF"
                    strokeWidth={2.5}
                    dot={false}
                    style={{ filter: "drop-shadow(0 0 8px rgba(217,70,239,0.5))" }}
                  />
                )}
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="text-slate-500 text-sm flex items-center justify-center h-full">
              {loading ? "Calculating…" : "Add debts to simulate."}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
