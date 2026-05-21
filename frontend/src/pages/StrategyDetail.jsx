import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api, fmtMoney } from "../lib/api";
import { STRATEGIES, GlassTooltip } from "../lib/constants";
import { Slider } from "../components/ui/slider";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { ArrowLeft, Clock, DollarSign, TrendingDown, CalendarHeart } from "lucide-react";

export default function StrategyDetail() {
  const { strategy } = useParams();
  const navigate = useNavigate();
  const meta = STRATEGIES.find((s) => s.key === strategy);
  const [extra, setExtra] = useState(0);
  const [result, setResult] = useState(null);
  const [debts, setDebts] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchResult = async (val) => {
    setLoading(true);
    try {
      const { data } = await api.post("/strategies/calculate", {
        strategy,
        extra_payment: val,
      });
      setResult(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    api.get("/debts").then((r) => setDebts(r.data));
    fetchResult(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [strategy]);

  if (!meta) {
    return <div className="text-slate-400">Unknown strategy.</div>;
  }

  const debtMap = Object.fromEntries(debts.map((d) => [d.debt_id, d]));

  return (
    <div data-testid={`strategy-detail-${strategy}`}>
      <button
        onClick={() => navigate("/strategies")}
        className="text-sm text-slate-400 hover:text-white inline-flex items-center gap-2 mb-6"
        data-testid="back-to-strategies"
      >
        <ArrowLeft className="w-4 h-4" /> All strategies
      </button>

      <div className="mb-10 flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-3">
            <span
              className="w-2 h-2 rounded-full"
              style={{ background: meta.color, boxShadow: `0 0 8px ${meta.color}` }}
            />
            <span className="text-label">{meta.tagline}</span>
          </div>
          <h1 className="font-display text-4xl sm:text-5xl font-light tracking-tighter">
            {meta.label}
          </h1>
          <p className="text-slate-400 mt-3 text-sm max-w-2xl">{meta.desc}</p>
        </div>
      </div>

      {/* Summary metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
        <Metric
          label="Months to clear"
          value={result ? `${result.months}` : "—"}
          sub={result?.payoff_date}
          icon={<Clock className="w-4 h-4 text-blue-400" />}
          testid="detail-months"
        />
        <Metric
          label="Total interest"
          value={result ? fmtMoney(result.total_interest) : "—"}
          icon={<TrendingDown className="w-4 h-4 text-red-400" />}
          testid="detail-interest"
        />
        <Metric
          label="Total paid"
          value={result ? fmtMoney(result.total_paid) : "—"}
          icon={<DollarSign className="w-4 h-4 text-emerald-400" />}
          testid="detail-total"
        />
        <Metric
          label="Debt-free"
          value={result?.payoff_date || "—"}
          icon={<CalendarHeart className="w-4 h-4 text-fuchsia-400" />}
          testid="detail-payoff-date"
        />
      </div>

      {/* Extra payment */}
      <div className="glass rounded-2xl p-6 mb-8" data-testid="detail-extra-slider">
        <div className="flex items-center justify-between mb-5">
          <div>
            <p className="text-label">Extra payment</p>
            <p className="font-display text-2xl font-light tracking-tight mt-2">
              {fmtMoney(extra)} <span className="text-sm text-slate-500">/ month</span>
            </p>
          </div>
        </div>
        <Slider
          defaultValue={[0]}
          min={0}
          max={2000}
          step={25}
          onValueCommit={(v) => {
            setExtra(v[0]);
            fetchResult(v[0]);
          }}
        />
      </div>

      {/* Timeline */}
      <div className="glass rounded-2xl p-6 mb-8" data-testid="detail-timeline-chart">
        <div className="mb-6">
          <p className="text-label">Projection</p>
          <h3 className="font-display text-lg font-medium mt-1">Balance over time</h3>
        </div>
        <div className="h-72">
          {result && result.schedule.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={result.schedule}>
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
                <Line
                  type="monotone"
                  dataKey="total_remaining"
                  name="Remaining"
                  stroke={meta.color}
                  strokeWidth={2.5}
                  dot={false}
                  style={{ filter: `drop-shadow(0 0 8px ${meta.color})` }}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="text-slate-500 text-sm flex items-center justify-center h-full">
              {loading ? "Calculating…" : "Add debts to see your timeline."}
            </div>
          )}
        </div>
      </div>

      {/* Per-debt table */}
      {result?.per_debt?.length > 0 && (
        <div className="glass rounded-2xl p-6" data-testid="detail-per-debt">
          <div className="mb-6">
            <p className="text-label">Per debt</p>
            <h3 className="font-display text-lg font-medium mt-1">When each debt clears</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs uppercase tracking-widest text-slate-500 border-b border-white/5">
                  <th className="text-left py-3 font-normal">Debt</th>
                  <th className="text-right py-3 font-normal">Balance</th>
                  <th className="text-right py-3 font-normal">Paid off in</th>
                  <th className="text-right py-3 font-normal">Interest paid</th>
                  <th className="text-right py-3 font-normal">Total paid</th>
                </tr>
              </thead>
              <tbody>
                {result.per_debt
                  .slice()
                  .sort((a, b) => (a.payoff_month || 999) - (b.payoff_month || 999))
                  .map((p, i) => (
                    <tr
                      key={p.debt_id}
                      className="border-b border-white/5 last:border-0"
                      data-testid={`row-debt-${i}`}
                    >
                      <td className="py-4">
                        <div className="flex items-center gap-2">
                          <span className="w-6 h-6 rounded-full bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-[10px] font-medium text-blue-300">
                            {i + 1}
                          </span>
                          <span className="font-medium">{p.name}</span>
                        </div>
                      </td>
                      <td className="text-right text-slate-300">
                        {debtMap[p.debt_id] ? fmtMoney(debtMap[p.debt_id].balance) : "—"}
                      </td>
                      <td className="text-right text-slate-300">
                        {p.payoff_month ? `Month ${p.payoff_month}` : "—"}
                      </td>
                      <td className="text-right text-amber-400">{fmtMoney(p.interest_paid)}</td>
                      <td className="text-right text-slate-100 font-medium">
                        {fmtMoney(p.total_paid)}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
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
