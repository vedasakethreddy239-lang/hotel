"""Analytics routes: global search, property risk, economic impact,
four-tier ecosystem stats, graph entity workspace, dynamic threat intel."""

import json
import random
from collections import defaultdict
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

import models
from database import get_db
from ingest import active_source, utcnow_iso
from risk import SIGNALS

router = APIRouter(prefix="/api", tags=["analytics"])

POINT_VALUE_USD = 0.008  # industry-typical loyalty point valuation


# ---------------------------------------------------------------- search

@router.get("/search")
def global_search(q: str = Query(..., min_length=1), db: Session = Depends(get_db)):
    src = active_source(db)
    term = f"%{q}%"
    results = []

    for a in (db.query(models.Account)
              .filter(models.Account.source == src)
              .filter(models.Account.account_id.ilike(term) | models.Account.country.ilike(term))
              .order_by(models.Account.risk_score.desc()).limit(5).all()):
        results.append({"type": "account", "id": a.account_id, "label": a.account_id,
                        "sub": f"{a.loyalty_tier} · {a.country} · risk {a.risk_score} ({a.risk_status})",
                        "risk_status": a.risk_status, "link": f"/accounts/{a.account_id}"})

    for c in (db.query(models.Case)
              .filter(models.Case.case_id.ilike(term) | models.Case.summary.ilike(term) |
                      models.Case.account_id.ilike(term))
              .order_by(models.Case.created_at.desc()).limit(5).all()):
        results.append({"type": "case", "id": c.case_id, "label": c.case_id,
                        "sub": f"{c.severity} · {c.status} · {c.account_id}",
                        "link": f"/cases/{c.case_id}"})

    for p in (db.query(models.Property).filter(models.Property.name.ilike(term))
              .limit(5).all()):
        results.append({"type": "property", "id": p.name, "label": p.name,
                        "sub": f"{p.city}, {p.country}".strip(", "),
                        "link": f"/properties?focus={p.name}"})

    devices = (db.query(models.AccountDevice)
               .filter(models.AccountDevice.source == src)
               .filter(models.AccountDevice.device_id.ilike(term) |
                       models.AccountDevice.ip_address.ilike(term))
               .limit(10).all())
    seen = set()
    for d in devices:
        key = d.device_id if q.lower() in d.device_id.lower() else d.ip_address
        ntype = "device" if key == d.device_id else "ip"
        if key in seen:
            continue
        seen.add(key)
        results.append({"type": ntype, "id": key, "label": key,
                        "sub": f"linked to {d.account_id}" + (" · suspicious" if d.suspicious else ""),
                        "link": f"/graph?focus={key}"})
        if len(seen) >= 5:
            break

    guests = (db.query(models.Booking.guest_name)
              .filter(models.Booking.source == src, models.Booking.guest_name.ilike(term))
              .distinct().limit(5).all())
    for (g,) in guests:
        results.append({"type": "guest", "id": g, "label": g,
                        "sub": "booking guest name", "link": f"/graph?focus=guest:{g}"})

    for n in (db.query(models.ThreatIntel)
              .filter(models.ThreatIntel.title.ilike(term)).limit(3).all()):
        results.append({"type": "intel", "id": str(n.id), "label": n.title,
                        "sub": f"{n.category} · {n.severity}", "link": "/threat-intel"})

    return {"query": q, "results": results, "total": len(results)}


# ---------------------------------------------------------------- properties

