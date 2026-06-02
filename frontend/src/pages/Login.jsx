import React, { useState, useEffect } from "react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { formatApiErrorDetail } from "../lib/api";
import { toast } from "sonner";
import { TrendingDown, Mail, Lock, User, ArrowRight } from "lucide-react";

export default function Login() {
  const [params] = useSearchParams();
  const [mode, setMode] = useState(params.get("mode") === "signup" ? "signup" : "signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const { login, register, user, exchangeSession } = useAuth();
  const navigate = useNavigate();

  const redirectUrl = window.location.origin + "/login";

  useEffect(() => {
    const code = params.get("code");
    if (code) {
      setSubmitting(true);
      exchangeSession(code, redirectUrl)
        .then(() => {
          toast.success("Welcome back!");
          navigate("/dashboard", { replace: true });
        })
        .catch((err) => {
          setError(formatApiErrorDetail(err.response?.data?.detail) || "Google sign-in failed.");
          toast.error("Google sign-in failed. Please try again.");
        })
        .finally(() => {
          setSubmitting(false);
        });
      return;
    }
    if (user) navigate("/dashboard", { replace: true });
  }, [user, navigate, params, redirectUrl, exchangeSession]);

  const onSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      if (mode === "signup") {
        await register(email, password, name);
        toast.success("Welcome to DebtWise!");
      } else {
        await login(email, password);
        toast.success("Welcome back.");
      }
      navigate("/dashboard");
    } catch (e) {
      setError(formatApiErrorDetail(e.response?.data?.detail) || e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const onGoogleSignin = () => {
    const clientId = process.env.REACT_APP_GOOGLE_CLIENT_ID;
    if (!clientId) {
      toast.error("Google OAuth Client ID is not configured on the frontend. Add REACT_APP_GOOGLE_CLIENT_ID to your frontend environment.");
      return;
    }
    const target = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUrl)}&response_type=code&scope=openid%20email%20profile`;
    window.location.href = target;
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-6 py-12 relative">
      <div
        className="absolute inset-0 opacity-25 pointer-events-none"
        style={{
          backgroundImage:
            "url('https://static.prod-images.emergentagent.com/jobs/ca258668-a191-4712-a4d0-8134cc42fff5/images/a3a48efcf2271471d3aeb2e840a5d7bb9e0bf2264db7d11ed4d8b8811fadebdd.png')",
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-slate-950/60 via-slate-950/80 to-slate-950 pointer-events-none" />

      <div className="relative z-10 w-full max-w-md">
        <Link to="/" className="flex items-center gap-3 justify-center mb-10" data-testid="back-home">
          <div className="w-9 h-9 rounded-xl glass glow-blue flex items-center justify-center">
            <TrendingDown className="w-5 h-5 text-blue-400" />
          </div>
          <span className="font-display text-xl tracking-tight">DebtWise</span>
        </Link>

        <div className="glass rounded-2xl p-8 animate-fade-up" data-testid="auth-card">
          <h1 className="font-display text-3xl font-light tracking-tight mb-2">
            {mode === "signup" ? "Create your account" : "Welcome back"}
          </h1>
          <p className="text-sm text-slate-400 mb-8">
            {mode === "signup"
              ? "Build your personalized payoff plan in minutes."
              : "Sign in to continue your debt-free journey."}
          </p>

          <button
            type="button"
            onClick={onGoogleSignin}
            className="w-full mb-5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg py-3 font-medium transition-colors backdrop-blur-md flex items-center justify-center gap-3 text-sm"
            data-testid="google-signin-btn"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18a11 11 0 0 0 0 9.86l3.66-2.84z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Continue with Google
          </button>

          <div className="flex items-center gap-4 my-6">
            <div className="flex-1 h-px bg-white/10" />
            <span className="text-xs text-slate-500 tracking-widest">OR</span>
            <div className="flex-1 h-px bg-white/10" />
          </div>

          <form onSubmit={onSubmit} className="space-y-4">
            {mode === "signup" && (
              <Field
                icon={<User className="w-4 h-4" />}
                type="text"
                value={name}
                onChange={(v) => setName(v)}
                placeholder="Full name"
                testid="name-input"
                required
              />
            )}
            <Field
              icon={<Mail className="w-4 h-4" />}
              type="email"
              value={email}
              onChange={setEmail}
              placeholder="you@example.com"
              testid="email-input"
              required
            />
            <Field
              icon={<Lock className="w-4 h-4" />}
              type="password"
              value={password}
              onChange={setPassword}
              placeholder="Password"
              testid="password-input"
              required
            />

            {error && (
              <div
                className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2"
                data-testid="auth-error"
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-60 disabled:cursor-not-allowed text-white rounded-lg py-3 font-medium transition-all shadow-[0_0_30px_rgba(37,99,235,0.4)] flex items-center justify-center gap-2"
              data-testid="auth-submit-btn"
            >
              {submitting ? "Please wait…" : mode === "signup" ? "Create account" : "Sign in"}
              {!submitting && <ArrowRight className="w-4 h-4" />}
            </button>
          </form>

          <p className="text-center text-sm text-slate-400 mt-6">
            {mode === "signup" ? "Already have an account?" : "New to DebtWise?"}{" "}
            <button
              onClick={() => setMode(mode === "signup" ? "signin" : "signup")}
              className="text-blue-400 hover:text-blue-300 font-medium"
              data-testid="toggle-mode-btn"
            >
              {mode === "signup" ? "Sign in" : "Create an account"}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}

function Field({ icon, type, value, onChange, placeholder, required, testid }) {
  return (
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">{icon}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        data-testid={testid}
        className="w-full bg-white/5 border border-white/10 rounded-lg pl-10 pr-3 py-3 text-sm placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:border-blue-500 transition-colors"
      />
    </div>
  );
}
