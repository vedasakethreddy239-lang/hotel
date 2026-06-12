import { createContext, useContext, useEffect, useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { Toaster } from "sonner";
import Layout from "./components/Layout";
import Landing from "./pages/Landing";
import Dashboard from "./pages/Dashboard";
import Accounts from "./pages/Accounts";
import AccountDetail from "./pages/AccountDetail";
import GraphAnalytics from "./pages/GraphAnalytics";
import ThreatIntel from "./pages/ThreatIntel";
import Cases from "./pages/Cases";
import CaseDetail from "./pages/CaseDetail";
import SimulationLab from "./pages/SimulationLab";
import ResearchFramework from "./pages/ResearchFramework";
import Reports from "./pages/Reports";
import Settings from "./pages/Settings";

type ThemeCtx = { theme: "dark" | "light"; toggleTheme: () => void };
const ThemeContext = createContext<ThemeCtx>({ theme: "dark", toggleTheme: () => {} });
export const useTheme = () => useContext(ThemeContext);

export default function App() {
  const [theme, setTheme] = useState<"dark" | "light">(
    () => (localStorage.getItem("ls-theme") as "dark" | "light") || "dark"
  );

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    localStorage.setItem("ls-theme", theme);
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme: () => setTheme((t) => (t === "dark" ? "light" : "dark")) }}>
      <Toaster theme={theme} position="top-right" richColors />
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route element={<Layout />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/accounts" element={<Accounts />} />
          <Route path="/accounts/:accountId" element={<AccountDetail />} />
          <Route path="/graph" element={<GraphAnalytics />} />
          <Route path="/threat-intel" element={<ThreatIntel />} />
          <Route path="/cases" element={<Cases />} />
          <Route path="/cases/:caseId" element={<CaseDetail />} />
          <Route path="/simulation" element={<SimulationLab />} />
          <Route path="/research" element={<ResearchFramework />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/settings" element={<Settings />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </ThemeContext.Provider>
  );
}
