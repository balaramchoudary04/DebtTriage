import { Link, useLocation } from "wouter";
import { useState, useEffect } from "react";
import {
  LayoutDashboard,
  CreditCard,
  TrendingDown,
  ArrowLeftRight,
  Gauge,
  FileText,
  Sun,
  Moon,
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const navItems = [
  { href: "/", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/debts", icon: CreditCard, label: "My Debts" },
  { href: "/payoff", icon: TrendingDown, label: "Payoff Plans" },
  { href: "/transfer", icon: ArrowLeftRight, label: "Transfer & Consolidation" },
  { href: "/score", icon: Gauge, label: "Score Simulator" },
  { href: "/letters", icon: FileText, label: "Letter Generator" },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const [dark, setDark] = useState(() =>
    typeof window !== "undefined"
      ? window.matchMedia("(prefers-color-scheme: dark)").matches
      : false
  );
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);

  useEffect(() => {
    setMobileOpen(false);
  }, [location]);

  return (
    <div className="flex h-screen overflow-hidden bg-background" data-testid="app-layout">
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed md:relative z-50 h-full flex flex-col
          bg-sidebar border-r border-sidebar-border
          transition-all duration-200 ease-out
          ${collapsed ? "w-16" : "w-56"}
          ${mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}
        `}
        data-testid="sidebar"
      >
        {/* Logo */}
        <div className={`flex items-center gap-3 px-4 h-14 border-b border-sidebar-border shrink-0 ${collapsed ? "justify-center" : ""}`}>
          <svg width="28" height="28" viewBox="0 0 32 32" fill="none" aria-label="DebtTriage">
            <rect x="2" y="2" width="28" height="28" rx="6" stroke="currentColor" strokeWidth="2" className="text-primary" />
            <path d="M9 22V10h4c3.3 0 6 2.7 6 6s-2.7 6-6 6H9z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" className="text-primary" />
            <path d="M20 12l3 3-3 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground" />
          </svg>
          {!collapsed && (
            <span className="font-semibold text-sm tracking-tight">DebtTriage</span>
          )}
        </div>

        {/* Nav links */}
        <nav className="flex-1 py-3 px-2 space-y-0.5 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
            return (
              <Link key={item.href} href={item.href}>
                <div
                  className={`
                    flex items-center gap-3 px-3 py-2 rounded-md text-sm cursor-pointer
                    transition-colors duration-150
                    ${isActive
                      ? "bg-primary/10 text-primary font-medium"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                    }
                    ${collapsed ? "justify-center px-2" : ""}
                  `}
                  data-testid={`nav-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
                >
                  <item.icon className="w-4 h-4 shrink-0" />
                  {!collapsed && <span>{item.label}</span>}
                </div>
              </Link>
            );
          })}
        </nav>

        {/* Bottom controls */}
        <div className="border-t border-sidebar-border p-2 space-y-1 shrink-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setDark(!dark)}
            className={`w-full ${collapsed ? "justify-center px-2" : "justify-start"}`}
            data-testid="theme-toggle"
          >
            {dark ? <Sun className="w-4 h-4 shrink-0" /> : <Moon className="w-4 h-4 shrink-0" />}
            {!collapsed && <span className="ml-2 text-xs">{dark ? "Light Mode" : "Dark Mode"}</span>}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCollapsed(!collapsed)}
            className={`w-full hidden md:flex ${collapsed ? "justify-center px-2" : "justify-start"}`}
            data-testid="collapse-toggle"
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            {!collapsed && <span className="ml-2 text-xs">Collapse</span>}
          </Button>
        </div>

        {/* Mobile close */}
        <Button
          variant="ghost"
          size="icon"
          className="absolute top-3 right-2 md:hidden"
          onClick={() => setMobileOpen(false)}
        >
          <X className="w-4 h-4" />
        </Button>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Top bar (mobile) */}
        <header className="md:hidden flex items-center gap-3 px-4 h-14 border-b border-border shrink-0">
          <Button variant="ghost" size="icon" onClick={() => setMobileOpen(true)} data-testid="mobile-menu">
            <Menu className="w-5 h-5" />
          </Button>
          <span className="font-semibold text-sm">DebtTriage</span>
        </header>

        <main className="flex-1 overflow-y-auto" data-testid="main-content">
          <div className="p-4 md:p-6 lg:p-8 max-w-[1400px] mx-auto">
            {children}
          </div>
          <footer className="px-6 py-4 border-t border-border mt-8">
          </footer>
        </main>
      </div>
    </div>
  );
}
