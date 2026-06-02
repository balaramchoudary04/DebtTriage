import React, { useEffect, useState } from "react";
import { api, fmtMoney } from "../lib/api";
import { DEBT_TYPES, STRATEGIES, debtTypeMeta, GlassTooltip } from "../lib/constants";
import { useNavigate } from "react-router-dom";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from "recharts";
import {
  Wallet,
  CalendarClock,
  Percent,
  CalendarHeart,
  PlusCircle,
  ArrowUpRight,
  AlertCircle,
  Trophy,
  Award,
  Sparkles,
  Printer,
  Zap,
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";

export default function Dashboard() {
  const { user } = useAuth();
  const [debts, setDebts] = useState([]);
  const [compare, setCompare] = useState(null);
  const [boostedCompare, setBoostedCompare] = useState(null);
  const [reminders, setReminders] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    Promise.all([
      api.get("/debts"),
      api.post("/strategies/compare", null, { params: { extra_payment: 0 } }),
      api.post("/strategies/compare", null, { params: { extra_payment: 100 } }),
      api.get("/reminders/upcoming"),
    ])
      .then(([d, c, bc, r]) => {
        setDebts(d.data);
        setCompare(c.data);
        setBoostedCompare(bc.data);
        setReminders(r.data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const totalDebt = debts.reduce((s, d) => s + d.balance, 0);
  const totalMin = debts.reduce((s, d) => s + d.min_payment, 0);
  const avgApr = debts.length
    ? debts.reduce((s, d) => s + d.apr * d.balance, 0) / Math.max(totalDebt, 1)
    : 0;

  const avalanche = compare?.strategies?.avalanche;
  const pieData = debts.map((d) => ({
    name: d.name,
    value: d.balance,
    color: debtTypeMeta(d.type).color,
  }));

  // Smart Advisor recommendations engine
  const recommendations = [];
  const highAprDebt = debts.find(d => d.apr > 20);
  if (highAprDebt) {
    recommendations.push({
      type: "warning",
      title: "High APR Warning",
      text: `Your debt "${highAprDebt.name}" has an extremely high interest rate of ${highAprDebt.apr.toFixed(1)}%. Prioritize paying this off first to avoid compounding charges.`,
    });
  }

  const avalancheInterest = compare?.strategies?.avalanche?.total_interest || 0;
  const snowballInterest = compare?.strategies?.snowball?.total_interest || 0;
  const strategySavings = snowballInterest - avalancheInterest;
  if (strategySavings > 10) {
    recommendations.push({
      type: "info",
      title: "Interest Savings Match",
      text: `Using the mathematically optimal Avalanche Strategy instead of the Snowball Strategy will save you ${fmtMoney(strategySavings)} in total interest payments!`,
    });
  }

  const dominantDebt = debts.length ? debts.reduce((max, d) => d.min_payment > max.min_payment ? d : max, debts[0]) : null;
  if (dominantDebt && totalMin > 0 && (dominantDebt.min_payment / totalMin) > 0.35) {
    const percent = Math.round((dominantDebt.min_payment / totalMin) * 100);
    recommendations.push({
      type: "info",
      title: "Cash Flow Dominance Alert",
      text: `"${dominantDebt.name}" requires ${fmtMoney(dominantDebt.min_payment)}/mo, representing ${percent}% of your total minimum payments. Clearing this first frees up cash flow fastest.`,
    });
  }

  const baseAv = compare?.strategies?.avalanche;
  const boostedAv = boostedCompare?.strategies?.avalanche;
  if (baseAv && boostedAv) {
    const savings = Math.max(0, baseAv.total_interest - boostedAv.total_interest);
    const months = Math.max(0, baseAv.months - boostedAv.months);
    if (savings > 50 && months > 0) {
      recommendations.push({
        type: "success",
        title: "Snowball Boost Opportunity",
        text: `Adding just $100/month extra to your payments will shorten your payoff by ${months} months and save you ${fmtMoney(savings)} in lifetime interest!`,
      });
    }
  }

  if (recommendations.length === 0) {
    recommendations.push({
      type: "info",
      title: "Advisor Tip",
      text: "Ensure all interest rates and balances are accurate to get customized strategy optimization advice.",
    });
  }

  // Milestones Engine
  const achievements = [
    {
      id: "snowball_starter",
      title: "Snowball Starter",
      desc: "Add your first debt account to establish a baseline target.",
      unlocked: debts.length > 0,
      icon: "❄️",
    },
    {
      id: "debt_slasher",
      title: "Debt Slasher",
      desc: "Simulate clearing at least one debt account timeline.",
      unlocked: avalanche && avalanche.per_debt && avalanche.per_debt.some(p => p.payoff_month > 0),
      icon: "⚔️",
    },
    {
      id: "interest_saver",
      title: "Interest Saver",
      desc: "Optimize payments to save over $500 in total interest.",
      unlocked: baseAv && boostedAv && (baseAv.total_interest - boostedAv.total_interest > 500),
      icon: "💰",
    },
    {
      id: "debt_free_horizon",
      title: "Fast Track",
      desc: "Achieve a projected payoff duration of under 24 months.",
      unlocked: avalanche && avalanche.months < 24,
      icon: "🚀",
    },
    {
      id: "zero_balance_club",
      title: "Zero Balance Club",
      desc: "Simulate reducing starting principal by 50% or more.",
      unlocked: avalanche && avalanche.schedule && avalanche.schedule.some(s => s.total_remaining <= totalDebt * 0.5),
      icon: "🎉",
    }
  ];
  const unlockedCount = achievements.filter(a => a.unlocked).length;

  if (loading) {
    return (
      <div className="text-slate-400 text-sm tracking-widest uppercase" data-testid="dashboard-loading">
        Loading dashboard…
      </div>
    );
  }

  if (debts.length === 0) {
    return (
      <div data-testid="dashboard-empty">
        <div className="mb-10">
          <p className="text-label mb-3">Dashboard</p>
          <h1 className="font-display text-4xl sm:text-5xl font-light tracking-tighter">
            Let's map your debt.
          </h1>
        </div>
        <div className="glass rounded-2xl p-12 text-center">
          <div className="w-16 h-16 rounded-2xl glass-subtle flex items-center justify-center mx-auto mb-6">
            <Wallet className="w-7 h-7 text-blue-400" />
          </div>
          <h3 className="font-display text-2xl font-medium tracking-tight mb-3">
            Add your first debt to begin
          </h3>
          <p className="text-slate-400 mb-7 max-w-md mx-auto">
            Credit card, student loan, car payment — whatever's weighing you down. We'll model the
            fastest way out.
          </p>
          <button
            onClick={() => navigate("/debts")}
            className="bg-blue-600 hover:bg-blue-500 text-white rounded-lg px-6 py-3 font-medium transition-all shadow-[0_0_30px_rgba(37,99,235,0.4)] inline-flex items-center gap-2"
            data-testid="empty-add-debt-btn"
          >
            <PlusCircle className="w-4 h-4" />
            Add a debt
          </button>
        </div>
      </div>
    );
  }

  return (
    <div data-testid="dashboard-page">
      {/* Printable PDF / Print View (Hidden in standard screen rendering) */}
      <div className="hidden print:block text-slate-900 bg-white p-8 max-w-4xl mx-auto print-block">
        <div className="border-b-2 border-slate-800 pb-4 mb-6">
          <h1 className="text-3xl font-bold tracking-tight">DEBTWISE PAYOFF BLUEPRINT</h1>
          <p className="text-slate-500 text-sm">Generated on {new Date().toLocaleDateString()} for {user?.name || "Premium User"}</p>
        </div>
        
        <div className="grid grid-cols-2 gap-4 mb-6 text-sm">
          <div>
            <p className="font-semibold text-slate-700">Debt Overview</p>
            <p>Total Debt: {fmtMoney(totalDebt)}</p>
            <p>Monthly Minimums: {fmtMoney(totalMin)}</p>
            <p>Average APR: {avgApr.toFixed(2)}%</p>
          </div>
          <div>
            <p className="font-semibold text-slate-700">Projected Payoff (Avalanche)</p>
            <p>Payoff Date: {avalanche?.payoff_date || "—"} ({avalanche?.months} months)</p>
            <p>Total Interest: {fmtMoney(avalanche?.total_interest)}</p>
            <p>Total Repayment: {fmtMoney(avalanche?.total_paid)}</p>
          </div>
        </div>
        
        <div className="mb-6">
          <h3 className="text-lg font-bold text-slate-800 mb-3">Active Debt Accounts</h3>
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-300 bg-slate-50">
                <th className="py-2 px-3 font-semibold text-slate-700">Name</th>
                <th className="py-2 px-3 font-semibold text-slate-700">Type</th>
                <th className="py-2 px-3 font-semibold text-slate-700">Balance</th>
                <th className="py-2 px-3 font-semibold text-slate-700">APR</th>
                <th className="py-2 px-3 font-semibold text-slate-700">Min Payment</th>
              </tr>
            </thead>
            <tbody>
              {debts.map((d, i) => (
                <tr key={i} className="border-b border-slate-200">
                  <td className="py-2 px-3">{d.name}</td>
                  <td className="py-2 px-3 uppercase text-xs">{d.type.replace("_", " ")}</td>
                  <td className="py-2 px-3">{fmtMoney(d.balance)}</td>
                  <td className="py-2 px-3">{d.apr.toFixed(1)}%</td>
                  <td className="py-2 px-3">{fmtMoney(d.min_payment)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        <div>
          <h3 className="text-lg font-bold text-slate-800 mb-3">Payoff Sequence Timeline</h3>
          <div className="space-y-4">
            {[...debts]
              .map((d) => {
                const match = avalanche?.per_debt?.find((p) => p.debt_id === d.debt_id);
                return {
                  ...d,
                  payoff_month: match ? match.payoff_month : 999,
                };
              })
              .sort((a, b) => a.payoff_month - b.payoff_month)
              .map((d, index) => {
                const targetDate = (() => {
                  if (d.payoff_month === 999) return "—";
                  const now = new Date();
                  now.setDate(1);
                  now.setMonth(now.getMonth() + d.payoff_month);
                  return now.toLocaleDateString("en-US", { month: "short", year: "numeric" });
                })();
                return (
                  <div key={d.debt_id} className="border-l-2 border-slate-400 pl-4 py-1 text-sm">
                    <p className="font-semibold text-slate-800">
                      Step {index + 1}: {d.name} — Target Clear Date: {targetDate}
                    </p>
                    <p className="text-slate-600">
                      Starting Balance: {fmtMoney(d.balance)} at {d.apr.toFixed(1)}% APR (Clears in {d.payoff_month} months)
                    </p>
                  </div>
                );
              })}
          </div>
        </div>
      </div>

      {/* Main Screen Layout (Hidden in Print) */}
      <div className="print:hidden">
        <div className="mb-10 flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <p className="text-label mb-3">Overview</p>
            <h1 className="font-display text-4xl sm:text-5xl font-light tracking-tighter">
              Your debt at a glance.
            </h1>
          </div>
          <div className="flex gap-3 self-start">
            <button
              onClick={() => window.print()}
              className="bg-white/5 hover:bg-white/10 text-slate-200 border border-white/10 rounded-lg px-5 py-2.5 text-sm font-medium transition-all inline-flex items-center gap-2"
              data-testid="dashboard-print-btn"
            >
              <Printer className="w-4 h-4" />
              Print Blueprint
            </button>
            <button
              onClick={() => navigate("/debts")}
              className="bg-blue-600 hover:bg-blue-500 text-white rounded-lg px-5 py-2.5 text-sm font-medium transition-all shadow-[0_0_30px_rgba(37,99,235,0.4)] inline-flex items-center gap-2"
              data-testid="dashboard-add-debt-btn"
            >
              <PlusCircle className="w-4 h-4" />
              Add debt
            </button>
          </div>
        </div>

        {/* Metrics */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-5 mb-10">
          <Metric
            label="Total debt"
            value={fmtMoney(totalDebt)}
            icon={<Wallet className="w-4 h-4 text-blue-400" />}
            testid="metric-total-debt"
          />
          <Metric
            label="Monthly minimums"
            value={fmtMoney(totalMin)}
            icon={<CalendarClock className="w-4 h-4 text-amber-400" />}
            testid="metric-monthly-min"
          />
          <Metric
            label="Avg APR"
            value={`${avgApr.toFixed(2)}%`}
            icon={<Percent className="w-4 h-4 text-fuchsia-400" />}
            testid="metric-avg-apr"
          />
          <Metric
            label="Debt-free by"
            value={avalanche?.payoff_date || "—"}
            sub={avalanche ? `${avalanche.months} months` : "Add debts"}
            icon={<CalendarHeart className="w-4 h-4 text-emerald-400" />}
            testid="metric-payoff-date"
          />
        </div>

        {/* Payoff Milestones Bento Card */}
        <div className="glass rounded-2xl p-6 mb-10 animate-fade-up delay-100" data-testid="card-milestones">
          <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <p className="text-label">Achievements</p>
              <h3 className="font-display text-lg font-medium mt-1">Payoff milestones ({unlockedCount}/{achievements.length})</h3>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <span className="text-xs text-slate-400">Total Score:</span>
              <div className="flex items-center gap-1 bg-amber-500/10 border border-amber-500/20 text-amber-400 px-3 py-1 rounded-full text-xs font-semibold">
                <Trophy className="w-3.5 h-3.5" />
                {unlockedCount * 100} pts
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {achievements.map((ach) => (
              <div 
                key={ach.id}
                className={`p-4 rounded-xl border text-center transition-all duration-300 relative overflow-hidden ${
                  ach.unlocked 
                    ? "bg-emerald-600/5 border-emerald-500/30 text-emerald-300 shadow-[0_0_15px_rgba(16,185,129,0.05)]"
                    : "bg-white/5 border-white/5 text-slate-500 opacity-60"
                }`}
              >
                <div className="text-3xl mb-3">{ach.icon}</div>
                <h4 className="font-display font-semibold text-sm mb-1.5 truncate">{ach.title}</h4>
                <p className="text-[10px] leading-snug text-slate-400">{ach.desc}</p>
                {ach.unlocked ? (
                  <div className="absolute top-2 right-2 bg-emerald-500/20 border border-emerald-500/40 text-[9px] font-bold px-1.5 py-0.5 rounded text-emerald-400">
                    UNLOCKED
                  </div>
                ) : (
                  <div className="absolute top-2 right-2 bg-white/5 border border-white/10 text-[9px] font-bold px-1.5 py-0.5 rounded text-slate-500">
                    LOCKED
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-10">
          {/* Breakdown */}
          <div className="glass rounded-2xl p-6 lg:col-span-1" data-testid="card-breakdown">
            <div className="flex items-center justify-between mb-6">
              <div>
                <p className="text-label">Composition</p>
                <h3 className="font-display text-lg font-medium mt-1">Debt breakdown</h3>
              </div>
            </div>
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    innerRadius={55}
                    outerRadius={85}
                    paddingAngle={2}
                    dataKey="value"
                    stroke="none"
                  >
                    {pieData.map((e, i) => (
                      <Cell key={i} fill={e.color} />
                    ))}
                  </Pie>
                  <Tooltip content={<GlassTooltip formatter={(v) => fmtMoney(v)} />} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-2 mt-4">
              {pieData.slice(0, 5).map((p, i) => (
                <div key={i} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: p.color }} />
                    <span className="text-slate-300 truncate">{p.name}</span>
                  </div>
                  <span className="text-slate-400">{fmtMoney(p.value)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Payoff timeline */}
          <div className="glass rounded-2xl p-6 lg:col-span-2" data-testid="card-timeline">
            <div className="flex items-center justify-between mb-6">
              <div>
                <p className="text-label">Projection</p>
                <h3 className="font-display text-lg font-medium mt-1">
                  Payoff timeline — Avalanche
                </h3>
              </div>
              <button
                onClick={() => navigate("/strategies")}
                className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"
                data-testid="view-strategies-link"
              >
                Compare all <ArrowUpRight className="w-3 h-3" />
              </button>
            </div>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={avalanche?.schedule || []}>
                  <defs>
                    <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#2563EB" stopOpacity={1} />
                      <stop offset="100%" stopColor="#2563EB" stopOpacity={0.2} />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="month"
                    stroke="#475569"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    stroke="#475569"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) => fmtMoney(v)}
                    width={70}
                  />
                  <Tooltip content={<GlassTooltip formatter={(v) => fmtMoney(v)} />} />
                  <Line
                    type="monotone"
                    dataKey="total_remaining"
                    name="Remaining"
                    stroke="url(#g1)"
                    strokeWidth={2.5}
                    dot={false}
                    style={{ filter: "drop-shadow(0 0 8px rgba(37,99,235,0.6))" }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Payoff Pipeline Progression */}
        <div className="glass rounded-2xl p-6 mb-10 animate-fade-up delay-200" data-testid="card-payoff-pipeline">
          <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <p className="text-label">Strategy Pathway</p>
              <h3 className="font-display text-lg font-medium mt-1">Payoff order pipeline</h3>
            </div>
            <div className="text-xs text-slate-400">
              Based on the <span className="text-blue-400 font-medium">Avalanche Method</span> optimization
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {[...debts]
              .map((d) => {
                const match = avalanche?.per_debt?.find((p) => p.debt_id === d.debt_id);
                return {
                  ...d,
                  payoff_month: match ? match.payoff_month : 999,
                  interest_paid: match ? match.interest_paid : 0,
                };
              })
              .sort((a, b) => a.payoff_month - b.payoff_month)
              .map((d, index) => {
                const meta = debtTypeMeta(d.type);
                const isActiveTarget = index === 0;
                const targetDate = (() => {
                  if (d.payoff_month === 999) return "—";
                  const now = new Date();
                  now.setDate(1);
                  now.setMonth(now.getMonth() + d.payoff_month);
                  return now.toLocaleDateString("en-US", { month: "short", year: "numeric" });
                })();
                
                return (
                  <div
                    key={d.debt_id}
                    className={`glass-subtle border rounded-2xl p-5 relative overflow-hidden transition-all duration-300 ${
                      isActiveTarget 
                        ? "border-blue-500/30 bg-blue-600/5 shadow-[0_0_20px_rgba(37,99,235,0.05)]" 
                        : "border-white/5"
                    }`}
                    data-testid={`pipeline-item-${d.debt_id}`}
                  >
                    {/* Status indicator */}
                    <div className="flex items-center justify-between mb-4">
                      <span 
                        className={`text-[10px] tracking-widest uppercase font-bold px-2 py-0.5 rounded-full ${
                          isActiveTarget 
                            ? "bg-blue-600/20 text-blue-400 border border-blue-500/30 animate-pulse" 
                            : "bg-white/5 text-slate-400 border border-white/5"
                        }`}
                      >
                        {isActiveTarget ? "★ Active Target" : `Step ${index + 1}`}
                      </span>
                      <span className="text-xs text-slate-500 font-medium">
                        Target: {targetDate}
                      </span>
                    </div>

                    <div className="flex items-center gap-2.5 mb-2">
                      <span 
                        className="w-2.5 h-2.5 rounded-full shrink-0" 
                        style={{ 
                          background: meta.color, 
                          boxShadow: `0 0 10px ${meta.color}` 
                        }} 
                      />
                      <h4 className="font-display font-medium text-slate-200 truncate">{d.name}</h4>
                    </div>

                    <div className="font-display text-xl font-light text-slate-300 mb-4">
                      {fmtMoney(d.balance)}
                    </div>

                    <div className="space-y-1.5 text-xs border-t border-white/5 pt-3">
                      <div className="flex justify-between">
                        <span className="text-slate-500">Interest rate</span>
                        <span className="text-slate-300 font-medium">{d.apr.toFixed(1)}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Payoff time</span>
                        <span className="text-slate-300 font-medium">{d.payoff_month} months</span>
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>

        {/* Advisor & Reminders Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-10">
          {/* Smart Payoff Advisor */}
          <div className="glass rounded-2xl p-6 lg:col-span-2" data-testid="card-smart-advisor">
            <div className="mb-6 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-blue-400" />
              <div>
                <p className="text-label">Strategy Advisor</p>
                <h3 className="font-display text-lg font-medium mt-1">Smart recommendations</h3>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {recommendations.map((rec, index) => (
                <div 
                  key={index}
                  className={`p-4 rounded-xl border text-xs leading-relaxed transition-all duration-300 ${
                    rec.type === "warning" 
                      ? "bg-rose-500/10 border-rose-500/20 text-rose-300 shadow-[0_0_15px_rgba(239,68,68,0.05)]"
                      : rec.type === "success"
                      ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-300 shadow-[0_0_15px_rgba(16,185,129,0.05)]"
                      : "bg-blue-500/10 border-blue-500/20 text-blue-300 shadow-[0_0_15px_rgba(59,130,246,0.05)]"
                  }`}
                >
                  <div className="font-semibold mb-1.5 flex items-center gap-1.5 uppercase tracking-wider text-[10px]">
                    {rec.type === "warning" ? <AlertCircle className="w-3.5 h-3.5 text-rose-400" /> : <Zap className="w-3.5 h-3.5" />}
                    {rec.title}
                  </div>
                  {rec.text}
                </div>
              ))}
            </div>
          </div>

          {/* Upcoming Due Dates */}
          <div className="glass rounded-2xl p-6 lg:col-span-1" data-testid="card-reminders">
            <div className="mb-6">
              <p className="text-label">Upcoming</p>
              <h3 className="font-display text-lg font-medium mt-1">Due dates</h3>
            </div>
            {reminders.length === 0 ? (
              <div className="text-sm text-slate-400 text-center py-8">
                <CalendarClock className="w-8 h-8 mx-auto mb-3 text-slate-600" />
                Add due dates to your debts to see reminders.
              </div>
            ) : (
              <div className="space-y-3">
                {reminders.slice(0, 5).map((r) => (
                  <div
                    key={r.debt_id}
                    className="flex items-center justify-between gap-3 text-sm"
                    data-testid={`reminder-${r.debt_id}`}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate">{r.name}</p>
                      <p className="text-xs text-slate-500">{r.due_date}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-sm font-medium">{fmtMoney(r.min_payment)}</div>
                      <div
                        className={`text-xs ${
                          r.days_until <= 3 ? "text-red-400" : "text-slate-500"
                        }`}
                      >
                        {r.days_until <= 0 ? (
                          <span className="inline-flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" /> due today
                          </span>
                        ) : (
                          `${r.days_until}d left`
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Strategy comparison Head to Head (Full width) */}
        <div className="glass rounded-2xl p-6" data-testid="card-strategy-compare">
          <div className="mb-6">
            <p className="text-label">Comparison</p>
            <h3 className="font-display text-lg font-medium mt-1">Strategies head-to-head</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {STRATEGIES.filter((s) => s.key !== "custom").map((s) => {
              const r = compare?.strategies?.[s.key];
              return (
                <button
                  key={s.key}
                  onClick={() => navigate(`/strategies/${s.key}`)}
                  className="text-left glass-subtle rounded-xl p-5 hover:bg-white/10 hover:border-white/20 border border-white/5 transition-all"
                  data-testid={`compare-${s.key}`}
                >
                  <div className="flex items-center gap-2 mb-3">
                    <span
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ background: s.color, boxShadow: `0 0 8px ${s.color}` }}
                    />
                    <span className="text-sm font-semibold">{s.label}</span>
                  </div>
                  <p className="text-xs text-slate-400 mb-4">{s.tagline}</p>
                  <div className="space-y-2 border-t border-white/5 pt-3">
                    <Stat label="Payoff Duration" value={r ? `${r.months} mo` : "—"} />
                    <Stat label="Total Interest" value={r ? fmtMoney(r.total_interest) : "—"} />
                    <Stat label="Debt-Free Month" value={r?.payoff_date || "—"} />
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value, sub, icon, testid }) {
  return (
    <div className="glass rounded-2xl p-5" data-testid={testid}>
      <div className="flex items-center justify-between mb-4">
        <span className="text-label">{label}</span>
        <div className="w-8 h-8 rounded-lg glass-subtle flex items-center justify-center">
          {icon}
        </div>
      </div>
      <div className="font-display text-2xl sm:text-3xl font-light tracking-tight">{value}</div>
      {sub && <div className="text-xs text-slate-500 mt-1">{sub}</div>}
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-slate-500">{label}</span>
      <span className="text-slate-200 font-medium">{value}</span>
    </div>
  );
}
