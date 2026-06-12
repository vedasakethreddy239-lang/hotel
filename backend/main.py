"""LoyaltyShield AI — FastAPI backend.

Defensive cybersecurity research prototype. Synthetic data only.
All routes are prefixed with /api.
"""

import json
import logging
import os
import random
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import List, Optional

from dotenv import load_dotenv

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

from fastapi import APIRouter, Depends, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy import case as sa_case
from sqlalchemy import func
from sqlalchemy.orm import Session

import models
from auth import get_current_principal
from database import Base, SessionLocal, engine, get_db
from ingest import active_source
from reports_gen import build_account_pdf, build_summary_pdf
from risk import RECOMMENDED_ACTIONS, RISK_TIERS, SIGNALS, build_narrative, compute_risk, risk_status_for
from routes_analytics import router as analytics_router
from routes_ingest import router as ingest_router

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("loyaltyshield")

Base.metadata.create_all(bind=engine)

app = FastAPI(title="LoyaltyShield AI", version="1.0.0")
# All routes resolve a principal via the auth abstraction (see auth.py) so a
# real authentication layer (JWT/OAuth2/SSO) can be added without route changes.
api = APIRouter(prefix="/api", dependencies=[Depends(get_current_principal)])

VERSION = "1.0.0"
NOW_FMT = "%Y-%m-%dT%H:%M:%SZ"


def utcnow_iso():
    return datetime.now(timezone.utc).strftime(NOW_FMT)


# ---------------------------------------------------------------- schemas
class RiskScoreRequest(BaseModel):
    """Payload for POST /api/risk/score.

    NOTE: Flags are FLAT top-level booleans (not nested under a
    'flags' key), plus an optional 'days_between_change_and_booking'
    int. This matches SimulationRequest's flag shape below.
    """
    new_device: bool = False
    password_changed: bool = False
    email_changed: bool = False
    phone_changed: bool = False
    dormant_balance_check: bool = False
    guest_booking: bool = False
    high_value_redemption: bool = False
    same_property_cluster: bool = False
    trusted_device: bool = False
    long_clean_history: bool = False
    days_between_change_and_booking: Optional[int] = None


class SimulationRequest(BaseModel):
    account_age_days: int = Field(365, ge=0)
    points_balance: int = Field(50000, ge=0)
    loyalty_tier: str = "Silver"
    new_device: bool = False
    password_changed: bool = False
    email_changed: bool = False
    phone_changed: bool = False
    dormant_account: bool = False
    guest_booking: bool = False
    high_value_redemption: bool = False
    same_property_cluster: bool = False
    days_between_change_and_booking: Optional[int] = None


class CaseCreate(BaseModel):
    account_id: str
    severity: str = "Medium"
    summary: str = ""
    assigned_analyst: str = "Unassigned"
    analyst_notes: str = ""
    recommended_action: str = ""
    status: str = "New"


class CaseUpdate(BaseModel):
    status: Optional[str] = None
    severity: Optional[str] = None
    assigned_analyst: Optional[str] = None
    analyst_notes: Optional[str] = None
    recommended_action: Optional[str] = None
    summary: Optional[str] = None


class ThreatIntelCreate(BaseModel):
    title: str
    category: str
    severity: str = "Medium"
    summary: str = ""
    related_signals: List[str] = []
    ecosystem_tier: int = Field(1, ge=1, le=4)


SEVERITY_RANK = sa_case(
    {"Low": 0, "Medium": 1, "High": 2, "Critical": 3},
    value=models.Case.severity, else_=0,
)


# ---------------------------------------------------------------- health
@api.get("/")
def health():
    return {"service": "LoyaltyShield AI", "status": "ok", "version": VERSION}


# ---------------------------------------------------------------- accounts
@api.get("/accounts")
def list_accounts(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    sort_by: str = Query("risk_score"),
    order: str = Query("desc"),
    search: Optional[str] = None,
    risk_status: Optional[str] = None,
    db: Session = Depends(get_db),
):
    sortable = {
        "risk_score": models.Account.risk_score,
        "points_balance": models.Account.points_balance,
        "account_age_days": models.Account.account_age_days,
        "account_id": models.Account.account_id,
        "created_at": models.Account.created_at,
        "loyalty_tier": models.Account.loyalty_tier,
    }
    col = sortable.get(sort_by, models.Account.risk_score)
    q = db.query(models.Account).filter(models.Account.source == active_source(db))
    if search:
        q = q.filter(models.Account.account_id.ilike(f"%{search}%"))
    if risk_status:
        q = q.filter(models.Account.risk_status == risk_status)
    total = q.count()
    q = q.order_by(col.asc() if order == "asc" else col.desc())
    items = q.offset((page - 1) * page_size).limit(page_size).all()
    return {
        "items": [a.to_dict() for a in items],
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": max(1, -(-total // page_size)),
    }


