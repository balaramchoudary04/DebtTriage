import React from "react";
import { Toaster } from "sonner";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Debts from "./pages/Debts";
import Strategies from "./pages/Strategies";
import StrategyDetail from "./pages/StrategyDetail";
import Simulator from "./pages/Simulator";
import Settings from "./pages/Settings";
import StrategyCustom from "./pages/StrategyCustom";
import AuthCallback from "./pages/AuthCallback";
import AppLayout from "./components/AppLayout";

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" data-testid="auth-loading">
        <div className="text-slate-400 text-sm tracking-widest uppercase">Loading…</div>
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function AppRouter() {
  const location = useLocation();
  if (location.hash?.includes("session_id=")) {
    return <AuthCallback />;
  }
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/debts" element={<Debts />} />
        <Route path="/strategies" element={<Strategies />} />
        <Route path="/strategies/custom" element={<StrategyCustom />} />
        <Route path="/strategies/:strategy" element={<StrategyDetail />} />
        <Route path="/simulator" element={<Simulator />} />
        <Route path="/settings" element={<Settings />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRouter />
        <Toaster
          theme="dark"
          position="top-right"
          toastOptions={{
            style: {
              background: "rgba(15, 23, 42, 0.85)",
              backdropFilter: "blur(20px)",
              border: "1px solid rgba(255,255,255,0.1)",
              color: "#f8fafc",
            },
          }}
        />
      </BrowserRouter>
    </AuthProvider>
  );
}