@router.get("/properties/risk")
def property_risk(db: Session = Depends(get_db)):
    src = active_source(db)
    bookings = db.query(models.Booking).filter(models.Booking.source == src).all()
    accounts = {a.account_id: a for a in db.query(models.Account).filter(models.Account.source == src).all()}
    props = {p.name: p for p in db.query(models.Property).all()}
    clusters = db.query(models.Cluster).filter(models.Cluster.source == src).all()

    prop_clusters = defaultdict(list)
    for c in clusters:
        if c.cluster_type == "same_property_dates":
            # description contains property name; map via member bookings instead
            member_ids = set(json.loads(c.account_ids or "[]"))
            for b in bookings:
                if b.account_id in member_ids and b.suspicious:
                    prop_clusters[b.property_name].append(c.cluster_id)

    agg = defaultdict(lambda: {"bookings": 0, "suspicious_bookings": 0, "points_redeemed": 0,
                               "suspicious_points": 0, "accounts": set(), "high_risk_accounts": set(),
                               "recent_bookings": []})
    for b in bookings:
        a = agg[b.property_name]
        a["bookings"] += 1
        a["points_redeemed"] += b.points_used or 0
        a["accounts"].add(b.account_id)
        if b.suspicious:
            a["suspicious_bookings"] += 1
            a["suspicious_points"] += b.points_used or 0
        acc = accounts.get(b.account_id)
        if acc and acc.risk_status == "High":
            a["high_risk_accounts"].add(b.account_id)
        a["recent_bookings"].append(b.to_dict())

    items = []
    for name, a in agg.items():
        p = props.get(name)
        sus_ratio = a["suspicious_bookings"] / a["bookings"] if a["bookings"] else 0
        hr_ratio = len(a["high_risk_accounts"]) / len(a["accounts"]) if a["accounts"] else 0
        risk_index = round(min(100, 60 * sus_ratio + 40 * hr_ratio + min(10, len(set(prop_clusters.get(name, []))) * 5)))
        linked = sorted(a["accounts"])
        items.append({
            "name": name,
            "city": p.city if p else "",
            "country": p.country if p else "",
            "latitude": p.latitude if p else None,
            "longitude": p.longitude if p else None,
            "bookings": a["bookings"],
            "suspicious_bookings": a["suspicious_bookings"],
            "points_redeemed": a["points_redeemed"],
            "suspicious_points": a["suspicious_points"],
            "linked_accounts": [
                {"account_id": aid,
                 "risk_score": accounts[aid].risk_score if aid in accounts else 0,
                 "risk_status": accounts[aid].risk_status if aid in accounts else "Low"}
                for aid in linked
            ],
            "high_risk_accounts": len(a["high_risk_accounts"]),
            "cluster_ids": sorted(set(prop_clusters.get(name, []))),
            "risk_index": risk_index,
            "recent_bookings": sorted(a["recent_bookings"], key=lambda b: b["booking_date"], reverse=True)[:8],
        })
    items.sort(key=lambda i: -i["risk_index"])

    # destination (country) rollup
    by_country = defaultdict(lambda: {"properties": 0, "bookings": 0, "suspicious_bookings": 0, "points_redeemed": 0})
    for it in items:
        c = by_country[it["country"] or "Unknown"]
        c["properties"] += 1
        c["bookings"] += it["bookings"]
        c["suspicious_bookings"] += it["suspicious_bookings"]
        c["points_redeemed"] += it["points_redeemed"]
    destinations = [{"country": k, **v,
                     "suspicious_ratio": round(v["suspicious_bookings"] / v["bookings"], 3) if v["bookings"] else 0}
                    for k, v in by_country.items()]
    destinations.sort(key=lambda d: -d["suspicious_ratio"])

    return {"mode": src, "properties": items, "destinations": destinations,
            "unmapped": [i["name"] for i in items if i["latitude"] is None]}


# ---------------------------------------------------------------- economics

