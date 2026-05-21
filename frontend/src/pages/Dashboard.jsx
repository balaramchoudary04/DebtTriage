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
} from "lucide-react";

export default function Dashboard() {
  const [debts, setDebts] = useState([]);
  const [compare, setCompare] = useState(null);
  const [reminders, setReminders] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    Promise.all([
      api.get("/debts"),
      api.post("/strategies/compare", null, { params: { extra_payment: 0 } }),
      api.get("/reminders/upcoming"),
    ])
      .then(([d, c, r]) => {
        setDebts(d.data);
        setCompare(c.data);
        setReminders(r.data);
      })
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
      <div className="mb-10 flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <p className="text-label mb-3">Overview</p>
          <h1 className="font-display text-4xl sm:text-5xl font-light tracking-tighter">
            Your debt at a glance.
          </h1>
        </div>
        <button
          onClick={() => navigate("/debts")}
          className="bg-blue-600 hover:bg-blue-500 text-white rounded-lg px-5 py-2.5 text-sm font-medium transition-all shadow-[0_0_30px_rgba(37,99,235,0.4)] inline-flex items-center gap-2 self-start"
          data-testid="dashboard-add-debt-btn"
        >
          <PlusCircle className="w-4 h-4" />
          Add debt
        </button>
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

      {/* Strategy comparison + reminders */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="glass rounded-2xl p-6 lg:col-span-2" data-testid="card-strategy-compare">
          <div className="mb-6">
            <p className="text-label">Comparison</p>
            <h3 className="font-display text-lg font-medium mt-1">Strategies head-to-head</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {STRATEGIES.filter((s) => s.key !== "custom").map((s) => {
              const r = compare?.strategies?.[s.key];
              return (
                <button
                  key={s.key}
                  onClick={() => navigate(`/strategies/${s.key}`)}
                  className="text-left glass-subtle rounded-xl p-4 hover:bg-white/10 hover:border-white/20 border border-white/5 transition-all"
                  data-testid={`compare-${s.key}`}
                >
                  <div className="flex items-center gap-2 mb-3">
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{ background: s.color, boxShadow: `0 0 8px ${s.color}` }}
                    />
                    <span className="text-sm font-medium">{s.label}</span>
                  </div>
                  <p className="text-xs text-slate-400 mb-3">{s.tagline}</p>
                  <div className="space-y-1.5">
                    <Stat label="Payoff" value={r ? `${r.months} mo` : "—"} />
                    <Stat label="Interest" value={r ? fmtMoney(r.total_interest) : "—"} />
                    <Stat label="Done" value={r?.payoff_date || "—"} />
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="glass rounded-2xl p-6" data-testid="card-reminders">
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
