import React from "react";
import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import {
  TrendingDown,
  LayoutDashboard,
  Wallet,
  GitCompare,
  Calculator,
  Settings as SettingsIcon,
  LogOut,
} from "lucide-react";
import { toast } from "sonner";

const navItems = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, testid: "nav-dashboard" },
  { to: "/debts", label: "My Debts", icon: Wallet, testid: "nav-debts" },
  { to: "/strategies", label: "Strategies", icon: GitCompare, testid: "nav-strategies" },
  { to: "/simulator", label: "Simulator", icon: Calculator, testid: "nav-simulator" },
  { to: "/settings", label: "Settings", icon: SettingsIcon, testid: "nav-settings" },
];

export default function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  React.useEffect(() => {
    const handleMouseMove = (e) => {
      const x = (e.clientX / window.innerWidth) * 100;
      const y = (e.clientY / window.innerHeight) * 100;
      document.documentElement.style.setProperty("--mouse-x", `${x}%`);
      document.documentElement.style.setProperty("--mouse-y", `${y}%`);
    };
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  const onLogout = async () => {
    await logout();
    toast.success("Signed out.");
    navigate("/", { replace: true });
  };

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <aside className="hidden lg:flex w-64 flex-col border-r border-white/5 p-6 sticky top-0 h-screen">
        <div className="flex items-center gap-3 mb-12">
          <div className="w-9 h-9 rounded-xl glass glow-blue flex items-center justify-center">
            <TrendingDown className="w-5 h-5 text-blue-400" />
          </div>
          <span className="font-display text-lg tracking-tight">DebtWise</span>
        </div>

        <nav className="flex flex-col gap-1 flex-1">
          {navItems.map(({ to, label, icon: Icon, testid }) => (
            <NavLink
              key={to}
              to={to}
              data-testid={testid}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${
                  isActive
                    ? "bg-blue-600/15 border border-blue-500/30 text-white"
                    : "text-slate-400 hover:bg-white/5 hover:text-white border border-transparent"
                }`
              }
            >
              <Icon className="w-4 h-4" />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="glass-subtle rounded-xl p-4 mt-6" data-testid="user-card">
          <div className="flex items-center gap-3">
            {user?.picture ? (
              <img src={user.picture} alt="" className="w-9 h-9 rounded-full" />
            ) : (
              <div className="w-9 h-9 rounded-full bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-sm font-medium text-blue-300">
                {(user?.name || user?.email || "U").slice(0, 1).toUpperCase()}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium truncate">{user?.name || "User"}</p>
              <p className="text-xs text-slate-500 truncate">{user?.email}</p>
            </div>
          </div>
          <button
            onClick={onLogout}
            className="mt-3 w-full flex items-center justify-center gap-2 text-xs text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg py-2 transition-colors"
            data-testid="logout-btn"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sign out
          </button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="lg:hidden fixed top-0 inset-x-0 z-20 glass-strong border-b border-white/5">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg glass-subtle flex items-center justify-center">
              <TrendingDown className="w-4 h-4 text-blue-400" />
            </div>
            <span className="font-display tracking-tight">DebtWise</span>
          </div>
          <button
            onClick={onLogout}
            className="text-xs text-slate-400 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10"
            data-testid="mobile-logout-btn"
          >
            <LogOut className="w-3.5 h-3.5" /> Exit
          </button>
        </div>
        <nav className="flex overflow-x-auto px-4 pb-3 gap-2">
          {navItems.map(({ to, label, icon: Icon, testid }) => (
            <NavLink
              key={to}
              to={to}
              data-testid={`mobile-${testid}`}
              className={({ isActive }) =>
                `flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs whitespace-nowrap ${
                  isActive
                    ? "bg-blue-600/15 border border-blue-500/30 text-white"
                    : "text-slate-400 bg-white/5 border border-white/10"
                }`
              }
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </NavLink>
          ))}
        </nav>
      </div>

      <main className="flex-1 min-w-0 pt-32 lg:pt-0">
        <div className="p-6 md:p-10 max-w-7xl mx-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
