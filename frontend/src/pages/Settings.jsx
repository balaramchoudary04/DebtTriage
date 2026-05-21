import React, { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { api, formatApiErrorDetail } from "../lib/api";
import { useAuth } from "../contexts/AuthContext";
import { toast } from "sonner";
import {
  User,
  Crown,
  CreditCard,
  Sparkles,
  Check,
  LogOut,
  ShieldCheck,
  Loader2,
} from "lucide-react";

function fmtDate(iso) {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return iso;
  }
}

export default function Settings() {
  const { user, checkAuth, logout } = useAuth();
  const [params, setParams] = useSearchParams();
  const [name, setName] = useState(user?.name || "");
  const [savingProfile, setSavingProfile] = useState(false);
  const [sub, setSub] = useState(null);
  const [checkoutLoading, setCheckoutLoading] = useState(null); // "monthly" | "annual"
  const [polling, setPolling] = useState(false);
  const navigate = useNavigate();
  const upgradeAnchor = params.get("upgrade") === "1";

  const loadSub = async () => {
    const { data } = await api.get("/subscription/me");
    setSub(data);
  };

  useEffect(() => {
    setName(user?.name || "");
  }, [user?.name]);

  useEffect(() => {
    loadSub();
  }, []);

  useEffect(() => {
    if (upgradeAnchor) {
      // smooth-scroll to subscription
      setTimeout(() => {
        document.getElementById("subscription-section")?.scrollIntoView({ behavior: "smooth" });
      }, 120);
    }
  }, [upgradeAnchor]);

  // Handle return from Stripe checkout
  useEffect(() => {
    const sessionId = params.get("session_id");
    const cancelled = params.get("subscription");
    if (cancelled === "cancelled") {
      toast.error("Subscription cancelled.");
      params.delete("subscription");
      setParams(params, { replace: true });
      return;
    }
    if (!sessionId) return;
    let attempts = 0;
    setPolling(true);

    const poll = async () => {
      attempts++;
      try {
        const { data } = await api.get(`/subscription/status/${sessionId}`);
        if (data.payment_status === "paid") {
          toast.success("Welcome to Premium! 🎉");
          await checkAuth();
          await loadSub();
          params.delete("session_id");
          setParams(params, { replace: true });
          setPolling(false);
          return;
        }
        if (data.status === "expired" || attempts >= 8) {
          toast.error("Payment did not complete.");
          params.delete("session_id");
          setParams(params, { replace: true });
          setPolling(false);
          return;
        }
        setTimeout(poll, 2000);
      } catch {
        if (attempts < 8) {
          setTimeout(poll, 2000);
        } else {
          setPolling(false);
        }
      }
    };
    poll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const saveProfile = async (e) => {
    e.preventDefault();
    setSavingProfile(true);
    try {
      await api.put("/profile", { name });
      await checkAuth();
      toast.success("Profile updated.");
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail) || e.message);
    } finally {
      setSavingProfile(false);
    }
  };

  const subscribe = async (packageId) => {
    setCheckoutLoading(packageId);
    try {
      const { data } = await api.post("/subscription/checkout", {
        package_id: packageId,
        origin_url: window.location.origin,
      });
      window.location.href = data.url;
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail) || e.message);
      setCheckoutLoading(null);
    }
  };

  const cancelPlan = async () => {
    if (!window.confirm("Cancel auto-renewal? You keep premium until it expires.")) return;
    try {
      await api.post("/subscription/cancel");
      await loadSub();
      await checkAuth();
      toast.success("Auto-renewal cancelled. You still have premium until expiry.");
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail) || e.message);
    }
  };

  const isPremium = !!sub?.premium;

  return (
    <div data-testid="settings-page">
      <div className="mb-10">
        <p className="text-label mb-3">Account</p>
        <h1 className="font-display text-4xl sm:text-5xl font-light tracking-tighter">Settings</h1>
        <p className="text-slate-400 mt-2 text-sm">
          Profile, preferences, and subscription management.
        </p>
      </div>

      {/* Profile */}
      <section className="glass rounded-2xl p-6 mb-6" data-testid="profile-section">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl glass-subtle flex items-center justify-center">
            <User className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <p className="text-label">Profile</p>
            <h3 className="font-display text-xl font-medium mt-1">Your details</h3>
          </div>
        </div>
        <form onSubmit={saveProfile} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-slate-400 tracking-widest uppercase block mb-2">
              Name
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              data-testid="profile-name-input"
            />
          </div>
          <div>
            <label className="text-xs text-slate-400 tracking-widest uppercase block mb-2">
              Email
            </label>
            <input
              value={user?.email || ""}
              disabled
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-slate-400 cursor-not-allowed"
              data-testid="profile-email-input"
            />
          </div>
          <div className="sm:col-span-2 flex justify-between items-center pt-2">
            <div className="text-xs text-slate-500">
              Signed in via{" "}
              <span className="text-slate-300 capitalize">{user?.auth_provider || "email"}</span>
            </div>
            <button
              type="submit"
              disabled={savingProfile || !name || name === user?.name}
              className="bg-blue-600 hover:bg-blue-500 disabled:opacity-60 disabled:cursor-not-allowed text-white rounded-lg px-5 py-2.5 text-sm font-medium shadow-[0_0_20px_rgba(37,99,235,0.3)] transition-all"
              data-testid="save-profile-btn"
            >
              {savingProfile ? "Saving…" : "Save changes"}
            </button>
          </div>
        </form>
      </section>

      {/* Subscription */}
      <section
        id="subscription-section"
        className={`glass rounded-2xl p-6 mb-6 relative overflow-hidden ${
          upgradeAnchor ? "ring-1 ring-blue-500/40" : ""
        }`}
        data-testid="subscription-section"
      >
        <div
          className="absolute -top-20 -right-20 w-80 h-80 rounded-full opacity-25 blur-3xl pointer-events-none"
          style={{ background: "radial-gradient(circle, #2563EB, transparent)" }}
        />
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl glass-subtle flex items-center justify-center">
              <Crown className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <p className="text-label">Plan</p>
              <h3 className="font-display text-xl font-medium mt-1">Subscription</h3>
            </div>
          </div>

          {/* Current status */}
          <div className="glass-subtle rounded-xl p-5 mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-widest text-slate-500 mb-1">Current plan</p>
              <p className="font-display text-2xl font-medium tracking-tight">
                {isPremium ? "Premium" : "Free"}
                {sub?.plan && (
                  <span className="ml-2 text-xs uppercase tracking-widest text-blue-300 bg-blue-500/15 border border-blue-500/30 rounded-full px-2 py-0.5 align-middle">
                    {sub.plan}
                  </span>
                )}
              </p>
              {isPremium ? (
                <p className="text-xs text-slate-400 mt-1.5 flex items-center gap-1.5">
                  <ShieldCheck className="w-3 h-3 text-emerald-400" />
                  Active until {fmtDate(sub.premium_until)}
                </p>
              ) : (
                <p className="text-xs text-slate-400 mt-1.5">
                  Limited to {sub?.debt_limit_free ?? 3} debts. Simulator locked.
                </p>
              )}
            </div>
            {isPremium && sub?.plan && (
              <button
                onClick={cancelPlan}
                className="text-xs text-slate-300 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg px-4 py-2 transition-colors self-start"
                data-testid="cancel-plan-btn"
              >
                Cancel auto-renewal
              </button>
            )}
          </div>

          {polling && (
            <div
              className="flex items-center gap-2 text-sm text-blue-300 mb-5"
              data-testid="polling-indicator"
            >
              <Loader2 className="w-4 h-4 animate-spin" />
              Confirming your payment…
            </div>
          )}

          {/* Plans grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <PlanCard
              testid="plan-monthly"
              accent="#2563EB"
              title="Monthly"
              price="$5"
              cadence="/month"
              ctaText={isPremium && sub?.plan === "monthly" ? "Current plan" : "Subscribe monthly"}
              ctaDisabled={isPremium && sub?.plan === "monthly"}
              loading={checkoutLoading === "monthly"}
              onClick={() => subscribe("monthly")}
              perks={["Unlimited debts", "Strategy simulator", "Cancel anytime"]}
            />
            <PlanCard
              testid="plan-annual"
              accent="#10B981"
              title="Annual"
              price="$50"
              cadence="/year"
              badge="Save 17%"
              ctaText={isPremium && sub?.plan === "annual" ? "Current plan" : "Subscribe annually"}
              ctaDisabled={isPremium && sub?.plan === "annual"}
              loading={checkoutLoading === "annual"}
              onClick={() => subscribe("annual")}
              perks={[
                "Everything in Monthly",
                "2 months free vs monthly",
                "Priority email support",
              ]}
            />
          </div>

          <p className="text-xs text-slate-500 mt-5 flex items-center gap-1.5">
            <CreditCard className="w-3.5 h-3.5" />
            Secure checkout via Stripe. Test mode — use card 4242 4242 4242 4242 with any future
            date & CVC.
          </p>
        </div>
      </section>

      {/* Danger zone */}
      <section className="glass rounded-2xl p-6" data-testid="danger-section">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl glass-subtle flex items-center justify-center">
            <LogOut className="w-5 h-5 text-red-400" />
          </div>
          <div>
            <p className="text-label">Session</p>
            <h3 className="font-display text-xl font-medium mt-1">Sign out</h3>
          </div>
        </div>
        <p className="text-sm text-slate-400 mb-4">
          End your session on this device. Your data stays safe in your account.
        </p>
        <button
          onClick={async () => {
            await logout();
            toast.success("Signed out.");
            navigate("/", { replace: true });
          }}
          className="bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-lg px-5 py-2.5 text-sm transition-colors inline-flex items-center gap-2"
          data-testid="settings-logout-btn"
        >
          <LogOut className="w-4 h-4" /> Sign out
        </button>
      </section>
    </div>
  );
}