@router.get("/economics/impact")
def economic_impact(point_value: float = Query(POINT_VALUE_USD, gt=0, le=1), db: Session = Depends(get_db)):
    src = active_source(db)
    accounts = db.query(models.Account).filter(models.Account.source == src).all()
    bookings = db.query(models.Booking).filter(models.Booking.source == src).all()
    cases = db.query(models.Case).all()
    acc_map = {a.account_id: a for a in accounts}

    high = [a for a in accounts if a.risk_status == "High"]
    med = [a for a in accounts if a.risk_status == "Medium"]
    points_at_risk = sum(a.points_balance for a in high)
    points_watchlist = sum(a.points_balance for a in med)
    sus_points = sum(b.points_used or 0 for b in bookings if b.suspicious)

    confirmed_accounts = {c.account_id for c in cases if c.status == "Confirmed Fraud"}
    fp_accounts = {c.account_id for c in cases if c.status == "False Positive"}
    interdicted = sum(b.points_used or 0 for b in bookings
                      if b.suspicious and b.account_id in confirmed_accounts)
    confirmed_balance = sum(acc_map[a].points_balance for a in confirmed_accounts if a in acc_map)

    # exposure by loyalty tier
    by_tier = defaultdict(lambda: {"accounts": 0, "high_risk": 0, "points_at_risk": 0})
    for a in accounts:
        t = by_tier[a.loyalty_tier]
        t["accounts"] += 1
        if a.risk_status == "High":
            t["high_risk"] += 1
            t["points_at_risk"] += a.points_balance
    tier_rows = [{"tier": k, **v, "usd_at_risk": round(v["points_at_risk"] * point_value, 2)}
                 for k, v in by_tier.items()]
    order = {"Bronze": 0, "Silver": 1, "Gold": 2, "Platinum": 3}
    tier_rows.sort(key=lambda r: order.get(r["tier"], 9))

    # suspicious redemption exposure trend (by booking date)
    by_date = defaultdict(int)
    for b in bookings:
        if b.suspicious:
            by_date[b.booking_date] += b.points_used or 0
    trend = [{"date": d, "points": v, "usd": round(v * point_value, 2)}
             for d, v in sorted(by_date.items())]

    # top exposed properties
    by_prop = defaultdict(int)
    for b in bookings:
        if b.suspicious:
            by_prop[b.property_name] += b.points_used or 0
    top_props = [{"property": k, "points": v, "usd": round(v * point_value, 2)}
                 for k, v in sorted(by_prop.items(), key=lambda x: -x[1])[:8]]

    open_cases = sum(1 for c in cases if c.status in ("New", "Investigating", "Escalated"))

    return {
        "mode": src,
        "point_value_usd": point_value,
        "points_at_risk": points_at_risk,
        "usd_at_risk": round(points_at_risk * point_value, 2),
        "points_watchlist": points_watchlist,
        "usd_watchlist": round(points_watchlist * point_value, 2),
        "suspicious_redemption_points": sus_points,
        "suspicious_redemption_usd": round(sus_points * point_value, 2),
        "interdicted_points": interdicted,
        "interdicted_usd": round(interdicted * point_value, 2),
        "confirmed_fraud_accounts": len(confirmed_accounts),
        "confirmed_fraud_balance_points": confirmed_balance,
        "confirmed_fraud_balance_usd": round(confirmed_balance * point_value, 2),
        "false_positive_accounts": len(fp_accounts),
        "open_cases": open_cases,
        "high_risk_accounts": len(high),
        "exposure_by_tier": tier_rows,
        "exposure_trend": trend,
        "top_exposed_properties": top_props,
        "methodology": [
            f"Points are valued at ${point_value}/point (configurable; industry resale benchmarks range $0.005–$0.01).",
            "Points at risk = total balance held by High-risk accounts (score ≥ 70).",
            "Suspicious redemption exposure = points consumed by bookings flagged by cluster detection.",
            "Interdicted exposure = suspicious redemption points on accounts with a case marked Confirmed Fraud.",
            "All figures derive from the active dataset (synthetic demo or uploaded).",
        ],
    }


# ---------------------------------------------------------------- ecosystem

TIER_META = [
    {"tier": 1, "name": "Credential Harvesting & Access",
     "actor": "Initial access brokers",
     "description": "Phishing, credential stuffing and device takeover establish unauthorized access to loyalty accounts."},
    {"tier": 2, "name": "Valuation & Dormant Asset Discovery",
     "actor": "Account assessors",
     "description": "Compromised accounts are inventoried; dormant, high-balance accounts are valued for resale."},
    {"tier": 3, "name": "Brokerage & Coordinated Resale",
     "actor": "Marketplace brokers",
     "description": "Access is brokered to buyers; coordinated guest bookings and property/date clusters appear."},
    {"tier": 4, "name": "Monetization & Redemption",
     "actor": "Cash-out operators",
     "description": "Points are drained through high-value redemptions, completing the fraud lifecycle."},
]


@router.get("/ecosystem/tiers")
def ecosystem_tiers(db: Session = Depends(get_db)):
    src = active_source(db)
    accounts = db.query(models.Account).filter(models.Account.source == src).all()
    intel_by_tier = defaultdict(int)
    for n in db.query(models.ThreatIntel).all():
        intel_by_tier[n.ecosystem_tier] += 1

    tier_signal_keys = {t: [k for k, m in SIGNALS.items() if m["tier"] == t] for t in (1, 2, 3, 4)}
    stats = {t: {"signal_triggers": 0, "accounts": set(), "signal_counts": defaultdict(int)} for t in (1, 2, 3, 4)}
    dominant_examples = defaultdict(list)

    for a in accounts:
        flags = json.loads(a.signals or "{}")
        tier_weights = defaultdict(int)
        for k, v in flags.items():
            if not v or k not in SIGNALS:
                continue
            t = SIGNALS[k]["tier"]
            if t == 0:
                continue
            stats[t]["signal_triggers"] += 1
            stats[t]["accounts"].add(a.account_id)
            stats[t]["signal_counts"][k] += 1
            tier_weights[t] += SIGNALS[k]["weight"]
        if tier_weights:
            dom = max(tier_weights, key=tier_weights.get)
            dominant_examples[dom].append({"account_id": a.account_id, "risk_score": a.risk_score,
                                           "risk_status": a.risk_status})

    tiers = []
    for meta in TIER_META:
        t = meta["tier"]
        s = stats[t]
        examples = sorted(dominant_examples[t], key=lambda x: -x["risk_score"])[:5]
        tiers.append({
            **meta,
            "signals": [{"signal": k, "label": SIGNALS[k]["label"], "weight": SIGNALS[k]["weight"],
                         "triggered_count": s["signal_counts"].get(k, 0)} for k in tier_signal_keys[t]],
            "signal_triggers": s["signal_triggers"],
            "active_accounts": len(s["accounts"]),
            "dominant_accounts": len(dominant_examples[t]),
            "example_accounts": examples,
            "intel_notes": intel_by_tier.get(t, 0),
        })

    total_flagged = len({aid for s in stats.values() for aid in s["accounts"]})
    return {"mode": src, "tiers": tiers, "total_accounts": len(accounts),
            "accounts_in_ecosystem": total_flagged}