@api.get("/accounts/{account_id}")
def get_account(account_id: str, db: Session = Depends(get_db)):
    acc = db.query(models.Account).filter(models.Account.account_id == account_id).first()
    if not acc:
        raise HTTPException(status_code=404, detail="Account not found")
    flags = json.loads(acc.signals or "{}")
    result = compute_risk(flags, acc.days_between_change_and_booking)
    cases = db.query(models.Case).filter(models.Case.account_id == account_id).all()
    acc_dict = acc.to_dict()
    return {
        **acc_dict,
        "risk_explanation": result,
        "narrative": build_narrative(acc_dict, result),
        "related_cases": [c.to_dict() for c in cases],
    }


@api.post("/accounts/generate")
def generate_account(db: Session = Depends(get_db)):
    """Generate one additional synthetic account on demand.

    Capped at 100 total accounts to keep the seed-42 demo dataset
    consistent. Use the 'Reset to seed data' option to clear any
    on-demand accounts created during a demo session.
    """
    total = db.query(func.count(models.Account.id)).filter(
        models.Account.source == "demo").scalar() or 0
    if total >= 100:
        raise HTTPException(
            status_code=409,
            detail="Demo account limit (100) reached. Reset to seed data to generate more.",
        )
    rng = random.Random()
    last = db.query(func.max(models.Account.id)).scalar() or 0
    age = rng.randint(30, 3000)
    fraud = rng.random() < 0.3
    flags = {k: False for k in SIGNALS}
    days_between = None
    if fraud:
        flags["new_device"] = True
        flags["password_changed"] = rng.random() < 0.8
        flags["guest_booking"] = True
        flags["high_value_redemption"] = rng.random() < 0.6
        flags["same_property_cluster"] = rng.random() < 0.4
        days_between = rng.randint(0, 2)
    else:
        flags["trusted_device"] = rng.random() < 0.7
        flags["long_clean_history"] = age >= 730
    result = compute_risk(flags, days_between)
    geos = [("United States", "North America"), ("Germany", "Europe"), ("Singapore", "Asia-Pacific"), ("UAE", "Middle East")]
    geo = rng.choice(geos)
    acc = models.Account(
        account_id=f"LTY-{10001 + last}",
        loyalty_tier=rng.choice(["Bronze", "Silver", "Gold", "Platinum"]),
        account_age_days=age,
        points_balance=rng.randint(1, 480) * 1000,
        country=geo[0],
        last_login_region=geo[1],
        trusted_devices=rng.randint(1, 5),
        risk_score=result["risk_score"],
        risk_status=result["risk_status"],
        signals=json.dumps({k: v for k, v in flags.items() if v}),
        days_between_change_and_booking=days_between,
        created_at=utcnow_iso(),
    )
    db.add(acc)
    db.commit()
    db.refresh(acc)
    return acc.to_dict()


@api.get("/accounts/{account_id}/events")
def account_events(account_id: str, db: Session = Depends(get_db)):
    events = (
        db.query(models.Event)
        .filter(models.Event.account_id == account_id)
        .order_by(models.Event.timestamp.desc())
        .all()
    )
    return [e.to_dict() for e in events]


@api.post("/accounts/{account_id}/review")
def mark_reviewed(account_id: str, db: Session = Depends(get_db)):
    acc = db.query(models.Account).filter(models.Account.account_id == account_id).first()
    if not acc:
        raise HTTPException(status_code=404, detail="Account not found")
    acc.reviewed = True
    db.add(models.Event(
        account_id=account_id, event_type="analyst_review", timestamp=utcnow_iso(),
        severity="Low", risk_delta=0, description="Account marked as reviewed by analyst.",
    ))
    db.commit()
    return {"ok": True, "account_id": account_id, "reviewed": True}


# ---------------------------------------------------------------- risk
@api.get("/risk/signals")
def risk_signals():
    return {
        "signals": [
            {"signal": k, **{kk: vv for kk, vv in v.items()}} for k, v in SIGNALS.items()
        ],
        "risk_tiers": RISK_TIERS,
        "recommended_actions": RECOMMENDED_ACTIONS,
    }


