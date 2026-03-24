import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import type { Debt, InsertDebt } from "@shared/schema";
import { debtTypeLabels } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { formatCurrency, formatPercent } from "@/lib/calculations";
import { Plus, Trash2, Edit, Upload, CreditCard, GraduationCap, Car, Banknote } from "lucide-react";

const typeIcons: Record<string, typeof CreditCard> = {
  credit_card: CreditCard,
  student_loan: GraduationCap,
  auto_loan: Car,
  personal_loan: Banknote,
};

function DebtForm({
  initialData,
  onSubmit,
  onCancel,
  isPending,
}: {
  initialData?: Partial<InsertDebt>;
  onSubmit: (data: InsertDebt) => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  const [form, setForm] = useState<Partial<InsertDebt>>({
    name: "",
    type: "credit_card",
    balance: 0,
    creditLimit: undefined,
    apr: 0,
    minimumPayment: 0,
    dueDay: 1,
    lender: "",
    accountLast4: "",
    ...initialData,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      name: form.name || "",
      type: form.type || "credit_card",
      balance: form.balance || 0,
      creditLimit: form.type === "credit_card" ? form.creditLimit : undefined,
      apr: form.apr || 0,
      minimumPayment: form.minimumPayment || 0,
      dueDay: form.dueDay || 1,
      lender: form.lender || null,
      accountLast4: form.accountLast4 || null,
      isDeferred: form.isDeferred || false,
      promoAprEnd: form.promoAprEnd || null,
      promoApr: form.promoApr || null,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="name" className="text-xs">Account Name</Label>
          <Input
            id="name"
            placeholder="e.g., Chase Sapphire"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
            data-testid="input-name"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="type" className="text-xs">Debt Type</Label>
          <Select
            value={form.type}
            onValueChange={(v) => setForm({ ...form, type: v })}
          >
            <SelectTrigger id="type" data-testid="select-type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(debtTypeLabels).map(([val, label]) => (
                <SelectItem key={val} value={val}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="balance" className="text-xs">Current Balance ($)</Label>
          <Input
            id="balance"
            type="number"
            step="0.01"
            min="0"
            value={form.balance || ""}
            onChange={(e) => setForm({ ...form, balance: parseFloat(e.target.value) || 0 })}
            required
            data-testid="input-balance"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="apr" className="text-xs">APR (%)</Label>
          <Input
            id="apr"
            type="number"
            step="0.01"
            min="0"
            max="99"
            value={form.apr || ""}
            onChange={(e) => setForm({ ...form, apr: parseFloat(e.target.value) || 0 })}
            required
            data-testid="input-apr"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="minPayment" className="text-xs">Minimum Payment ($)</Label>
          <Input
            id="minPayment"
            type="number"
            step="0.01"
            min="0"
            value={form.minimumPayment || ""}
            onChange={(e) => setForm({ ...form, minimumPayment: parseFloat(e.target.value) || 0 })}
            required
            data-testid="input-min-payment"
          />
        </div>
      </div>

      {form.type === "credit_card" && (
        <div className="space-y-1.5">
          <Label htmlFor="creditLimit" className="text-xs">Credit Limit ($)</Label>
          <Input
            id="creditLimit"
            type="number"
            step="0.01"
            min="0"
            value={form.creditLimit || ""}
            onChange={(e) => setForm({ ...form, creditLimit: parseFloat(e.target.value) || undefined })}
            placeholder="For utilization calculations"
            data-testid="input-credit-limit"
          />
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="dueDay" className="text-xs">Due Day of Month</Label>
          <Input
            id="dueDay"
            type="number"
            min="1"
            max="31"
            value={form.dueDay || ""}
            onChange={(e) => setForm({ ...form, dueDay: parseInt(e.target.value) || 1 })}
            data-testid="input-due-day"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="lender" className="text-xs">Lender (optional)</Label>
          <Input
            id="lender"
            value={form.lender || ""}
            onChange={(e) => setForm({ ...form, lender: e.target.value })}
            placeholder="e.g., Chase, Navient"
            data-testid="input-lender"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="last4" className="text-xs">Last 4 Digits (optional)</Label>
          <Input
            id="last4"
            maxLength={4}
            value={form.accountLast4 || ""}
            onChange={(e) => setForm({ ...form, accountLast4: e.target.value })}
            placeholder="1234"
            data-testid="input-last4"
          />
        </div>
      </div>

      <div className="flex gap-2 pt-2">
        <Button type="submit" disabled={isPending} data-testid="button-submit-debt">
          {isPending ? "Saving..." : initialData ? "Update Debt" : "Add Debt"}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
      </div>
    </form>
  );
}

// Statement text parser
function parseStatementText(text: string): Partial<InsertDebt>[] {
  const results: Partial<InsertDebt>[] = [];
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);

  // Try to find balance, APR, minimum payment patterns
  let currentDebt: Partial<InsertDebt> = {};

  for (const line of lines) {
    const balanceMatch = line.match(/(?:balance|amount\s*(?:due|owed)|total\s*(?:balance|due))[:\s]*\$?([\d,]+\.?\d*)/i);
    const aprMatch = line.match(/(?:apr|annual\s*percentage\s*rate|interest\s*rate)[:\s]*([\d.]+)\s*%/i);
    const minPayMatch = line.match(/(?:minimum\s*(?:payment|due|amount)|min\s*(?:payment|due))[:\s]*\$?([\d,]+\.?\d*)/i);
    const limitMatch = line.match(/(?:credit\s*limit|available\s*credit|total\s*credit\s*line)[:\s]*\$?([\d,]+\.?\d*)/i);
    const accountMatch = line.match(/(?:account|acct)[:\s#]*(?:.*?)([\d]{4})\b/i);
    const nameMatch = line.match(/(?:account\s*name|card\s*name|creditor)[:\s]*(.*)/i);

    if (balanceMatch) currentDebt.balance = parseFloat(balanceMatch[1].replace(/,/g, ""));
    if (aprMatch) currentDebt.apr = parseFloat(aprMatch[1]);
    if (minPayMatch) currentDebt.minimumPayment = parseFloat(minPayMatch[1].replace(/,/g, ""));
    if (limitMatch) currentDebt.creditLimit = parseFloat(limitMatch[1].replace(/,/g, ""));
    if (accountMatch) currentDebt.accountLast4 = accountMatch[1];
    if (nameMatch) currentDebt.name = nameMatch[1].trim();
  }

  // If we found at least a balance, add it
  if (currentDebt.balance && currentDebt.balance > 0) {
    if (!currentDebt.name) currentDebt.name = "Imported Account";
    if (!currentDebt.type) currentDebt.type = currentDebt.creditLimit ? "credit_card" : "personal_loan";
    if (!currentDebt.minimumPayment) currentDebt.minimumPayment = Math.max(25, currentDebt.balance * 0.02);
    if (!currentDebt.apr) currentDebt.apr = 18.0;
    if (!currentDebt.dueDay) currentDebt.dueDay = 15;
    results.push(currentDebt);
  }

  return results;
}

export default function Debts() {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingDebt, setEditingDebt] = useState<Debt | null>(null);
  const [pasteMode, setPasteMode] = useState(false);
  const [pasteText, setPasteText] = useState("");

  const { data: debts, isLoading } = useQuery<Debt[]>({
    queryKey: ["/api/debts"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: InsertDebt) => {
      const res = await apiRequest("POST", "/api/debts", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/debts"] });
      setDialogOpen(false);
      setEditingDebt(null);
      toast({ title: "Debt added successfully" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<InsertDebt> }) => {
      const res = await apiRequest("PATCH", `/api/debts/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/debts"] });
      setDialogOpen(false);
      setEditingDebt(null);
      toast({ title: "Debt updated" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/debts/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/debts"] });
      toast({ title: "Debt removed" });
    },
  });

  const handlePasteImport = () => {
    const parsed = parseStatementText(pasteText);
    if (parsed.length === 0) {
      toast({ title: "Could not parse statement", description: "Try pasting balance, APR, and minimum payment lines", variant: "destructive" });
      return;
    }
    for (const debt of parsed) {
      createMutation.mutate(debt as InsertDebt);
    }
    setPasteMode(false);
    setPasteText("");
    toast({ title: `Imported ${parsed.length} account(s)` });
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-48" />
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-24 rounded-lg" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="debts-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">My Debts</h1>
          <p className="text-sm text-muted-foreground mt-1">Add and manage your debt accounts</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setPasteMode(true)} data-testid="paste-import">
            <Upload className="w-4 h-4 mr-2" />
            Paste Statement
          </Button>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" onClick={() => setEditingDebt(null)} data-testid="add-debt-button">
                <Plus className="w-4 h-4 mr-2" />
                Add Debt
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingDebt ? "Edit Debt" : "Add New Debt"}</DialogTitle>
              </DialogHeader>
              <DebtForm
                initialData={editingDebt || undefined}
                onSubmit={(data) => {
                  if (editingDebt) {
                    updateMutation.mutate({ id: editingDebt.id, data });
                  } else {
                    createMutation.mutate(data);
                  }
                }}
                onCancel={() => {
                  setDialogOpen(false);
                  setEditingDebt(null);
                }}
                isPending={createMutation.isPending || updateMutation.isPending}
              />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Paste import dialog */}
      <Dialog open={pasteMode} onOpenChange={setPasteMode}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Paste Statement Text</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Paste text from your credit card or loan statement. The parser will look for balance, APR,
            minimum payment, credit limit, and account number patterns.
          </p>
          <textarea
            className="w-full h-40 p-3 text-sm rounded-md border border-border bg-background resize-none focus:outline-none focus:ring-2 focus:ring-ring"
            placeholder={`Example:\nAccount Number: ****1234\nCurrent Balance: $4,523.67\nMinimum Payment Due: $90.00\nAnnual Percentage Rate: 22.99%\nCredit Limit: $8,000.00`}
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            data-testid="paste-textarea"
          />
          <div className="flex gap-2">
            <Button onClick={handlePasteImport} disabled={!pasteText.trim()} data-testid="button-import">
              Import
            </Button>
            <Button variant="outline" onClick={() => setPasteMode(false)}>Cancel</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Debt cards */}
      {(!debts || debts.length === 0) ? (
        <div className="text-center py-16 text-muted-foreground" data-testid="no-debts">
          <CreditCard className="w-12 h-12 mx-auto mb-4 opacity-30" />
          <p className="text-sm">No debts added yet. Click "Add Debt" or paste a statement to get started.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4" data-testid="debt-cards">
          {debts.map((debt) => {
            const Icon = typeIcons[debt.type] || CreditCard;
            const utilization = debt.creditLimit ? (debt.balance / debt.creditLimit) * 100 : null;
            return (
              <Card key={debt.id} className="relative group">
                <CardContent className="pt-5 pb-4 px-5">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
                        <Icon className="w-4 h-4 text-muted-foreground" />
                      </div>
                      <div>
                        <h3 className="font-medium text-sm">{debt.name}</h3>
                        <p className="text-xs text-muted-foreground">
                          {debtTypeLabels[debt.type]}
                          {debt.accountLast4 && ` · ****${debt.accountLast4}`}
                          {debt.lender && ` · ${debt.lender}`}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => {
                          setEditingDebt(debt);
                          setDialogOpen(true);
                        }}
                        data-testid={`edit-debt-${debt.id}`}
                      >
                        <Edit className="w-3.5 h-3.5" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" data-testid={`delete-debt-${debt.id}`}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Remove this debt?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will remove "{debt.name}" from your triage. This cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => deleteMutation.mutate(debt.id)}>
                              Remove
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4 mt-4">
                    <div>
                      <p className="text-xs text-muted-foreground">Balance</p>
                      <p className="text-sm font-semibold tabular-nums">{formatCurrency(debt.balance)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">APR</p>
                      <p className={`text-sm font-semibold tabular-nums ${debt.apr > 20 ? "text-destructive" : ""}`}>
                        {formatPercent(debt.apr)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Minimum</p>
                      <p className="text-sm font-semibold tabular-nums">{formatCurrency(debt.minimumPayment)}</p>
                    </div>
                  </div>

                  {utilization !== null && (
                    <div className="mt-3">
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="text-muted-foreground">Utilization</span>
                        <span className={`font-medium tabular-nums ${utilization > 30 ? "text-destructive" : "text-green-600 dark:text-green-400"}`}>
                          {utilization.toFixed(0)}%
                        </span>
                      </div>
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${utilization > 50 ? "bg-destructive" : utilization > 30 ? "bg-yellow-500" : "bg-green-500"}`}
                          style={{ width: `${Math.min(utilization, 100)}%` }}
                        />
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
