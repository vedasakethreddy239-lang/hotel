# LoyaltyShield AI

**Adaptive Threat Intelligence for Hotel Loyalty Fraud**

LoyaltyShield AI is a defensive cybersecurity and fraud-intelligence platform for hotel loyalty programs. It helps analysts detect and investigate hotel loyalty **account takeover (ATO)** and **reward redemption fraud** using **synthetic data only**. It is a companion demo for a research paper proposing a **four-tier cyber-economic ecosystem model** of hotel loyalty fraud.

---

## Problem Statement

Hotel loyalty points are a parallel currency. Attackers do not steal points as isolated events — they operate a division-of-labour economy:

- Credential stuffing and ATO chains unfold faster than manual review cycles.
- Coordinated multi-account fraud (shared devices, guest names, destination clusters) is invisible in row-level views.
- Point-in-time alerting misses the **economic pipeline** that moves stolen balances from compromise to consumption.

## Research Motivation

The platform operationalizes a four-tier ecosystem model:

| Tier | Actor class | Economic incentive | Detection signal (engine weight) |
|------|-------------|--------------------|----------------------------------|
| 1 | Credential compromise specialist | Sells validated access at scale | New device (+15), Password change (+20), Email change (+15), Phone change (+15) |
| 2 | Account valuation intermediary | Grades balances/tier/dormancy for resale | Dormant balance check (+20) |
| 3 | Reseller / redemption coordinator | Converts points into discounted bookings | Guest booking (+15), Same property cluster (+25), Redemption within 48h of profile change (+20) |
| 4 | End customer | Consumes discounted fraudulent stays | High-value redemption (+20) |

Protective signals: Trusted device (−10), Long clean history (−10).
**Risk Score = clamp(Σ triggered weights, 0, 100)** — tiers: 0–39 Low, 40–69 Medium, 70–100 High.
A **single shared scoring function** (`backend/risk.py`) powers `/api/risk/score`, the Simulation Lab, Account Detail explanations, and seed data generation.

## Architecture

```
┌─────────────────────────────┐        ┌──────────────────────────────┐
│ Frontend (React + TS + Vite)│  HTTP  │ Backend (FastAPI + Uvicorn)  │
│ Tailwind · Recharts ·       │ ─────► │ SQLAlchemy ORM · Pydantic    │
│ react-force-graph-2d        │  /api  │ ReportLab (PDF)              │
└─────────────────────────────┘        └──────────────┬───────────────┘
                                                      │
                                              ┌───────▼────────┐
                                              │ SQLite (file)  │
                                              │ seeded, seed=42│
                                              └────────────────┘
```

- `backend/risk.py` — shared risk scoring engine (signal weights + ecosystem tier mapping)
- `backend/seed.py` — deterministic synthetic data generator (seed = 42)
- `backend/main.py` — all API endpoints (prefixed `/api`)
- `frontend/src/pages/` — Landing, Dashboard, Accounts, Account Detail, Graph Analytics, Threat Intelligence, Cases, Simulation Lab, Research Framework, Reports, Settings

## Features

- **Dashboard** — KPIs, risk distribution, suspicious events over time (ISO 8601 UTC), cases by severity, event type frequency
- **Accounts** — paginated (20/page), sortable, searchable table with risk badges
- **Account Detail** — profile, circular risk gauge, event timeline, per-signal risk explanation mapped to ecosystem tiers, related cases, Create Case (pre-filled), Mark Reviewed, Export PDF
- **Graph Analytics** — force-directed entity graph (accounts, devices, IPs, guests, properties, dates) with 10 highlighted suspicious clusters
- **Threat Intelligence** — analyst-console card feed with severity, related signals and tier mapping; publish new notes
- **Cases** — paginated/sortable case management with full status workflow (New → … → Confirmed Fraud / False Positive / Closed)
- **Simulation Lab** — build normal vs. fraud scenarios; scored by the same backend function
- **Research Framework** — the four-tier model wired to live engine weights
- **Reports** — ReportLab PDFs: investigation summary, weekly intelligence, executive dashboard, per-account risk report
- **Settings** — analyst profile, dark/light theme toggle (dark default), about/version

## Screenshots

> _Screenshots placeholder — add captures of Dashboard, Graph Analytics, Account Detail and Simulation Lab here._

## Setup Instructions

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
python seed.py                  # create + seed SQLite DB (fixed seed 42)
uvicorn main:app --reload --port 8000
```

Environment (`backend/.env`):

```
DATABASE_URL="sqlite:///./loyaltyshield.db"
CORS_ORIGINS="*"
```

### Frontend

```bash
cd frontend
npm install                     # or: yarn install
npm run dev                     # Vite dev server on http://localhost:5173
```

Environment (`frontend/.env`):

```
VITE_API_URL=http://localhost:8000
```

> **Port note:** locally the backend runs on **8000** and the frontend on **5173** (Vite default). In the hosted preview environment the backend binds to **8001** and the frontend is served on **3000** via the `start` script — same code, only ports/env differ.

### Docker

```bash
docker-compose up --build
# frontend: http://localhost:5173 · backend: http://localhost:8000
```

## API Documentation

Interactive docs: `http://localhost:8000/docs`

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/accounts?page=&page_size=&sort_by=&order=&search=&risk_status=` | Paginated, sortable accounts |
| GET | `/api/accounts/{account_id}` | Account + risk explanation + related cases |
| POST | `/api/accounts/generate` | Generate one synthetic account |
| GET | `/api/accounts/{account_id}/events` | Account event timeline |
| POST | `/api/accounts/{account_id}/review` | Mark account reviewed |
| GET | `/api/risk/signals` | Signal weights, tiers, thresholds |
| POST | `/api/risk/score` | Score raw signal flags (shared engine) |
| POST | `/api/simulation/run` | Score a full scenario + synthesized timeline |
| GET | `/api/graph/clusters` | Nodes, edges and cluster metadata |
| GET | `/api/cases?page=&page_size=&sort_by=&order=&status=&account_id=` | Paginated, sortable cases |
| POST | `/api/cases` | Create case |
| GET | `/api/cases/{case_id}` | Case + linked account + linked events |
| PATCH | `/api/cases/{case_id}` | Update status/notes/etc. |
| GET | `/api/threat-intel` | Intelligence feed |
| POST | `/api/threat-intel` | Publish intel note |
| GET | `/api/reports/summary?report_type=investigation\|weekly\|executive` | Summary PDF |
| GET | `/api/reports/account/{account_id}` | Account risk PDF |
| GET | `/api/dashboard/stats` | Dashboard aggregates |

## Synthetic Data

Generated by `backend/seed.py` with `random.Random(42)`:
**100 accounts · 1000 events · 30 cases · 25 threat intel notes · 10 suspicious clusters.**
All timestamps are ISO 8601 UTC. All risk scores are computed via the shared scoring function.

## Ethics Disclaimer

> LoyaltyShield AI is a defensive cybersecurity research prototype using synthetic data only. It is intended to help analysts understand and mitigate hotel loyalty account takeover and reward redemption fraud. It must not be used to access, trade, test, or process real compromised accounts.

No real hotel customer data is included. The project contains no hacking, scraping, dark-web access or offensive instructions.

## Future Roadmap

- Streaming event ingestion + real-time score recalculation
- ML-based anomaly scoring layered on the rule engine (with explainability parity)
- Cross-program federation: share cluster indicators between hotel chains
- Analyst feedback loop: tune signal weights from confirmed fraud / false positive labels
- SSO + RBAC for multi-analyst deployments
- Webhook/SIEM export of high-severity events