@api.post("/admin/reset")
def reset_to_seed():
    """Reset the database back to the seed-42 baseline (100 accounts,
    1000 events, 30 cases, 25 intel notes, 10 graph clusters).

    Clears any on-demand accounts/cases/notes created during a demo
    session. Intended for the 'Reset to seed data' control in Settings.
    """
    import seed as seed_module
    seed_module.run()
    return {"status": "ok", "message": "Database reset to seed-42 baseline."}


@api.post("/risk/score")
def risk_score(req: RiskScoreRequest):
    flags = req.model_dump()
    days = flags.pop("days_between_change_and_booking")
    return compute_risk(flags, days)


@api.post("/simulation/run")
def simulation_run(req: SimulationRequest):
    flags = {
        "new_device": req.new_device,
        "password_changed": req.password_changed,
        "email_changed": req.email_changed,
        "phone_changed": req.phone_changed,
        "dormant_balance_check": req.dormant_account,
        "guest_booking": req.guest_booking,
        "high_value_redemption": req.high_value_redemption,
        "same_property_cluster": req.same_property_cluster,
        # protective signals derived from scenario profile
        "trusted_device": (not req.new_device) and req.account_age_days >= 180,
        "long_clean_history": req.account_age_days >= 730 and not req.dormant_account,
    }
    result = compute_risk(flags, req.days_between_change_and_booking)

    # synthesized timeline for the scenario
    now = datetime.now(timezone.utc)
    timeline = []
    t = now - timedelta(days=2)

    def add(etype, severity, delta, desc, offset_minutes):
        nonlocal t
        t = t + timedelta(minutes=offset_minutes)
        timeline.append({
            "event_type": etype, "timestamp": t.strftime(NOW_FMT),
            "severity": severity, "risk_delta": delta, "description": desc,
        })

    if req.new_device:
        add("login_new_device", "Medium", 15, "Login from unrecognized device fingerprint.", 0)
    if req.password_changed:
        add("password_changed", "High", 20, "Password changed shortly after login.", 18)
    if req.email_changed:
        add("email_changed", "Medium", 15, "Contact email replaced.", 12)
    if req.phone_changed:
        add("phone_changed", "Medium", 15, "Recovery phone replaced.", 9)
    if req.dormant_account:
        add("balance_viewed", "Medium", 20, f"Balance of {req.points_balance:,} points viewed on dormant account.", 25)
    gap_min = (req.days_between_change_and_booking or 1) * 1440
    if req.guest_booking:
        add("guest_booking_created", "Medium", 15, "Guest booking created for a third-party name.", gap_min)
    if req.high_value_redemption:
        add("high_value_redemption", "High", 20, "High-value points redemption executed.", 45)
    if req.same_property_cluster:
        add("destination_cluster_detected", "Critical", 25, "Booking matches a coordinated property/date cluster.", 30)
    if not timeline:
        add("balance_viewed", "Low", 0, "Routine balance check. No anomalous signals.", 0)

    return {
        "input": req.model_dump(),
        **result,
        "timeline": timeline,
    }


# ---------------------------------------------------------------- graph
@api.get("/graph/clusters")
def graph_clusters(db: Session = Depends(get_db)):
    src = active_source(db)
    clusters = db.query(models.Cluster).filter(models.Cluster.source == src).all()
    devices = db.query(models.AccountDevice).filter(models.AccountDevice.source == src).all()
    bookings = db.query(models.Booking).filter(models.Booking.source == src).all()
    accounts = {a.account_id: a for a in db.query(models.Account).filter(models.Account.source == src).all()}

    cluster_members = {}
    for c in clusters:
        for aid in json.loads(c.account_ids or "[]"):
            cluster_members.setdefault(aid, []).append(c.cluster_id)

    nodes, edges = {}, []

    def add_node(nid, label, ntype, **extra):
        if nid not in nodes:
            nodes[nid] = {"id": nid, "label": label, "type": ntype, **extra}
        return nodes[nid]

    for d in devices:
        acc = accounts.get(d.account_id)
        add_node(d.account_id, d.account_id, "account",
                 risk_score=acc.risk_score if acc else 0,
                 risk_status=acc.risk_status if acc else "Low",
                 suspicious=d.account_id in cluster_members,
                 cluster_ids=cluster_members.get(d.account_id, []))
        add_node(d.device_id, d.device_id, "device", suspicious=d.suspicious)
        add_node(d.ip_address, d.ip_address, "ip", suspicious=d.suspicious)
        edges.append({"source": d.account_id, "target": d.device_id, "type": "uses_device", "suspicious": d.suspicious})
        edges.append({"source": d.account_id, "target": d.ip_address, "type": "login_ip", "suspicious": d.suspicious})

    for b in bookings:
        acc = accounts.get(b.account_id)
        add_node(b.account_id, b.account_id, "account",
                 risk_score=acc.risk_score if acc else 0,
                 risk_status=acc.risk_status if acc else "Low",
                 suspicious=b.account_id in cluster_members,
                 cluster_ids=cluster_members.get(b.account_id, []))
        gid = f"guest:{b.guest_name}"
        pid = f"prop:{b.property_name}"
        add_node(gid, b.guest_name, "guest", suspicious=b.suspicious)
        add_node(pid, b.property_name, "property", suspicious=b.suspicious)
        edges.append({"source": b.account_id, "target": gid, "type": "booked_for", "suspicious": b.suspicious})
        edges.append({"source": b.account_id, "target": pid, "type": "booked_at", "suspicious": b.suspicious})
        if b.suspicious:
            did = f"date:{b.booking_date}"
            add_node(did, b.booking_date, "date", suspicious=True)
            edges.append({"source": b.account_id, "target": did, "type": "booking_date", "suspicious": True})

    return {
        "nodes": list(nodes.values()),
        "edges": edges,
        "clusters": [c.to_dict() for c in clusters],
    }


