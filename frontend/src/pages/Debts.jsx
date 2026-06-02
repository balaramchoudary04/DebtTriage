import React, { useEffect, useState } from "react";
import { api, fmtMoney, formatApiErrorDetail } from "../lib/api";
import { DEBT_TYPES, debtTypeMeta } from "../lib/constants";
import { Plus, Pencil, Trash2, Wallet, CalendarIcon, Lock, Upload } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "../contexts/AuthContext";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "../components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "../components/ui/popover";
import { Calendar } from "../components/ui/calendar";

const empty = {
  name: "",
  type: "credit_card",
  balance: "",
  apr: "",
  min_payment: "",
  due_date: "",
};

function formatMMDDYY(isoDate) {
  if (!isoDate) return "";
  const d = new Date(isoDate + "T00:00:00");
  if (isNaN(d.getTime())) return "";
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const yy = String(d.getFullYear()).slice(-2);
  return `${mm}/${dd}/${yy}`;
}

function toISO(date) {
  if (!date) return "";
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export default function Debts() {
  const [debts, setDebts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(empty);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [dateOpen, setDateOpen] = useState(false);
  const [showCsvZone, setShowCsvZone] = useState(false);
  const [csvLoading, setCsvLoading] = useState(false);
  const navigate = useNavigate();
  const { user } = useAuth();
  const isPremium = !!(user && user.premium_until && new Date(user.premium_until) > new Date());

  const parseCSV = (text) => {
    const lines = text.split(/\r?\n/);
    if (lines.length < 2) return [];
    const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
    const rows = [];
    
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      const values = line.split(",").map((v) => v.replace(/^"|"$/g, "").trim());
      const row = {};
      headers.forEach((header, index) => {
        row[header] = values[index];
      });
      rows.push(row);
    }
    return rows;
  };

  const downloadTemplate = () => {
    const headers = "name,type,balance,apr,min_payment,due_date\nChase Sapphire,credit_card,5000,19.99,150,2026-06-15\nToyota Loan,car_loan,12000,4.5,280,2026-06-05";
    const blob = new Blob([headers], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "debtwise_template.csv");
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCsvUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setCsvLoading(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target.result;
        const rows = parseCSV(text);
        if (rows.length === 0) {
          toast.error("No valid data found in CSV file.");
          return;
        }
        
        let importedCount = 0;
        let limitReached = false;
        
        for (const row of rows) {
          if (!isPremium && (debts.length + importedCount) >= 3) {
            limitReached = true;
            break;
          }
          
          const balance = parseFloat(row.balance || row.amount);
          const apr = parseFloat(row.apr || row.interest);
          const min_payment = parseFloat(row.min_payment || row.minimum);
          
          if (!row.name || isNaN(balance) || isNaN(apr) || isNaN(min_payment)) {
            continue;
          }
          
          let type = (row.type || "credit_card").toLowerCase().replace(/\s+/g, "_");
          const validTypes = ["credit_card", "personal_loan", "car_loan", "student_loan", "mortgage", "medical", "other"];
          if (!validTypes.includes(type)) {
            type = "other";
          }
          
          const payload = {
            name: row.name,
            type,
            balance,
            apr,
            min_payment,
            due_date: row.due_date || null
          };
          
          await api.post("/debts", payload);
          importedCount++;
        }
        
        toast.success(`Successfully imported ${importedCount} debts!`);
        if (limitReached) {
          toast.info("Some debts were skipped due to free tier limit. Upgrade for unlimited slots.");
        }
        await load();
        setShowCsvZone(false);
      } catch (err) {
        console.error(err);
        toast.error("Error reading or importing CSV file.");
      } finally {
        setCsvLoading(false);
        e.target.value = "";
      }
    };
    reader.readAsText(file);
  };

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
    if (!isPremium && debts.length >= 3) {
      toast.info("Free plan is limited to 3 debts. Upgrade to Premium for unlimited.");
      navigate("/settings?upgrade=1");
      return;
    }
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
      due_date: d.due_date || "",
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
      due_date: form.due_date || null,
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
      if (e.response?.status === 402) {
        setError(formatApiErrorDetail(e.response?.data?.detail));
        toast.info("Upgrade to Premium for unlimited debts.");
      } else {
        setError(formatApiErrorDetail(e.response?.data?.detail) || e.message);
      }
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
        <div className="flex gap-3 self-start">
          <button
            onClick={() => setShowCsvZone(!showCsvZone)}
            className="bg-white/5 hover:bg-white/10 text-white border border-white/10 rounded-lg px-5 py-2.5 text-sm font-medium transition-all inline-flex items-center gap-2"
            data-testid="toggle-csv-btn"
          >
            <Upload className="w-4 h-4" />
            Import CSV
          </button>
          <button
            onClick={openAdd}
            className="bg-blue-600 hover:bg-blue-500 text-white rounded-lg px-5 py-2.5 text-sm font-medium transition-all shadow-[0_0_30px_rgba(37,99,235,0.4)] inline-flex items-center gap-2"
            data-testid="add-debt-btn"
          >
            <Plus className="w-4 h-4" />
            Add debt
          </button>
        </div>
      </div>

      {/* CSV Import Zone */}
      {showCsvZone && (
        <div className="glass rounded-2xl p-6 mb-6 animate-fade-up" data-testid="csv-import-zone">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
            <div>
              <h3 className="font-display text-lg font-medium text-slate-200">Import debts from spreadsheet</h3>
              <p className="text-slate-400 text-xs mt-1">
                Upload a standard CSV file with headers: <code className="text-blue-400 font-mono">name, type, balance, apr, min_payment, due_date</code>
              </p>
            </div>
            <button
              onClick={downloadTemplate}
              className="text-xs text-blue-400 hover:text-blue-300 font-medium self-start sm:self-center"
            >
              Download CSV Template
            </button>
          </div>

          <div className="border-2 border-dashed border-white/10 rounded-xl p-8 text-center bg-white/[0.01] hover:bg-white/[0.02] hover:border-white/20 transition-all relative">
            {csvLoading ? (
              <div className="text-slate-300 text-sm animate-pulse">Parsing and importing debts...</div>
            ) : (
              <div>
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleCsvUpload}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  data-testid="csv-file-input"
                />
                <Upload className="w-8 h-8 text-slate-500 mx-auto mb-3" />
                <p className="text-sm font-medium text-slate-300">Click to select or drag your CSV file here</p>
                <p className="text-xs text-slate-500 mt-1">Supports file formats matching the template columns</p>
              </div>
            )}
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-slate-400 text-sm tracking-widest uppercase">Loading…</div>
      ) : debts.length === 0 ? (
        <div className="glass rounded-2xl p-12 text-center" data-testid="debts-empty">
          <Wallet className="w-12 h-12 text-slate-600 mx-auto mb-4" />
          <h3 className="font-display text-xl mb-2">No debts yet</h3>
          <p className="text-slate-400 text-sm">Add your first debt to start planning.</p>
        </div>
      ) : (
        <>
          {!isPremium && debts.length >= 3 && (
            <div
              className="glass rounded-xl p-4 mb-5 flex items-center gap-3 border-amber-500/20"
              data-testid="free-limit-banner"
            >
              <div className="w-9 h-9 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center shrink-0">
                <Lock className="w-4 h-4 text-amber-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">Free plan limit reached</p>
                <p className="text-xs text-slate-400">
                  Upgrade to Premium to track unlimited debts and unlock the Simulator.
                </p>
              </div>
              <button
                onClick={() => navigate("/settings?upgrade=1")}
                className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium px-4 py-2 rounded-lg shrink-0"
                data-testid="banner-upgrade-btn"
              >
                Upgrade
              </button>
            </div>
          )}
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
                      {d.due_date ? formatMMDDYY(d.due_date) : d.due_day ? `Day ${d.due_day}` : "—"}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        </>
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
              <div>
                <label className="text-xs text-slate-400 tracking-widest uppercase block mb-2">
                  Due date
                </label>
                <Popover open={dateOpen} onOpenChange={setDateOpen}>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-left flex items-center justify-between hover:bg-white/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                      data-testid="debt-due"
                    >
                      <span className={form.due_date ? "text-slate-100" : "text-slate-500"}>
                        {form.due_date ? formatMMDDYY(form.due_date) : "MM/DD/YY"}
                      </span>
                      <CalendarIcon className="w-4 h-4 text-slate-500" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent
                    className="w-auto p-0 glass-strong border border-white/10"
                    align="start"
                    data-testid="debt-due-popover"
                  >
                    <Calendar
                      mode="single"
                      selected={form.due_date ? new Date(form.due_date + "T00:00:00") : undefined}
                      onSelect={(date) => {
                        setForm({ ...form, due_date: date ? toISO(date) : "" });
                        setDateOpen(false);
                      }}
                      initialFocus
                    />
                    {form.due_date && (
                      <div className="p-2 border-t border-white/10">
                        <button
                          type="button"
                          onClick={() => {
                            setForm({ ...form, due_date: "" });
                            setDateOpen(false);
                          }}
                          className="w-full text-xs text-slate-400 hover:text-white py-1.5 rounded-md hover:bg-white/5"
                          data-testid="debt-due-clear"
                        >
                          Clear date
                        </button>
                      </div>
                    )}
                  </PopoverContent>
                </Popover>
              </div>
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
