import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Debt } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FileText, Copy, Download, CheckCircle, AlertTriangle, Heart } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { generateLetter } from "@/lib/calculations";
import { Link } from "wouter";

export default function LetterGenerator() {
  const { toast } = useToast();
  const [letterType, setLetterType] = useState<"dispute" | "hardship" | "goodwill">("dispute");
  const [generated, setGenerated] = useState("");

  const [form, setForm] = useState({
    name: "",
    address: "",
    accountNumber: "",
    creditorName: "",
    creditorAddress: "",
    details: "",
    amount: "",
  });

  const { data: debts } = useQuery<Debt[]>({
    queryKey: ["/api/debts"],
  });

  const handleGenerate = () => {
    if (!form.name || !form.creditorName || !form.details) {
      toast({
        title: "Missing required fields",
        description: "Please fill in your name, creditor name, and details.",
        variant: "destructive",
      });
      return;
    }
    const letter = generateLetter(letterType, form);
    setGenerated(letter);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(generated);
    toast({ title: "Copied to clipboard" });
  };

  const handleDownload = () => {
    const blob = new Blob([generated], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${letterType}-letter-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSelectDebt = (debtId: string) => {
    const debt = debts?.find((d) => d.id === parseInt(debtId));
    if (debt) {
      setForm({
        ...form,
        creditorName: debt.lender || debt.name,
        accountNumber: debt.accountLast4 || "",
        amount: debt.balance.toString(),
      });
    }
  };

  const letterDescriptions = {
    dispute: {
      icon: AlertTriangle,
      title: "Dispute Letter",
      desc: "Challenge inaccurate information on your credit report under the FCRA. Send to the credit bureau or creditor reporting the error.",
      when: "When you find errors on your credit report: wrong balance, accounts that aren't yours, incorrect late payment marks, or debts past the statute of limitations.",
    },
    hardship: {
      icon: Heart,
      title: "Hardship Letter",
      desc: "Request temporary relief (lower rate, payment plan, fee waiver) due to financial difficulty. Send directly to your creditor.",
      when: "Job loss, medical emergency, divorce, natural disaster, or any situation that makes it difficult to keep up with payments. Send before you fall behind if possible.",
    },
    goodwill: {
      icon: CheckCircle,
      title: "Goodwill Letter",
      desc: "Ask a creditor to remove accurate negative marks as a courtesy. Works best when you have a strong overall history.",
      when: "You have a late payment that is technically accurate but was due to a one-time circumstance. Your account is now current and in good standing.",
    },
  };

  const current = letterDescriptions[letterType];
  const CurrentIcon = current.icon;

  return (
    <div className="space-y-6" data-testid="letters-page">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Letter Generator</h1>
        <p className="text-sm text-muted-foreground mt-1">Draft dispute, hardship, and goodwill letters you can actually send</p>
      </div>

      <Tabs value={letterType} onValueChange={(v) => { setLetterType(v as any); setGenerated(""); }}>
        <TabsList>
          <TabsTrigger value="dispute">Dispute</TabsTrigger>
          <TabsTrigger value="hardship">Hardship</TabsTrigger>
          <TabsTrigger value="goodwill">Goodwill</TabsTrigger>
        </TabsList>

        <TabsContent value={letterType} className="space-y-4 mt-4">
          {/* Info card */}
          <div className="flex items-start gap-3 p-4 rounded-lg bg-primary/5 border border-primary/15">
            <CurrentIcon className="w-5 h-5 text-primary shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium">{current.title}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{current.desc}</p>
              <p className="text-xs text-muted-foreground mt-2">
                <span className="font-medium">When to use:</span> {current.when}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Form */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Your Information</CardTitle>
              </CardHeader>
              <CardContent className="pb-4 space-y-4">
                {/* Quick-fill from debts */}
                {debts && debts.length > 0 && (
                  <div className="space-y-1.5">
                    <Label className="text-xs">Quick-fill from your debts</Label>
                    <Select onValueChange={handleSelectDebt}>
                      <SelectTrigger data-testid="select-debt">
                        <SelectValue placeholder="Select a debt to auto-fill..." />
                      </SelectTrigger>
                      <SelectContent>
                        {debts.map((d) => (
                          <SelectItem key={d.id} value={d.id.toString()}>
                            {d.name} {d.accountLast4 ? `(****${d.accountLast4})` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label htmlFor="letter-name" className="text-xs">Your Full Name</Label>
                  <Input
                    id="letter-name"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="John Doe"
                    data-testid="input-letter-name"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="letter-address" className="text-xs">Your Address</Label>
                  <Input
                    id="letter-address"
                    value={form.address}
                    onChange={(e) => setForm({ ...form, address: e.target.value })}
                    placeholder="123 Main St, City, ST 12345"
                    data-testid="input-letter-address"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="letter-creditor" className="text-xs">Creditor Name</Label>
                    <Input
                      id="letter-creditor"
                      value={form.creditorName}
                      onChange={(e) => setForm({ ...form, creditorName: e.target.value })}
                      placeholder="Chase Bank"
                      data-testid="input-letter-creditor"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="letter-account" className="text-xs">Account Number</Label>
                    <Input
                      id="letter-account"
                      value={form.accountNumber}
                      onChange={(e) => setForm({ ...form, accountNumber: e.target.value })}
                      placeholder="Last 4 digits"
                      data-testid="input-letter-account"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="letter-cred-addr" className="text-xs">Creditor Address</Label>
                  <Input
                    id="letter-cred-addr"
                    value={form.creditorAddress}
                    onChange={(e) => setForm({ ...form, creditorAddress: e.target.value })}
                    placeholder="P.O. Box 12345, City, ST 12345"
                    data-testid="input-creditor-address"
                  />
                </div>
                {letterType === "hardship" && (
                  <div className="space-y-1.5">
                    <Label htmlFor="letter-amount" className="text-xs">Current Balance (optional)</Label>
                    <Input
                      id="letter-amount"
                      value={form.amount}
                      onChange={(e) => setForm({ ...form, amount: e.target.value })}
                      placeholder="4523.67"
                      data-testid="input-letter-amount"
                    />
                  </div>
                )}
                <div className="space-y-1.5">
                  <Label htmlFor="letter-details" className="text-xs">
                    {letterType === "dispute"
                      ? "What is inaccurate? (be specific)"
                      : letterType === "hardship"
                      ? "Describe your hardship situation"
                      : "Explain the circumstances of the late payment"}
                  </Label>
                  <Textarea
                    id="letter-details"
                    value={form.details}
                    onChange={(e) => setForm({ ...form, details: e.target.value })}
                    rows={4}
                    placeholder={
                      letterType === "dispute"
                        ? "e.g., The late payment reported for March 2026 is incorrect. I made my payment on time on March 10th, 2026 (confirmation #12345)."
                        : letterType === "hardship"
                        ? "e.g., I was laid off from my position on February 1st, 2026. I am actively seeking new employment and expect to secure a position within 3 months."
                        : "e.g., I missed my January 2026 payment because I was hospitalized for an emergency surgery. I have since recovered and set up autopay to prevent this from happening again."
                    }
                    data-testid="input-letter-details"
                  />
                </div>

                <Button onClick={handleGenerate} className="w-full" data-testid="button-generate-letter">
                  <FileText className="w-4 h-4 mr-2" />
                  Generate Letter
                </Button>
              </CardContent>
            </Card>

            {/* Preview */}
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium">Letter Preview</CardTitle>
                  {generated && (
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" onClick={handleCopy} data-testid="button-copy-letter">
                        <Copy className="w-3.5 h-3.5 mr-1" />
                        Copy
                      </Button>
                      <Button variant="ghost" size="sm" onClick={handleDownload} data-testid="button-download-letter">
                        <Download className="w-3.5 h-3.5 mr-1" />
                        Download
                      </Button>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent className="pb-4">
                {generated ? (
                  <pre
                    className="text-xs leading-relaxed whitespace-pre-wrap font-mono bg-muted/30 rounded-lg p-4 max-h-[500px] overflow-y-auto"
                    data-testid="letter-preview"
                  >
                    {generated}
                  </pre>
                ) : (
                  <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
                    <FileText className="w-10 h-10 mb-3 opacity-30" />
                    <p className="text-sm">Fill in the form and click Generate to preview your letter</p>
                    <p className="text-xs mt-1">Letters include proper legal references and formatting</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Tips */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Sending Tips</CardTitle>
            </CardHeader>
            <CardContent className="pb-4 text-xs text-muted-foreground space-y-2">
              {letterType === "dispute" && (
                <>
                  <p>1. Send via certified mail with return receipt requested (USPS) for proof of delivery</p>
                  <p>2. Include copies (not originals) of any supporting documents</p>
                  <p>3. The bureau has 30 days to investigate and respond under the FCRA</p>
                  <p>4. Send to all three bureaus (Equifax, Experian, TransUnion) if the error appears on multiple reports</p>
                  <p>5. Keep copies of everything you send and receive</p>
                </>
              )}
              {letterType === "hardship" && (
                <>
                  <p>1. Call the creditor first to ask about their hardship program, then follow up in writing</p>
                  <p>2. Send before you miss payments if possible — creditors are more willing to help proactive borrowers</p>
                  <p>3. Be specific about your situation and realistic about what you can afford</p>
                  <p>4. Ask for any agreement to be confirmed in writing before making modified payments</p>
                  <p>5. Note: hardship programs may still report to credit bureaus differently</p>
                </>
              )}
              {letterType === "goodwill" && (
                <>
                  <p>1. Best chance of success with one or two isolated late payments, not a pattern</p>
                  <p>2. Be polite and appreciative — you are asking for a favor, not making a demand</p>
                  <p>3. Mention your loyalty as a customer and overall positive payment history</p>
                  <p>4. Success rate varies widely — some creditors (like Amex) are known to grant goodwill adjustments</p>
                  <p>5. If denied, try again in 3-6 months or ask to speak with a supervisor</p>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