# ---------------------------------------------------------------- cases
@api.get("/cases")
def list_cases(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    sort_by: str = Query("created_at"),
    order: str = Query("desc"),
    status: Optional[str] = None,
    account_id: Optional[str] = None,
    db: Session = Depends(get_db),
):
    sortable = {
        "created_at": models.Case.created_at,
        "updated_at": models.Case.updated_at,
        "severity": SEVERITY_RANK,
        "status": models.Case.status,
        "case_id": models.Case.case_id,
    }
    col = sortable.get(sort_by, models.Case.created_at)
    q = db.query(models.Case)
    if status:
        q = q.filter(models.Case.status == status)
    if account_id:
        q = q.filter(models.Case.account_id == account_id)
    total = q.count()
    q = q.order_by(col.asc() if order == "asc" else col.desc())
    items = q.offset((page - 1) * page_size).limit(page_size).all()
    return {
        "items": [c.to_dict() for c in items],
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": max(1, -(-total // page_size)),
    }


@api.post("/cases", status_code=201)
def create_case(req: CaseCreate, db: Session = Depends(get_db)):
    acc = db.query(models.Account).filter(models.Account.account_id == req.account_id).first()
    if not acc:
        raise HTTPException(status_code=404, detail="Account not found")
    count = db.query(func.count(models.Case.id)).scalar() or 0
    now = utcnow_iso()
    c = models.Case(
        case_id=f"CASE-2026-{count + 1:03d}",
        account_id=req.account_id,
        severity=req.severity,
        status=req.status,
        assigned_analyst=req.assigned_analyst,
        summary=req.summary,
        analyst_notes=req.analyst_notes,
        recommended_action=req.recommended_action or RECOMMENDED_ACTIONS.get(acc.risk_status, ""),
        created_at=now,
        updated_at=now,
    )
    db.add(c)
    db.commit()
    db.refresh(c)
    return c.to_dict()


