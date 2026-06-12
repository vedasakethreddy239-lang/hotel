import { useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import {
  LayoutDashboard, Users, Share2, Radar, FolderSearch, FlaskConical,
  BookOpen, FileText, Settings as SettingsIcon, ShieldCheck,
  PanelLeftClose, PanelLeftOpen, Sun, Moon,
} from "lucide-react";
import { cn } from "../lib/utils";
import { useTheme } from "../App";

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/accounts", label: "Accounts", icon: Users },
  { to: "/graph", label: "Graph Analytics", icon: Share2 },
  { to: "/threat-intel", label: "Threat Intelligence", icon: Radar },
  { to: "/cases", label: "Cases", icon: FolderSearch },
  { to: "/simulation", label: "Simulation Lab", icon: FlaskConical },
  { to: "/research", label: "Research Framework", icon: BookOpen },
  { to: "/reports", label: "Reports", icon: FileText },
  { to: "/settings", label: "Settings", icon: SettingsIcon },
];

export default function Layout() {
  const [collapsed, setCollapsed] = useState(false);
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();
  const current = NAV.find((n) => location.pathname.startsWith(n.to));

  return (
    <div className="flex h-screen overflow-hidden">
      <aside
        data-testid="sidebar"
        className={cn(
          "flex flex-col border-r border-line bg-surface transition-[width] duration-200 shrink-0",
          collapsed ? "w-16" : "w-60"
        )}
      >
        <NavLink to="/" className="flex items-center gap-2.5 px-4 h-16 border-b border-line" data-testid="sidebar-logo">
          <span className="grid place-items-center w-8 h-8 rounded-md bg-gradient-to-br from-blue-500 to-violet-600 shrink-0">
            <ShieldCheck size={18} strokeWidth={1.5} className="text-white" />
          </span>
          {!collapsed && (
            <span className="font-heading font-semibold tracking-tight text-txt-1">
              LoyaltyShield <span className="text-accent">AI</span>
            </span>
          )}
        </NavLink>

        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
          {NAV.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              data-testid={`nav-${label.toLowerCase().replace(/ /g, "-")}`}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors duration-150",
                  isActive
                    ? "bg-accent/10 text-accent border-l-2 border-accent"
                    : "text-txt-2 hover:bg-surface-2 hover:text-txt-1"
                )
              }
              title={label}
            >
              <Icon size={18} strokeWidth={1.5} className="shrink-0" />
              {!collapsed && <span>{label}</span>}
            </NavLink>
          ))}
        </nav>

        <div className="p-2 border-t border-line">
          <button
            data-testid="sidebar-toggle"
            onClick={() => setCollapsed((c) => !c)}
            className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-txt-2 hover:bg-surface-2 hover:text-txt-1 transition-colors duration-150"
          >
            {collapsed ? <PanelLeftOpen size={18} strokeWidth={1.5} /> : <PanelLeftClose size={18} strokeWidth={1.5} />}
            {!collapsed && <span>Collapse</span>}
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 shrink-0 flex items-center justify-between gap-4 px-6 border-b border-line backdrop-blur-md bg-bg/80 z-10">
          <div className="flex items-center gap-3 min-w-0">
            <h1 className="font-heading text-lg font-medium tracking-tight truncate" data-testid="page-title">
              {current?.label ?? "LoyaltyShield AI"}
            </h1>
            <span className="hidden sm:inline-flex meta-label border border-line rounded px-2 py-0.5">
              Synthetic data
            </span>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <button
              data-testid="header-theme-toggle"
              onClick={toggleTheme}
              className="grid place-items-center w-9 h-9 rounded-md border border-line text-txt-2 hover:text-txt-1 hover:bg-surface-2 transition-colors duration-150"
              title="Toggle theme"
            >
              {theme === "dark" ? <Sun size={16} strokeWidth={1.5} /> : <Moon size={16} strokeWidth={1.5} />}
            </button>
            <div className="flex items-center gap-2.5" data-testid="analyst-chip">
              <div className="grid place-items-center w-9 h-9 rounded-full bg-violet-500/15 text-violet-400 text-xs font-semibold">
                AC
              </div>
              <div className="hidden md:block leading-tight">
                <div className="text-sm font-medium">Avery Chen</div>
                <div className="text-xs text-txt-3">Senior Fraud Analyst</div>
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-6" data-testid="main-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
