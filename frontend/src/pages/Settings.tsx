import { Moon, Sun, ShieldCheck, RotateCcw } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useTheme } from "../App";
import { cn } from "../lib/utils";
import { api } from "../lib/api";

export default function Settings() {
  const { theme, toggleTheme } = useTheme();
  const [resetting, setResetting] = useState(false);

  async function handleReset() {
    setResetting(true);
    try {
      await api.post("/admin/reset");
      toast.success("Database reset to seed-42 baseline");
    } catch {
      toast.error("Reset failed");
    } finally {
      setResetting(false);
    }
  }

  return (
    <div className="space-y-5 max-w-[760px]">
      <div className="card p-6" data-testid="settings-profile-card">
        <h3 className="text-lg font-medium tracking-tight mb-5">Analyst profile</h3>
        <div className="flex items-center gap-4">
          <div className="grid place-items-center w-14 h-14 rounded-full bg-violet-500/15 text-violet-400 text-lg font-semibold">
            AC
          </div>
          <div>
            <div className="font-medium">Avery Chen</div>
            <div className="text-sm text-txt-2">Senior Fraud Analyst · Loyalty Security Operations</div>
            <div className="font-mono text-xs text-txt-3 mt-1">analyst.demo@loyaltyshield.example</div>
          </div>
        </div>
      </div>

      <div className="card p-6" data-testid="settings-theme-card">
        <h3 className="text-lg font-medium tracking-tight mb-1">Appearance</h3>
        <p className="text-sm text-txt-2 mb-4">Dark mode is the default for SOC environments.</p>
        <div className="flex items-center justify-between gap-3 border border-line rounded-md px-4 py-3">
          <div className="flex items-center gap-3">
            {theme === "dark" ? <Moon size={18} strokeWidth={1.5} className="text-violet-400" /> : <Sun size={18} strokeWidth={1.5} className="text-amber-400" />}
            <span className="text-sm font-medium capitalize">{theme} theme</span>
          </div>
          <button
            data-testid="settings-theme-toggle"
            onClick={toggleTheme}
            role="switch"
            aria-checked={theme === "dark"}
            className={cn(
              "relative w-11 h-6 rounded-full transition-colors duration-200",
              theme === "dark" ? "bg-gradient-to-r from-blue-500 to-violet-500" : "bg-line"
            )}
          >
            <span
              className={cn(
                "absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform duration-200",
                theme === "dark" && "translate-x-5"
              )}
            />
          </button>
        </div>
      </div>

      <div className="card p-6" data-testid="settings-reset-card">
        <h3 className="text-lg font-medium tracking-tight mb-1">Demo data</h3>
        <p className="text-sm text-txt-2 mb-4">
          On-demand accounts/cases generated during this session can be cleared by
          restoring the seed-42 baseline (100 accounts, 1000 events, 30 cases, 25 intel notes, 10 graph clusters).
        </p>
        <button
          data-testid="settings-reset-button"
          onClick={handleReset}
          disabled={resetting}
          className="inline-flex items-center gap-2 rounded-md border border-line px-4 py-2 text-sm font-medium hover:bg-white/5 transition-colors disabled:opacity-50"
        >
          <RotateCcw size={16} strokeWidth={1.5} className={resetting ? "animate-spin" : ""} />
          {resetting ? "Resetting..." : "Reset to seed data"}
        </button>
      </div>

      <div className="card p-6" data-testid="settings-about-card">
        <h3 className="text-lg font-medium tracking-tight mb-4">About</h3>
        <dl className="space-y-2.5 text-sm">
          <div className="flex justify-between"><dt className="text-txt-3">Product</dt><dd>LoyaltyShield AI</dd></div>
          <div className="flex justify-between"><dt className="text-txt-3">Version</dt><dd className="font-mono">1.0.0</dd></div>
          <div className="flex justify-between"><dt className="text-txt-3">Data</dt><dd>100% synthetic · fixed seed 42</dd></div>
          <div className="flex justify-between"><dt className="text-txt-3">Purpose</dt><dd>Defensive research companion demo</dd></div>
        </dl>
        <div className="mt-5 rounded-md border border-amber-500/30 bg-amber-500/5 p-4 flex gap-3">
          <ShieldCheck size={18} strokeWidth={1.5} className="text-amber-400 shrink-0 mt-0.5" />
          <p className="text-xs text-txt-2 leading-relaxed">
            LoyaltyShield AI is a defensive cybersecurity research prototype using synthetic data only. It is
            intended to help analysts understand and mitigate hotel loyalty account takeover and reward
            redemption fraud. It must not be used to access, trade, test, or process real compromised accounts.
          </p>
        </div>
      </div>
    </div>
  );
}