# ---------------------------------------------------------------- graph entity

@router.get("/graph/entity")
def graph_entity(node_id: str = Query(...), node_type: str = Query(...), db: Session = Depends(get_db)):
    src = active_source(db)
    out = {"node_id": node_id, "node_type": node_type}

    def acc_brief(aid):
        a = db.query(models.Account).filter(models.Account.account_id == aid).first()
        return ({"account_id": aid, "risk_score": a.risk_score, "risk_status": a.risk_status,
                 "loyalty_tier": a.loyalty_tier, "points_balance": a.points_balance}
                if a else {"account_id": aid, "risk_score": 0, "risk_status": "Low",
                           "loyalty_tier": "—", "points_balance": 0})

    if node_type == "account":
        a = db.query(models.Account).filter(models.Account.account_id == node_id).first()
        if not a:
            raise HTTPException(status_code=404, detail="Account not found")
        out["account"] = a.to_dict()
        out["devices"] = [d.to_dict() for d in db.query(models.AccountDevice)
                          .filter(models.AccountDevice.account_id == node_id).all()]
        out["bookings"] = [b.to_dict() for b in db.query(models.Booking)
                           .filter(models.Booking.account_id == node_id).all()]
        out["cases"] = [c.to_dict() for c in db.query(models.Case)
                        .filter(models.Case.account_id == node_id).all()]
        out["clusters"] = [c.to_dict() for c in db.query(models.Cluster)
                           .filter(models.Cluster.source == src).all()
                           if node_id in json.loads(c.account_ids or "[]")]
        out["recent_events"] = [e.to_dict() for e in db.query(models.Event)
                                .filter(models.Event.account_id == node_id)
                                .order_by(models.Event.timestamp.desc()).limit(6).all()]
    elif node_type in ("device", "ip"):
        col = models.AccountDevice.device_id if node_type == "device" else models.AccountDevice.ip_address
        links = db.query(models.AccountDevice).filter(col == node_id,
                                                      models.AccountDevice.source == src).all()
        out["linked_accounts"] = [acc_brief(d.account_id) for d in {d.account_id: d for d in links}.values()]
        out["suspicious"] = any(d.suspicious for d in links)
    elif node_type == "guest":
        name = node_id.replace("guest:", "")
        bks = db.query(models.Booking).filter(models.Booking.guest_name == name,
                                              models.Booking.source == src).all()
        out["bookings"] = [b.to_dict() for b in bks]
        out["linked_accounts"] = [acc_brief(aid) for aid in sorted({b.account_id for b in bks})]
        out["suspicious"] = any(b.suspicious for b in bks)
    elif node_type == "property":
        name = node_id.replace("prop:", "")
        bks = db.query(models.Booking).filter(models.Booking.property_name == name,
                                              models.Booking.source == src).all()
        prop = db.query(models.Property).filter(models.Property.name == name).first()
        out["property"] = prop.to_dict() if prop else {"name": name}
        out["bookings"] = [b.to_dict() for b in bks]
        out["linked_accounts"] = [acc_brief(aid) for aid in sorted({b.account_id for b in bks})]
        out["suspicious"] = any(b.suspicious for b in bks)
    elif node_type == "date":
        date = node_id.replace("date:", "")
        bks = db.query(models.Booking).filter(models.Booking.booking_date == date,
                                              models.Booking.source == src).all()
        out["bookings"] = [b.to_dict() for b in bks]
        out["linked_accounts"] = [acc_brief(aid) for aid in sorted({b.account_id for b in bks})]
        out["suspicious"] = any(b.suspicious for b in bks)
    else:
        raise HTTPException(status_code=422, detail=f"Unknown node_type '{node_type}'")
    return out


