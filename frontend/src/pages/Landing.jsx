import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, ShieldCheck, Sparkles, TrendingDown, Snowflake, Zap, Target } from "lucide-react";

export default function Landing() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen relative overflow-hidden" data-testid="landing-page">
      {/* Background image */}
      <div
        className="absolute inset-0 opacity-30 pointer-events-none"
        style={{
          backgroundImage:
            "url('https://static.prod-images.emergentagent.com/jobs/ca258668-a191-4712-a4d0-8134cc42fff5/images/87fbde892691a298560a122514b4db994cd2af86af2fa6cbd284119025b32eab.png')",
          backgroundSize: "cover",
          backgroundPosition: "center",
          maskImage: "linear-gradient(to bottom, black 0%, black 60%, transparent 100%)",
          WebkitMaskImage: "linear-gradient(to bottom, black 0%, black 60%, transparent 100%)",
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-slate-950/60 to-slate-950 pointer-events-none" />

      {/* Nav */}
      <nav className="relative z-10 px-6 md:px-12 py-6 flex items-center justify-between">
        <div className="flex items-center gap-3" data-testid="logo">
          <div className="w-9 h-9 rounded-xl glass glow-blue flex items-center justify-center">
            <TrendingDown className="w-5 h-5 text-blue-400" />
          </div>
          <span className="font-display text-xl tracking-tight">DebtWise</span>
        </div>
        <div className="flex items-center gap-3">
          <Link
            to="/login"
            className="text-sm text-slate-300 hover:text-white transition-colors px-4 py-2"
            data-testid="nav-login"
          >
            Sign in
          </Link>
          <button
            onClick={() => navigate("/login?mode=signup")}
            className="text-sm bg-white/5 hover:bg-white/10 border border-white/10 px-4 py-2 rounded-lg backdrop-blur-md transition-colors"
            data-testid="nav-signup"
          >
            Get started
          </button>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative z-10 px-6 md:px-12 pt-16 md:pt-24 pb-32 max-w-7xl mx-auto">
        <div className="max-w-4xl">
          <div className="inline-flex items-center gap-2 glass-subtle px-4 py-1.5 rounded-full mb-8 animate-fade-up">
            <Sparkles className="w-3.5 h-3.5 text-blue-400" />
            <span className="text-xs tracking-widest uppercase text-slate-300">
              Smarter payoff strategy
            </span>
          </div>

          <h1 className="font-display text-5xl sm:text-6xl lg:text-7xl font-light leading-[0.95] tracking-tighter mb-8 animate-fade-up delay-100">
            Crush your debt
            <br />
            <span className="gradient-text-blue">strategically.</span>
          </h1>

          <p className="text-lg sm:text-xl text-slate-300 max-w-2xl leading-relaxed mb-10 animate-fade-up delay-200">
            Track every loan, every card, every dollar. DebtWise compares avalanche, snowball, and
            custom payoff plans so you find the fastest, cheapest path to debt-free.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 animate-fade-up delay-300">
            <button
              onClick={() => navigate("/login?mode=signup")}
              className="group bg-blue-600 hover:bg-blue-500 text-white rounded-lg px-7 py-3.5 font-medium transition-all shadow-[0_0_30px_rgba(37,99,235,0.4)] hover:shadow-[0_0_40px_rgba(37,99,235,0.6)] flex items-center justify-center gap-2"
              data-testid="hero-cta-primary"
            >
              Start free
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>
            <Link
              to="/login"
              className="bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-lg px-7 py-3.5 font-medium transition-colors backdrop-blur-md flex items-center justify-center"
              data-testid="hero-cta-secondary"
            >
              Sign in
            </Link>
          </div>
        </div>
      </section>

      {/* Features grid */}
      <section className="relative z-10 px-6 md:px-12 pb-32 max-w-7xl mx-auto">
        <div className="mb-12">
          <p className="text-label mb-3">Strategies</p>
          <h2 className="font-display text-3xl sm:text-4xl font-medium tracking-tight max-w-2xl">
            Four proven methods to escape debt. Compared side-by-side.
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          <FeatureCard
            icon={<TrendingDown className="w-6 h-6 text-blue-400" />}
            label="Avalanche"
            title="Highest interest first"
            desc="Mathematically the cheapest path. Kills the debt costing you most every month."
          />
          <FeatureCard
            icon={<Snowflake className="w-6 h-6 text-emerald-400" />}
            label="Snowball"
            title="Smallest balance first"
            desc="Stack quick wins. Behavioral momentum that keeps you motivated for the long haul."
          />
          <FeatureCard
            icon={<Zap className="w-6 h-6 text-amber-400" />}
            label="Highest Payment"
            title="Free up cash flow"
            desc="Knock out the debt eating your monthly budget so you breathe sooner."
          />
          <FeatureCard
            icon={<Target className="w-6 h-6 text-fuchsia-400" />}
            label="Custom"
            title="Your priority order"
            desc="Drag debts into your preferred order. We simulate the rest, month by month."
          />
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="relative z-10 px-6 md:px-12 pb-24 max-w-7xl mx-auto">
        <div className="glass rounded-3xl p-10 md:p-16 relative overflow-hidden">
          <div
            className="absolute -top-20 -right-20 w-80 h-80 rounded-full opacity-30 blur-3xl"
            style={{ background: "radial-gradient(circle, #2563eb, transparent)" }}
          />
          <div className="relative z-10 max-w-2xl">
            <ShieldCheck className="w-10 h-10 text-blue-400 mb-6" />
            <h3 className="font-display text-3xl sm:text-4xl font-medium tracking-tight mb-4">
              Your data. Your plan. Your pace.
            </h3>
            <p className="text-slate-300 mb-8 leading-relaxed">
              Everything stays in your private account. Run scenarios, simulate extra payments, and
              watch your debt-free date pull forward in real time.
            </p>
            <button
              onClick={() => navigate("/login?mode=signup")}
              className="bg-blue-600 hover:bg-blue-500 text-white rounded-lg px-7 py-3.5 font-medium transition-all shadow-[0_0_30px_rgba(37,99,235,0.4)] inline-flex items-center gap-2"
              data-testid="bottom-cta"
            >
              Build my plan
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </section>

      <footer className="relative z-10 px-6 md:px-12 py-8 border-t border-white/5">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <span>© {new Date().getFullYear()} DebtWise. A clearer path out of debt.</span>
          <span className="tracking-widest uppercase">Built for clarity</span>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({ icon, label, title, desc }) {
  return (
    <div
      className="glass rounded-2xl p-6 hover:bg-slate-800/50 hover:border-white/20 transition-all duration-300 group"
      data-testid={`feature-${label.toLowerCase()}`}
    >
      <div className="w-12 h-12 rounded-xl glass-subtle flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
        {icon}
      </div>
      <p className="text-label mb-2">{label}</p>
      <h4 className="font-display text-lg font-medium mb-2 tracking-tight">{title}</h4>
      <p className="text-sm text-slate-400 leading-relaxed">{desc}</p>
    </div>
  );
}