function PlanCard({
  testid,
  accent,
  title,
  price,
  cadence,
  badge,
  ctaText,
  ctaDisabled,
  loading,
  onClick,
  perks,
}) {
  return (
    <div
      className="glass-subtle rounded-xl p-6 relative overflow-hidden border border-white/10"
      data-testid={testid}
    >
      {badge && (
        <span
          className="absolute top-4 right-4 text-[10px] uppercase tracking-widest text-emerald-300 bg-emerald-500/15 border border-emerald-500/30 rounded-full px-2 py-0.5"
          data-testid={`${testid}-badge`}
        >
          {badge}
        </span>
      )}
      <div className="flex items-center gap-2 mb-3">
        <span
          className="w-2 h-2 rounded-full"
          style={{ background: accent, boxShadow: `0 0 8px ${accent}` }}
        />
        <span className="text-label">{title}</span>
      </div>
      <div className="flex items-baseline gap-1 mb-5">
        <span className="font-display text-4xl font-light tracking-tighter">{price}</span>
        <span className="text-sm text-slate-400">{cadence}</span>
      </div>
      <ul className="space-y-2 mb-6">
        {perks.map((p, i) => (
          <li key={i} className="text-sm text-slate-300 flex items-center gap-2">
            <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            {p}
          </li>
        ))}
      </ul>
      <button
        onClick={onClick}
        disabled={ctaDisabled || loading}
        className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg py-2.5 text-sm font-medium shadow-[0_0_20px_rgba(37,99,235,0.3)] transition-all flex items-center justify-center gap-2"
        data-testid={`${testid}-cta`}
      >
        {loading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" /> Redirecting…
          </>
        ) : (
          <>
            <Sparkles className="w-4 h-4" />
            {ctaText}
          </>
        )}
      </button>
    </div>
  );
}
