import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, User, FolderSearch, Building2, MonitorSmartphone, Globe, Users, Radar } from "lucide-react";
import { api } from "../lib/api";
import { SearchResult } from "../lib/types";
import { cn } from "../lib/utils";

const TYPE_ICONS: Record<string, any> = {
  account: User, case: FolderSearch, property: Building2,
  device: MonitorSmartphone, ip: Globe, guest: Users, intel: Radar,
};

const TYPE_LABELS: Record<string, string> = {
  account: "Accounts", case: "Cases", property: "Properties",
  device: "Devices", ip: "IP Addresses", guest: "Guests", intel: "Threat Intel",
};

export const GlobalSearch = () => {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
      }
      if (e.key === "Escape") setOpen(false);
    };
    const onClick = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onClick);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onClick);
    };
  }, []);

  useEffect(() => {
    if (!q.trim()) { setResults([]); setOpen(false); return; }
    const t = setTimeout(() => {
      api.get("/search", { params: { q: q.trim() } }).then((r) => {
        setResults(r.data.results);
        setActive(0);
        setOpen(true);
      }).catch(() => setResults([]));
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  const go = (r: SearchResult) => {
    setOpen(false);
    setQ("");
    navigate(r.link);
  };

  const onInputKey = (e: React.KeyboardEvent) => {
    if (!open || results.length === 0) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, results.length - 1)); }
    if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
    if (e.key === "Enter" && results[active]) { e.preventDefault(); go(results[active]); }
  };

  let lastType = "";

  return (
    <div ref={boxRef} className="relative w-full max-w-md" data-testid="global-search">
      <div className="relative">
        <Search size={15} strokeWidth={1.5} className="absolute left-3 top-1/2 -translate-y-1/2 text-txt-3 pointer-events-none" />
        <input
          ref={inputRef}
          data-testid="global-search-input"
          className="input-base !pl-9 !pr-14 !py-1.5"
          placeholder="Search accounts, cases, properties, IPs…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => q.trim() && results.length > 0 && setOpen(true)}
          onKeyDown={onInputKey}
        />
        <kbd className="absolute right-2.5 top-1/2 -translate-y-1/2 font-mono text-[10px] text-txt-3 border border-line rounded px-1.5 py-0.5 pointer-events-none hidden sm:block">
          ⌘K
        </kbd>
      </div>

      {open && (
        <div
          className="absolute top-full mt-1.5 left-0 right-0 card max-h-[420px] overflow-y-auto z-50 py-1.5 shadow-xl"
          data-testid="global-search-results"
        >
          {results.length === 0 ? (
            <p className="text-sm text-txt-3 px-4 py-3" data-testid="search-no-results">No matches for “{q}”.</p>
          ) : (
            results.map((r, i) => {
              const Icon = TYPE_ICONS[r.type] ?? Search;
              const showHeader = r.type !== lastType;
              lastType = r.type;
              return (
                <div key={`${r.type}-${r.id}-${i}`}>
                  {showHeader && (
                    <div className="meta-label px-4 pt-2 pb-1">{TYPE_LABELS[r.type] ?? r.type}</div>
                  )}
                  <button
                    data-testid={`search-result-${r.type}-${i}`}
                    onMouseEnter={() => setActive(i)}
                    onClick={() => go(r)}
                    className={cn(
                      "flex items-center gap-3 w-full text-left px-4 py-2 transition-colors",
                      i === active ? "bg-accent/10" : "hover:bg-surface-2"
                    )}
                  >
                    <Icon size={15} strokeWidth={1.5} className="text-txt-3 shrink-0" />
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">{r.label}</div>
                      <div className="text-xs text-txt-3 truncate">{r.sub}</div>
                    </div>
                  </button>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};
