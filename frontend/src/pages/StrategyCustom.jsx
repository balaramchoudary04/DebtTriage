import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, fmtMoney } from "../lib/api";
import { debtTypeMeta, GlassTooltip } from "../lib/constants";
import { useAuth } from "../contexts/AuthContext";
import { Slider } from "../components/ui/slider";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ArrowLeft, GripVertical, Lock, Crown, Clock, TrendingDown, DollarSign, CalendarHeart, Save } from "lucide-react";

export default function StrategyCustom() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isPremium = !!(user && user.premium_until && new Date(user.premium_until) > new Date());

  const [debts, setDebts] = useState([]);
  const [order, setOrder] = useState([]); // array of debt_ids
  const [perExtra, setPerExtra] = useState({}); // debt_id -> number
  const [extra, setExtra] = useState(0);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [computing, setComputing] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const debtMap = useMemo(() => Object.fromEntries(debts.map((d) => [d.debt_id, d])), [debts]);

  useEffect(() => {
    api
      .get("/debts")
      .then((r) => {
        setDebts(r.data);
        // Default order: highest APR first (avalanche)
        const sorted = [...r.data].sort((a, b) => b.apr - a.apr).map((d) => d.debt_id);
        setOrder(sorted);
      })
      .finally(() => setLoading(false));
  }, []);

  const compute = async () => {
    if (!order.length) return;
    setComputing(true);
    try {
      const cleanedExtra = Object.fromEntries(
        Object.entries(perExtra)
          .map(([k, v]) => [k, Number(v) || 0])
          .filter(([, v]) => v > 0)
      );
      const { data } = await api.post("/strategies/calculate", {
        strategy: "custom",
        extra_payment: extra,
        custom_order: order,
        per_debt_extra: cleanedExtra,
      });
      setResult(data);
    } finally {
      setComputing(false);
    }
  };

  // Auto-compute on changes (debounced)
  useEffect(() => {
    if (!isPremium || !order.length) return;
    const t = setTimeout(compute, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order, perExtra, extra, isPremium]);

  const onDragEnd = (e) => {
    const { active, over } = e;
    if (over && active.id !== over.id) {
      setOrder((items) => {
        const oldIndex = items.indexOf(active.id);
        const newIndex = items.indexOf(over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  if (!isPremium) {
    return (
      <div data-testid="custom-locked">
        <button
          onClick={() => navigate("/strategies")}
          className="text-sm text-slate-400 hover:text-white inline-flex items-center gap-2 mb-6"
        >
          <ArrowLeft className="w-4 h-4" /> All strategies
        </button>
        <div className="glass rounded-2xl p-12 text-center relative overflow-hidden">
          <div
            className="absolute inset-0 opacity-30 pointer-events-none"
            style={{
              background:
                "radial-gradient(circle at 50% 0%, rgba(236,72,153,0.25), transparent 70%)",
            }}
          />
          <div className="relative z-10">
            <div className="w-16 h-16 rounded-2xl glass-subtle flex items-center justify-center mx-auto mb-6 border-amber-500/30">
              <Lock className="w-7 h-7 text-amber-400" />
            </div>
            <h3 className="font-display text-2xl font-medium tracking-tight mb-3">
              Custom strategy is Premium
            </h3>
            <p className="text-slate-400 mb-8 max-w-md mx-auto">
              Drag debts into your own priority order and assign per-debt extra payments. Unlock
              with Premium ($5/month or $50/year).
            </p>
            <button
              onClick={() => navigate("/settings?upgrade=1")}
              className="bg-blue-600 hover:bg-blue-500 text-white rounded-lg px-6 py-3 font-medium transition-all shadow-[0_0_30px_rgba(37,99,235,0.4)] inline-flex items-center gap-2"
              data-testid="custom-upgrade-btn"
            >
              <Crown className="w-4 h-4" />
              Upgrade to Premium
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return <div className="text-slate-400 text-sm tracking-widest uppercase">Loading…</div>;
  }

  return (
    <div data-testid="strategy-custom-page">
      <button
        onClick={() => navigate("/strategies")}
        className="text-sm text-slate-400 hover:text-white inline-flex items-center gap-2 mb-6"
        data-testid="back-to-strategies"
      >
        <ArrowLeft className="w-4 h-4" /> All strategies
      </button>

      <div className="mb-10">
        <div className="flex items-center gap-2 mb-3">
          <span
            className="w-2 h-2 rounded-full"
            style={{ background: "#EC4899", boxShadow: "0 0 8px #EC4899" }}
          />
          <span className="text-label">Your priority order</span>
        </div>
        <h1 className="font-display text-4xl sm:text-5xl font-light tracking-tighter">
          Custom strategy
        </h1>
        <p className="text-slate-400 mt-3 text-sm max-w-2xl">
          Drag debts into the order you want to attack them. Optionally add a per-debt extra
          payment. We'll simulate the math in real time.
        </p>
      </div>

      {/* Summary metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
        <Metric
          label="Months to clear"
          value={result ? `${result.months}` : "—"}
          sub={result?.payoff_date}
          icon={<Clock className="w-4 h-4 text-blue-400" />}
          testid="custom-months"
        />
        <Metric
          label="Total interest"
          value={result ? fmtMoney(result.total_interest) : "—"}
          icon={<TrendingDown className="w-4 h-4 text-red-400" />}
          testid="custom-interest"
        />
        <Metric
          label="Total paid"
          value={result ? fmtMoney(result.total_paid) : "—"}
          icon={<DollarSign className="w-4 h-4 text-emerald-400" />}
          testid="custom-total"
        />
        <Metric
          label="Debt-free"
          value={result?.payoff_date || "—"}
          icon={<CalendarHeart className="w-4 h-4 text-fuchsia-400" />}
          testid="custom-payoff-date"
        />
      </div>

      {/* Pool slider */}
      <div className="glass rounded-2xl p-6 mb-6" data-testid="custom-pool">
        <div className="flex items-center justify-between mb-5">
          <div>
            <p className="text-label">Pool extra payment</p>
            <p className="text-xs text-slate-500 mt-1">
              Applied to the top debt in your order; rolls down as debts clear.
            </p>
            <p className="font-display text-2xl font-light tracking-tight mt-3">
              {fmtMoney(extra)} <span className="text-sm text-slate-500">/ month</span>
            </p>
          </div>
        </div>
        <Slider
          defaultValue={[0]}
          min={0}
          max={2000}
          step={25}
          onValueChange={(v) => setExtra(v[0])}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* DnD List */}
        <div className="glass rounded-2xl p-6 lg:col-span-2" data-testid="dnd-list">
          <div className="mb-5">
            <p className="text-label">Priority order</p>
            <h3 className="font-display text-lg font-medium mt-1">Drag to reorder</h3>
          </div>
          {order.length === 0 ? (
            <p className="text-sm text-slate-400">Add debts first.</p>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
              <SortableContext items={order} strategy={verticalListSortingStrategy}>
                <div className="space-y-2">
                  {order.map((id, idx) => {
                    const d = debtMap[id];
                    if (!d) return null;
                    return (
                      <SortableRow
                        key={id}
                        id={id}
                        index={idx}
                        debt={d}
                        extraValue={perExtra[id] || ""}
                        onExtraChange={(v) => setPerExtra({ ...perExtra, [id]: v })}
                      />
                    );
                  })}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </div>

        {/* Chart */}
        <div className="glass rounded-2xl p-6" data-testid="custom-chart">
          <div className="mb-5">
            <p className="text-label">Projection</p>
            <h3 className="font-display text-lg font-medium mt-1">Payoff timeline</h3>
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
                    width={60}
                  />
                  <Tooltip content={<GlassTooltip formatter={(v) => fmtMoney(v)} />} />
                  <Line
                    type="monotone"
                    dataKey="total_remaining"
                    name="Remaining"
                    stroke="#EC4899"
                    strokeWidth={2.5}
                    dot={false}
                    style={{ filter: "drop-shadow(0 0 8px #EC4899)" }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-slate-500 text-sm flex items-center justify-center h-full">
                {computing ? "Calculating…" : "Add debts to simulate."}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function SortableRow({ id, index, debt, extraValue, onExtraChange }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
  });
  const meta = debtTypeMeta(debt.type);
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : "auto",
    opacity: isDragging ? 0.85 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="glass-subtle rounded-xl p-3 flex items-center gap-3 border border-white/5"
      data-testid={`sortable-row-${id}`}
    >
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing text-slate-500 hover:text-white p-1 -m-1"
        aria-label="Drag"
        data-testid={`drag-handle-${id}`}
      >
        <GripVertical className="w-4 h-4" />
      </button>
      <div className="w-7 h-7 rounded-full bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-[11px] font-medium text-blue-300 shrink-0">
        {index + 1}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 mb-0.5">
          <span
            className="w-1.5 h-1.5 rounded-full shrink-0"
            style={{ background: meta.color }}
          />
          <span className="text-[10px] uppercase tracking-widest text-slate-500">
            {meta.label}
          </span>
        </div>
        <p className="text-sm font-medium truncate">{debt.name}</p>
        <p className="text-xs text-slate-500">
          {fmtMoney(debt.balance)} · {debt.apr.toFixed(2)}% · min {fmtMoney(debt.min_payment)}
        </p>
      </div>
      <div className="shrink-0">
        <label className="text-[10px] uppercase tracking-widest text-slate-500 block mb-1">
          + extra $/mo
        </label>
        <input
          type="number"
          step="1"
          min="0"
          placeholder="0"
          value={extraValue}
          onChange={(e) => onExtraChange(e.target.value)}
          onPointerDown={(e) => e.stopPropagation()}
          className="w-24 bg-white/5 border border-white/10 rounded-md px-2 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          data-testid={`extra-input-${id}`}
        />
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
