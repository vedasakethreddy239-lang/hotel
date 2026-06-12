import { Link } from "react-router-dom";
import {
  ShieldCheck, ArrowRight, BookOpen, Network, Gauge, FlaskConical,
  Radar, FolderSearch, FileText, AlertTriangle, Layers, TrendingDown,
} from "lucide-react";

const FEATURES = [
  { icon: Gauge, title: "Explainable Risk Scoring", text: "Additive signal-weight engine (0–100) with per-signal explanations mapped to ecosystem tiers." },
  { icon: Network, title: "Graph Analytics", text: "Force-directed entity graph revealing shared devices, IPs, guests and coordinated property clusters." },
  { icon: FlaskConical, title: "Simulation Lab", text: "Test normal vs. fraud scenarios against the exact scoring function used in production detection." },
  { icon: Radar, title: "Threat Intelligence", text: "Synthetic intel feed connecting external fraud trends to the signals that drive account risk." },
  { icon: FolderSearch, title: "Case Management", text: "Full analyst workflow: triage, investigate, escalate, confirm fraud or mark false positive." },
  { icon: FileText, title: "PDF Reporting", text: "Investigation summaries, weekly intelligence and executive reports generated on demand." },
];

const TIERS = [
  { n: 1, name: "Credential Compromise Specialist", desc: "Obtains account access at scale" },
  { n: 2, name: "Account Valuation Intermediary", desc: "Grades balances, tiers & resale value" },
  { n: 3, name: "Reseller / Redemption Coordinator", desc: "Converts points into bookings" },
  { n: 4, name: "End Customer", desc: "Consumes discounted fraudulent stays" },
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-bg text-txt-1">
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: "url(https://images.unsplash.com/photo-1644088379091-d574269d422f?crop=entropy&cs=srgb&fm=jpg&q=85&w=1920)" }}
        />
        <div className="absolute inset-0 bg-[#090D14]/90" />
        <div className="relative max-w-6xl mx-auto px-6 pt-8 pb-24">
          <nav className="flex items-center justify-between mb-20">
            <div className="flex items-center gap-2.5">
              <span className="grid place-items-center w-9 h-9 rounded-md bg-gradient-to-br from-blue-500 to-violet-600">
                <ShieldCheck size={20} strokeWidth={1.5} className="text-white" />
              </span>
              <span className="font-heading font-semibold text-lg tracking-tight text-white">
                LoyaltyShield <span className="text-blue-400">AI</span>
              </span>
            </div>
            <Link to="/dashboard" className="btn-ghost !border-gray-700 !text-gray-200" data-testid="nav-open-demo">
              Open Demo <ArrowRight size={15} strokeWidth={1.5} />
            </Link>
          </nav>

          <div className="max-w-3xl fade-up">
            <span className="meta-label inline-flex items-center gap-2 border border-blue-500/30 bg-blue-500/10 !text-blue-300 rounded-full px-3 py-1 mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
              Defensive research prototype · Synthetic data only
            </span>
            <h1 className="font-heading text-4xl sm:text-5xl lg:text-6xl font-semibold tracking-tight text-white leading-[1.08]">
              Adaptive Threat Intelligence for{" "}
              <span className="bg-gradient-to-r from-blue-400 to-violet-400 bg-clip-text text-transparent">
                Hotel Loyalty Fraud
              </span>
            </h1>
            <p className="text-base md:text-lg text-gray-400 mt-6 max-w-2xl leading-relaxed">
              Model hotel loyalty fraud as a cyber-economic ecosystem, not isolated account takeover events.
            </p>
            <div className="flex flex-wrap gap-3 mt-9">
              <Link to="/dashboard" className="btn-primary !px-6 !py-3" data-testid="hero-open-dashboard">
                Open Demo Dashboard <ArrowRight size={16} strokeWidth={1.5} />
              </Link>
              <Link to="/research" className="btn-ghost !px-6 !py-3 !border-gray-700 !text-gray-200" data-testid="hero-view-research">
                <BookOpen size={16} strokeWidth={1.5} /> View Research Framework
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Problem */}
      <section className="max-w-6xl mx-auto px-6 py-20">
        <p className="meta-label mb-3">The problem</p>
        <h2 className="font-heading text-2xl md:text-3xl font-medium tracking-tight max-w-2xl">
          Loyalty points are currency — and defenders treat theft as isolated incidents.
        </h2>
        <div className="grid md:grid-cols-3 gap-5 mt-10">
          {[
            { icon: AlertTriangle, t: "Account takeover chains", d: "Credential stuffing, profile lockout changes and rapid redemptions unfold faster than manual review cycles." },
            { icon: Layers, t: "Coordinated, multi-account fraud", d: "Shared devices, guest names and destination clusters span accounts that look unrelated in row-level views." },
            { icon: TrendingDown, t: "Siloed detection", d: "Point-in-time alerts miss the economic pipeline moving stolen balances from compromise to consumption." },
          ].map(({ icon: Icon, t, d }) => (
            <div key={t} className="card card-hover p-6">
              <Icon size={22} strokeWidth={1.5} className="text-red-400 mb-4" />
              <h3 className="text-lg font-medium tracking-tight mb-2">{t}</h3>
              <p className="text-sm text-txt-2 leading-relaxed">{d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Solution */}
      <section className="border-y border-line bg-surface/50">
        <div className="max-w-6xl mx-auto px-6 py-20">
          <p className="meta-label mb-3">The solution</p>
          <h2 className="font-heading text-2xl md:text-3xl font-medium tracking-tight max-w-2xl">
            A four-tier cyber-economic ecosystem model, wired into live detection.
          </h2>
          <p className="text-sm md:text-base text-txt-2 mt-4 max-w-2xl leading-relaxed">
            Every risk signal in LoyaltyShield AI maps to an actor tier from the research framework — so an
            analyst sees not just <em>what</em> happened, but <em>who in the fraud economy</em> it implies.
          </p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-10">
            {TIERS.map((t) => (
              <div key={t.n} className="card card-hover p-5">
                <span className="font-mono text-xs text-violet-400">TIER {t.n}</span>
                <h3 className="font-medium tracking-tight mt-2 mb-1.5">{t.name}</h3>
                <p className="text-xs text-txt-3 leading-relaxed">{t.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-6xl mx-auto px-6 py-20">
        <p className="meta-label mb-3">Capabilities</p>
        <h2 className="font-heading text-2xl md:text-3xl font-medium tracking-tight">Built for the analyst workflow</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 mt-10">
          {FEATURES.map(({ icon: Icon, title, text }) => (
            <div key={title} className="card card-hover p-6" data-testid={`feature-card-${title.toLowerCase().replace(/ /g, "-")}`}>
              <span className="grid place-items-center w-10 h-10 rounded-md bg-blue-500/10 text-blue-400 mb-4">
                <Icon size={20} strokeWidth={1.5} />
              </span>
              <h3 className="text-lg font-medium tracking-tight mb-2">{title}</h3>
              <p className="text-sm text-txt-2 leading-relaxed">{text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Ethics */}
      <section className="max-w-6xl mx-auto px-6 pb-20">
        <div className="card p-8 border-amber-500/30 bg-amber-500/5" data-testid="ethics-disclaimer">
          <h3 className="font-heading text-lg font-medium tracking-tight mb-3 flex items-center gap-2">
            <ShieldCheck size={18} strokeWidth={1.5} className="text-amber-400" /> Ethics Disclaimer
          </h3>
          <p className="text-sm text-txt-2 leading-relaxed">
            LoyaltyShield AI is a defensive cybersecurity research prototype using synthetic data only. It is
            intended to help analysts understand and mitigate hotel loyalty account takeover and reward
            redemption fraud. It must not be used to access, trade, test, or process real compromised accounts.
          </p>
        </div>
      </section>

      <footer className="border-t border-line">
        <div className="max-w-6xl mx-auto px-6 py-8 flex flex-wrap items-center justify-between gap-3 text-xs text-txt-3">
          <span>LoyaltyShield AI · Research companion demo · v1.0.0</span>
          <span className="font-mono">100% synthetic data · fixed seed 42</span>
        </div>
      </footer>
    </div>
  );
}
