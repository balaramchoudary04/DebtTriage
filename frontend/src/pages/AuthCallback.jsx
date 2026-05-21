import React, { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { toast } from "sonner";

// REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
export default function AuthCallback() {
  const { exchangeSession } = useAuth();
  const navigate = useNavigate();
  const hasProcessed = useRef(false);

  useEffect(() => {
    if (hasProcessed.current) return;
    hasProcessed.current = true;

    const fragment = window.location.hash;
    const params = new URLSearchParams(fragment.replace(/^#/, ""));
    const sessionId = params.get("session_id");
    if (!sessionId) {
      navigate("/login");
      return;
    }

    exchangeSession(sessionId)
      .then(() => {
        // Clean URL & navigate to dashboard
        window.history.replaceState(null, "", "/dashboard");
        navigate("/dashboard", { replace: true });
      })
      .catch(() => {
        toast.error("Google sign-in failed. Please try again.");
        navigate("/login", { replace: true });
      });
  }, [exchangeSession, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center" data-testid="auth-callback">
      <div className="text-slate-400 text-sm tracking-[0.3em] uppercase animate-pulse">
        Signing you in…
      </div>
    </div>
  );
}