@api.get("/cases/{case_id}")
def get_case(case_id: str, db: Session = Depends(get_db)):
    c = db.query(models.Case).filter(models.Case.case_id == case_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Case not found")
    acc = db.query(models.Account).filter(models.Account.account_id == c.account_id).first()
    events = (
        db.query(models.Event)
        .filter(models.Event.account_id == c.account_id)
        .order_by(models.Event.timestamp.desc())
        .limit(25)
        .all()
    )
    return {
        **c.to_dict(),
        "account": acc.to_dict() if acc else None,
        "linked_events": [e.to_dict() for e in events],
    }


@api.patch("/cases/{case_id}")
def update_case(case_id: str, req: CaseUpdate, db: Session = Depends(get_db)):
    c = db.query(models.Case).filter(models.Case.case_id == case_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Case not found")
    valid_statuses = ["New", "Investigating", "Escalated", "Confirmed Fraud", "False Positive", "Closed"]
    data = req.model_dump(exclude_none=True)
    if "status" in data and data["status"] not in valid_statuses:
        raise HTTPException(status_code=422, detail=f"Invalid status. Must be one of {valid_statuses}")
    for k, v in data.items():
        setattr(c, k, v)
    c.updated_at = utcnow_iso()
    db.commit()
    db.refresh(c)
    return c.to_dict()


# ---------------------------------------------------------------- threat intel
@api.get("/threat-intel")
def list_intel(db: Session = Depends(get_db)):
    notes = db.query(models.ThreatIntel).order_by(models.ThreatIntel.created_at.desc()).all()
    return [n.to_dict() for n in notes]


@api.post("/threat-intel", status_code=201)
def create_intel(req: ThreatIntelCreate, db: Session = Depends(get_db)):
    n = models.ThreatIntel(
        title=req.title,
        category=req.category,
        severity=req.severity,
        summary=req.summary,
        related_signals=json.dumps(req.related_signals),
        ecosystem_tier=req.ecosystem_tier,
        created_at=utcnow_iso(),
    )
    db.add(n)
    db.commit()
    db.refresh(n)
    return n.to_dict()


# ---------------------------------------------------------------- dashboard
@api.get("/dashboard/stats")
def dashboard_stats(db: Session = Depends(get_db)):
    src = active_source(db)
    accounts = db.query(models.Account).filter(models.Account.source == src).all()
    cases = db.query(models.Case).all()
    total = len(accounts)
    high = sum(1 for a in accounts if a.risk_status == "High")
    open_cases = sum(1 for c in cases if c.status in ("New", "Investigating", "Escalated"))
    flagged_bookings = db.query(func.count(models.Booking.id)).filter(
        models.Booking.suspicious == True, models.Booking.source == src).scalar()  # noqa: E712
    avg = round(sum(a.risk_score for a in accounts) / max(1, total), 1)

    # risk distribution histogram (10-point buckets)
    dist = [{"bucket": f"{i*10}-{i*10+9 if i < 9 else 100}", "count": 0} for i in range(10)]
    for a in accounts:
        dist[min(9, a.risk_score // 10)]["count"] += 1

    # suspicious events over time (last 30 days, UTC dates)
    cutoff = (datetime.now(timezone.utc) - timedelta(days=30)).strftime("%Y-%m-%d")
    events = db.query(models.Event).filter(models.Event.timestamp >= cutoff,
                                           models.Event.source == src).all()
    by_day = {}
    for e in events:
        day = e.timestamp[:10]
        rec = by_day.setdefault(day, {"date": day, "total": 0, "suspicious": 0})
        rec["total"] += 1
        if e.severity in ("High", "Critical"):
            rec["suspicious"] += 1
    events_over_time = sorted(by_day.values(), key=lambda r: r["date"])

    cases_by_severity = {"Low": 0, "Medium": 0, "High": 0, "Critical": 0}
    for c in cases:
        cases_by_severity[c.severity] = cases_by_severity.get(c.severity, 0) + 1

    type_freq = {}
    for e in (db.query(models.Event.event_type, func.count(models.Event.id))
              .filter(models.Event.source == src)
              .group_by(models.Event.event_type).all()):
        type_freq[e[0]] = e[1]

    recent = (
        db.query(models.Event)
        .filter(models.Event.severity.in_(["High", "Critical"]), models.Event.source == src)
        .order_by(models.Event.timestamp.desc())
        .limit(8)
        .all()
    )

    return {
        "data_mode": src,
        "total_accounts": total,
        "high_risk_accounts": high,
        "open_investigations": open_cases,
        "flagged_guest_bookings": flagged_bookings,
        "average_risk_score": avg,
        "risk_distribution": dist,
        "events_over_time": events_over_time,
        "cases_by_severity": [{"severity": k, "count": v} for k, v in cases_by_severity.items()],
        "event_type_frequency": [
            {"event_type": k, "count": v} for k, v in sorted(type_freq.items(), key=lambda x: -x[1])
        ],
        "recent_events": [e.to_dict() for e in recent],
    }


# ---------------------------------------------------------------- reports
@api.get("/reports/summary")
def report_summary(report_type: str = Query("weekly"), db: Session = Depends(get_db)):
    buf = build_summary_pdf(db, report_type)
    filename = f"loyaltyshield_{report_type}_report.pdf"
    return StreamingResponse(
        buf, media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@api.get("/reports/account/{account_id}")
def report_account(account_id: str, db: Session = Depends(get_db)):
    acc = db.query(models.Account).filter(models.Account.account_id == account_id).first()
    if not acc:
        raise HTTPException(status_code=404, detail="Account not found")
    buf = build_account_pdf(db, acc)
    return StreamingResponse(
        buf, media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="risk_report_{account_id}.pdf"'},
    )


app.include_router(api)
app.include_router(ingest_router)
app.include_router(analytics_router)

app.add_middleware(
    CORSMiddleware,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
