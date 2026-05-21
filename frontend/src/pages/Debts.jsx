import React, { useEffect, useState } from "react";
import { api, fmtMoney, formatApiErrorDetail } from "../lib/api";
import { DEBT_TYPES, debtTypeMeta } from "../lib/constants";
import { Plus, Pencil, Trash2, Wallet, X } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "../components/ui/dialog";

const empty = {
  name: "",
  type: "credit_card",
  balance: "",
  apr: "",
  min_payment: "",
  due_day: "",
};

export default function Debts() {
  const [debts, setDebts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(empty);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/debts");
      setDebts(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const openAdd = () => {
    setEditing(null);
    setForm(empty);
    setError("");
    setOpen(true);
  };

  const openEdit = (d) => {
    setEditing(d);
    setForm({
      name: d.name,
      type: d.type,
      balance: String(d.balance),
      apr: String(d.apr),
      min_payment: String(d.min_payment),
      due_day: d.due_day ? String(d.due_day) : "",
    });
    setError("");
    setOpen(true);
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    const payload = {
      name: form.name.trim(),
      type: form.type,
      balance: parseFloat(form.balance),
      apr: parseFloat(form.apr),
      min_payment: parseFloat(form.min_payment),
      due_day: form.due_day ? parseInt(form.due_day, 10) : null,
    };
    try {
      if (editing) {
        await api.put(`/debts/${editing.debt_id}`, payload);
        toast.success("Debt updated.");
      } else {
        await api.post("/debts", payload);
        toast.success("Debt added.");
      }
      setOpen(false);
      await load();
    } catch (e) {
      setError(formatApiErrorDetail(e.response?.data?.detail) || e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const onDelete = async (d) => {
    if (!window.confirm(`Delete "${d.name}"?`)) return;
    await api.delete(`/debts/${d.debt_id}`);
    toast.success("Debt removed.");
    await load();
  };

  const totalDebt = debts.reduce((s, d) => s + d.balance, 0);

  return (
    <div data-testid="debts-page">
      <div className="mb-10 flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <p className="text-label mb-3">Manage</p>
          <h1 className="font-display text-4xl sm:text-5xl font-light tracking-tighter">My debts</h1>
          <p className="text-slate-400 mt-2 text-sm">
            {debts.length} {debts.length === 1 ? "debt" : "debts"} · {fmtMoney(totalDebt)} total
          </p>
        </div>
        <button
          onClick={openAdd}
          className="bg-blue-600 hover:bg-blue-500 text-white rounded-lg px-5 py-2.5 text-sm font-medium transition-all shadow-[0_0_30px_rgba(37,99,235,0.4)] inline-flex items-center gap-2 self-start"
          data-testid="add-debt-btn"
        >
          <Plus className="w-4 h-4" />
          Add debt
        </button>
      </div>

      {loading ? (
        <div className="text-slate-400 text-sm tracking-widest uppercase">Loading…</div>
      ) : debts.length === 0 ? (
        <div className="glass rounded-2xl p-12 text-center" data-testid="debts-empty">
          <Wallet className="w-12 h-12 text-slate-600 mx-auto mb-4" />
          <h3 className="font-display text-xl mb-2">No debts yet</h3>
          <p className="text-slate-400 text-sm">Add your first debt to start planning.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {debts.map((d) => {
            const meta = debtTypeMeta(d.type);
            return (
              <div
                key={d.debt_id}
                className="glass rounded-2xl p-6 group hover:border-white/20 transition-all"
                data-testid={`debt-card-${d.debt_id}`}
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <span
                        className="w-2 h-2 rounded-full"
                        style={{ background: meta.color, boxShadow: `0 0 8px ${meta.color}` }}
                      />
                      <span className="text-xs uppercase tracking-widest text-slate-400">
                        {meta.label}
                      </span>
                    </div>
                    <h3 className="font-display text-xl font-medium tracking-tight">{d.name}</h3>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => openEdit(d)}
                      className="p-2 hover:bg-white/10 rounded-lg"
                      aria-label="Edit"
                      data-testid={`edit-debt-${d.debt_id}`}
                    >
                      <Pencil className="w-3.5 h-3.5 text-slate-400" />
                    </button>
                    <button
                      onClick={() => onDelete(d)}
                      className="p-2 hover:bg-red-500/10 rounded-lg"
                      aria-label="Delete"
                      data-testid={`delete-debt-${d.debt_id}`}
                    >
                      <Trash2 className="w-3.5 h-3.5 text-slate-400 hover:text-red-400" />
                    </button>
                  </div>
                </div>

                <div className="font-display text-3xl font-light tracking-tight mb-5">
                  {fmtMoney(d.balance)}
                </div>

                <div className="grid grid-cols-3 gap-3 text-xs">
                  <div>
                    <p className="text-slate-500 mb-1">APR</p>
                    <p className="text-slate-200 font-medium">{d.apr.toFixed(2)}%</p>
                  </div>
                  <div>
                    <p className="text-slate-500 mb-1">Min/mo</p>
                    <p className="text-slate-200 font-medium">{fmtMoney(d.min_payment)}</p>
                  </div>
                  <div>
                    <p className="text-slate-500 mb-1">Due</p>
                    <p className="text-slate-200 font-medium">
                      {d.due_day ? `Day ${d.due_day}` : "—"}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className="glass-strong border border-white/10 max-w-md"
          data-testid="debt-dialog"
        >
          <DialogHeader>
            <DialogTitle className="font-display text-2xl font-light tracking-tight">
              {editing ? "Edit debt" : "Add a debt"}
            </DialogTitle>
            <DialogDescription className="text-slate-400 text-sm">
              All numbers stay private to your account.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={onSubmit} className="space-y-4 mt-2">
            <Field
              label="Name"
              value={form.name}
              onChange={(v) => setForm({ ...form, name: v })}
              placeholder="e.g. Chase Sapphire"
              testid="debt-name"
              required
            />
            <div>
              <label className="text-xs text-slate-400 tracking-widest uppercase block mb-2">
                Type
              </label>
              <select
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                data-testid="debt-type"
              >
                {DEBT_TYPES.map((t) => (
                  <option key={t.value} value={t.value} className="bg-slate-900">
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field
                label="Balance ($)"
                type="number"
                step="0.01"
                value={form.balance}
                onChange={(v) => setForm({ ...form, balance: v })}
                placeholder="5000"
                testid="debt-balance"
                required
              />
              <Field
                label="APR (%)"
                type="number"
                step="0.01"
                value={form.apr}
                onChange={(v) => setForm({ ...form, apr: v })}
                placeholder="19.99"
                testid="debt-apr"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field
                label="Min payment ($/mo)"
                type="number"
                step="0.01"
                value={form.min_payment}
                onChange={(v) => setForm({ ...form, min_payment: v })}
                placeholder="100"
                testid="debt-min"
                required
              />
              <Field
                label="Due day (1–28)"
                type="number"
                min="1"
                max="28"
                value={form.due_day}
                onChange={(v) => setForm({ ...form, due_day: v })}
                placeholder="15"
                testid="debt-due"
              />
            </div>

            {error && (
              <div
                className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2"
                data-testid="debt-error"
              >
                {error}
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex-1 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg py-2.5 text-sm transition-colors"
                data-testid="dialog-cancel"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white rounded-lg py-2.5 text-sm font-medium shadow-[0_0_20px_rgba(37,99,235,0.3)] transition-all"
                data-testid="dialog-save"
              >
                {submitting ? "Saving…" : editing ? "Save changes" : "Add debt"}
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({ label, value, onChange, placeholder, type = "text", required, testid, ...rest }) {
  return (
    <div>
      <label className="text-xs text-slate-400 tracking-widest uppercase block mb-2">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        data-testid={testid}
        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        {...rest}
      />
    </div>
  );
}