# ---------------------------------------------------------------- dynamic threat intel

@router.post("/threat-intel/generate", status_code=201)
def generate_intel(db: Session = Depends(get_db)):
    """Generate an intel note from live patterns in the active dataset."""
    src = active_source(db)
    rng = random.Random()
    accounts = db.query(models.Account).filter(models.Account.source == src).all()
    clusters = db.query(models.Cluster).filter(models.Cluster.source == src).all()
    bookings = db.query(models.Booking).filter(models.Booking.source == src).all()

    candidates = []

    if clusters:
        c = rng.choice(clusters)
        n = len(json.loads(c.account_ids or "[]"))
        type_map = {
            "shared_device": ("Credential Stuffing", "Critical", 1, ["new_device", "password_changed"],
                              f"Live detection: cluster {c.cluster_id} shows one device fingerprint operating {n} "
                              f"loyalty accounts. {c.description} Pattern is consistent with an access-broker "
                              "workstation cycling through compromised credentials."),
            "shared_ip": ("Credential Stuffing", "High", 1, ["new_device"],
                          f"Live detection: cluster {c.cluster_id} ties {n} accounts to one IP. {c.description} "
                          "Recommend rate-limiting and step-up verification for this network range."),
            "shared_guest": ("Reseller Activity", "High", 3, ["guest_booking", "redemption_within_48h"],
                             f"Live detection: cluster {c.cluster_id} shows one guest identity booked from {n} "
                             f"unrelated accounts. {c.description} Indicates brokered redemption on behalf of a buyer."),
            "same_property_dates": ("Destination Clustering", "High", 3, ["same_property_cluster", "high_value_redemption"],
                                    f"Live detection: cluster {c.cluster_id} — {c.description} Coordinated arrival "
                                    "windows are the signature of organized resale operations."),
        }
        cat, sev, tier, sigs, summary = type_map.get(
            c.cluster_type, ("Fraud Pattern", "Medium", 3, [], c.description))
        candidates.append((f"Cluster watch: {c.cluster_id} ({c.cluster_type.replace('_', ' ')})",
                           cat, sev, tier, sigs, summary))

    dormant_high = [a for a in accounts if a.risk_status == "High" and a.account_age_days > 700]
    if dormant_high:
        pts = sum(a.points_balance for a in dormant_high)
        candidates.append((
            f"Dormant high-balance exposure: {len(dormant_high)} accounts",
            "Redemption Abuse", "High", 2, ["dormant_balance_check", "high_value_redemption"],
            f"{len(dormant_high)} dormant accounts (>700 days old) currently sit in the High-risk band, holding "
            f"{pts:,} points combined. Dormant balance checks followed by large redemptions are the tier-2 "
            "valuation signature. Recommend pre-emptive MFA challenges on dormant logins.",
        ))

    sus = [b for b in bookings if b.suspicious]
    if sus:
        by_prop = defaultdict(int)
        for b in sus:
            by_prop[b.property_name] += 1
        prop, cnt = max(by_prop.items(), key=lambda x: x[1])
        pts = sum(b.points_used or 0 for b in sus if b.property_name == prop)
        candidates.append((
            f"Hotspot property: {prop}",
            "Destination Clustering", "Medium", 3, ["same_property_cluster", "guest_booking"],
            f"{prop} accounts for {cnt} flagged bookings totalling {pts:,} points in the active dataset — the "
            "highest concentration of suspicious redemptions. Recommend enhanced verification for point "
            "bookings at this property.",
        ))

    high = [a for a in accounts if a.risk_status == "High"]
    if high:
        ato = sum(1 for a in high if json.loads(a.signals or "{}").get("password_changed"))
        candidates.append((
            f"ATO chain activity: {len(high)} high-risk accounts",
            "Fraud Pattern", "Critical" if len(high) > 15 else "High", 1,
            ["new_device", "password_changed", "guest_booking"],
            f"{len(high)} accounts currently score ≥70, {ato} of them showing the full takeover chain "
            "(new device → credential rotation → redemption). Average dwell time between profile change and "
            "first redemption remains under 48 hours.",
        ))

    if not candidates:
        raise HTTPException(status_code=409, detail="Not enough data to generate an intel note")

    title, cat, sev, tier, sigs, summary = rng.choice(candidates)
    note = models.ThreatIntel(
        title=title, category=cat, severity=sev, summary=summary,
        related_signals=json.dumps(sigs), ecosystem_tier=tier, created_at=utcnow_iso(),
    )
    db.add(note)
    db.commit()
    db.refresh(note)
    return note.to_dict()
