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
    compute(strategy, extra);
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
  const chartData = (() => {
    if (!baseResult || !boostedResult) return [];
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
  })();

  return (
    <div data-testid="simulator-page">
      <div className="mb-10">
        <p className="text-label mb-3">What if</p>
        <h1 className="font-display text-4xl sm:text-5xl font-light tracking-tighter">
          Extra payment simulator.
        </h1>
        <p className="text-slate-400 mt-2 text-sm max-w-2xl">
          See how much faster — and cheaper — your debt disappears when you put a little more toward
          it each month.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-8">
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
      </div>

      <div className="glass rounded-2xl p-6" data-testid="sim-chart">
        <div className="flex items-center justify-between mb-6">
          <div>
            <p className="text-label">Comparison</p>
            <h3 className="font-display text-lg font-medium mt-1">
              Baseline vs. {fmtMoney(extra)} extra / month
            </h3>
          </div>
          <TrendingUp className="w-5 h-5 text-emerald-400" />
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
                  name="Without extra"
                  stroke="#64748B"
                  strokeWidth={2}
                  strokeDasharray="4 4"
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="boosted"
                  name={`+${fmtMoney(extra)}/mo`}
                  stroke="#10B981"
                  strokeWidth={2.5}
                  dot={false}
                  style={{ filter: "drop-shadow(0 0 8px rgba(16,185,129,0.5))" }}
                />
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
