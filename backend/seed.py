"""Synthetic data generator for LoyaltyShield AI.

All data is FAKE, generated with a fixed random seed (42) for reproducibility.
No real hotel customer data is used or referenced.

Generates: 100 accounts, 1000 events, 30 cases, 25 threat intel notes,
10 suspicious graph clusters. All risk scores computed via the shared
risk scoring function in risk.py.
"""

import json
import random
from datetime import datetime, timedelta, timezone

import models
from database import Base, SessionLocal, engine
from risk import RECOMMENDED_ACTIONS, SIGNALS, compute_risk

SEED = 42
NOW = datetime.now(timezone.utc).replace(microsecond=0)


def iso(dt):
    return dt.strftime("%Y-%m-%dT%H:%M:%SZ")


TIERS = ["Bronze", "Silver", "Gold", "Platinum"]
TIER_WEIGHTS = [0.35, 0.3, 0.22, 0.13]
GEOS = [
    ("United States", "North America"), ("United Kingdom", "Europe"),
    ("Germany", "Europe"), ("France", "Europe"), ("UAE", "Middle East"),
    ("Singapore", "Asia-Pacific"), ("Japan", "Asia-Pacific"),
    ("Australia", "Asia-Pacific"), ("Canada", "North America"),
    ("Brazil", "South America"), ("India", "Asia-Pacific"),
    ("South Africa", "Africa"),
]
PROPERTIES = [
    "Grand Meridian Dubai", "Azure Palms Maldives", "The Kensington London",
    "Sakura Imperial Tokyo", "Marina Bay Vista Singapore", "Alpine Crown Zurich",
    "Palm Oasis Cancun", "Harbor Lights Sydney", "Royal Orchid Bangkok",
    "Liberty Grand New York",
]
PROPERTY_GEO = {
    "Grand Meridian Dubai": ("Dubai", "UAE", 25.2048, 55.2708),
    "Azure Palms Maldives": ("Malé", "Maldives", 4.1755, 73.5093),
    "The Kensington London": ("London", "United Kingdom", 51.4994, -0.1746),
    "Sakura Imperial Tokyo": ("Tokyo", "Japan", 35.6762, 139.6503),
    "Marina Bay Vista Singapore": ("Singapore", "Singapore", 1.2834, 103.8607),
    "Alpine Crown Zurich": ("Zurich", "Switzerland", 47.3769, 8.5417),
    "Palm Oasis Cancun": ("Cancun", "Mexico", 21.1619, -86.8515),
    "Harbor Lights Sydney": ("Sydney", "Australia", -33.8688, 151.2093),
    "Royal Orchid Bangkok": ("Bangkok", "Thailand", 13.7563, 100.5018),
    "Liberty Grand New York": ("New York", "United States", 40.7128, -74.0060),
}
GUESTS = [
    "Alex Mercer", "Jordan Vale", "Riley Stone", "Casey Brook", "Morgan Hale",
    "Quinn Forster", "Avery Lane", "Dakota Reyes", "Skyler Nash", "Rowan Pike",
    "Emerson Cole", "Finley Marsh", "Harper Quill", "Sage Whitlock", "Tatum Frost",
    "Blair Kingsley", "Reese Aldon", "Phoenix Carrow", "Marlowe Hayes", "Ellis Vance",
]
ANALYSTS = ["A. Chen", "M. Okafor", "S. Petrova", "D. Ramirez", "K. Tanaka"]
CASE_STATUSES = ["New", "Investigating", "Escalated", "Confirmed Fraud", "False Positive", "Closed"]

EVENT_META = {
    "login_new_device": ("Medium", 15, "Login from new device {dev} ({region})"),
    "password_changed": ("High", 20, "Account password changed via web portal"),
    "email_changed": ("Medium", 15, "Contact email updated to a new address"),
    "phone_changed": ("Medium", 15, "Recovery phone number replaced"),
    "balance_viewed": ("Low", 0, "Points balance viewed"),
    "guest_booking_created": ("Medium", 15, "Guest booking created for {guest} at {prop}"),
    "high_value_redemption": ("High", 20, "High-value redemption of {pts} points at {prop}"),
    "destination_cluster_detected": ("Critical", 25, "Account linked to coordinated booking cluster at {prop}"),
    "analyst_review": ("Low", 0, "Manual review completed by {analyst}"),
}


def make_event(account_id, etype, ts, **fmt):
    sev, delta, desc = EVENT_META[etype]
    return models.Event(
        account_id=account_id, event_type=etype, timestamp=iso(ts),
        severity=sev, risk_delta=delta, description=desc.format(**fmt),
    )


def build_accounts(rng):
    accounts = []
    for i in range(100):
        roll = rng.random()
        age = rng.randint(30, 3200)
        dormant = age > 700 and rng.random() < 0.5
        flags = {k: False for k in SIGNALS}
        days_between = None

        if roll < 0.55:  # clean account
            flags["trusted_device"] = rng.random() < 0.75
            flags["long_clean_history"] = age >= 730
        elif roll < 0.78:  # medium suspicion
            picks = rng.sample(
                ["new_device", "dormant_balance_check", "guest_booking", "email_changed", "high_value_redemption"],
                rng.randint(2, 3),
            )
            for p in picks:
                flags[p] = True
            days_between = rng.randint(5, 30) if flags["guest_booking"] else None
        else:  # high-risk ATO chain
            flags["new_device"] = True
            flags["password_changed"] = rng.random() < 0.85
            flags["email_changed"] = rng.random() < 0.6
            flags["phone_changed"] = rng.random() < 0.4
            flags["dormant_balance_check"] = dormant or rng.random() < 0.5
            flags["guest_booking"] = True
            flags["high_value_redemption"] = rng.random() < 0.75
            flags["same_property_cluster"] = rng.random() < 0.55
            days_between = rng.randint(0, 2)

        result = compute_risk(flags, days_between)
        geo = rng.choice(GEOS)
        accounts.append(
            models.Account(
                account_id=f"LTY-{10001 + i}",
                loyalty_tier=rng.choices(TIERS, weights=TIER_WEIGHTS)[0],
                account_age_days=age,
                points_balance=rng.randint(1, 480) * 1000 + rng.randint(0, 999),
                country=geo[0],
                last_login_region=rng.choice(GEOS)[1] if flags["new_device"] else geo[1],
                trusted_devices=rng.randint(1, 5),
                risk_score=result["risk_score"],
                risk_status=result["risk_status"],
                signals=json.dumps({k: v for k, v in flags.items() if v}),
                days_between_change_and_booking=days_between,
                reviewed=False,
                created_at=iso(NOW - timedelta(days=age)),
            )
        )
    return accounts


def build_events(rng, accounts):
    events = []
    for acc in accounts:
        flags = json.loads(acc.signals)
        base = NOW - timedelta(days=rng.randint(2, 75), hours=rng.randint(0, 23))
        t = base
        dev = f"DVC-{rng.randint(1000, 9999)}"
        prop = rng.choice(PROPERTIES)
        guest = rng.choice(GUESTS)
        if flags.get("new_device"):
            events.append(make_event(acc.account_id, "login_new_device", t, dev=dev, region=acc.last_login_region))
        if flags.get("password_changed"):
            t += timedelta(minutes=rng.randint(5, 90)); events.append(make_event(acc.account_id, "password_changed", t))
        if flags.get("email_changed"):
            t += timedelta(minutes=rng.randint(5, 60)); events.append(make_event(acc.account_id, "email_changed", t))
        if flags.get("phone_changed"):
            t += timedelta(minutes=rng.randint(5, 60)); events.append(make_event(acc.account_id, "phone_changed", t))
        if flags.get("dormant_balance_check"):
            t += timedelta(hours=rng.randint(1, 6)); events.append(make_event(acc.account_id, "balance_viewed", t))
        gap_days = acc.days_between_change_and_booking
        if flags.get("guest_booking"):
            t += timedelta(days=gap_days if gap_days is not None else rng.randint(1, 10), hours=rng.randint(1, 8))
            events.append(make_event(acc.account_id, "guest_booking_created", t, guest=guest, prop=prop))
        if flags.get("high_value_redemption"):
            t += timedelta(hours=rng.randint(1, 12))
            events.append(make_event(acc.account_id, "high_value_redemption", t, pts=rng.randint(40, 200) * 1000, prop=prop))
        if flags.get("same_property_cluster"):
            t += timedelta(hours=rng.randint(1, 24))
            events.append(make_event(acc.account_id, "destination_cluster_detected", t, prop=prop))
        if acc.risk_status == "High" and rng.random() < 0.4:
            t += timedelta(days=1)
            events.append(make_event(acc.account_id, "analyst_review", t, analyst=rng.choice(ANALYSTS)))

    # Pad with benign events to reach exactly 1000
    while len(events) < 1000:
        acc = rng.choice(accounts)
        ts = NOW - timedelta(days=rng.randint(0, 89), hours=rng.randint(0, 23), minutes=rng.randint(0, 59))
        events.append(make_event(acc.account_id, "balance_viewed", ts))
    return events[:1000]


def build_cases(rng, accounts):
    risky = sorted(accounts, key=lambda a: -a.risk_score)[:45]
    chosen = rng.sample(risky, 30)
    cases = []
    for i, acc in enumerate(chosen):
        flags = json.loads(acc.signals)
        top = sorted(
            [(k, SIGNALS[k]["weight"]) for k in flags if SIGNALS[k]["weight"] > 0],
            key=lambda x: -x[1],
        )[:3]
        sig_text = ", ".join(SIGNALS[k]["label"] for k, _ in top) or "anomalous activity pattern"
        sev = "Critical" if acc.risk_score >= 85 else ("High" if acc.risk_score >= 70 else ("Medium" if acc.risk_score >= 40 else "Low"))
        status = rng.choices(CASE_STATUSES, weights=[0.2, 0.3, 0.12, 0.15, 0.13, 0.1])[0]
        created = NOW - timedelta(days=rng.randint(1, 45), hours=rng.randint(0, 23))
        updated = created + timedelta(hours=rng.randint(2, 96))
        cases.append(
            models.Case(
                case_id=f"CASE-2026-{i + 1:03d}",
                account_id=acc.account_id,
                severity=sev,
                status=status,
                assigned_analyst=rng.choice(ANALYSTS),
                summary=f"Account {acc.account_id} flagged with risk score {acc.risk_score}/100. Top contributing signals: {sig_text}.",
                analyst_notes="" if status == "New" else f"Reviewed event timeline; pattern consistent with {sig_text.lower()}.",
                recommended_action=RECOMMENDED_ACTIONS[acc.risk_status],
                created_at=iso(created),
                updated_at=iso(min(updated, NOW)),
            )
        )
    return cases


INTEL_TEMPLATES = [
    ("New fraud pattern", "Fraud Pattern", "High", 3,
     ["guest_booking", "same_property_cluster"],
     "Coordinated guest-name reuse observed across unrelated loyalty accounts redeeming at beach resort properties."),
    ("Destination clustering trend", "Destination Clustering", "Medium", 3,
     ["same_property_cluster", "high_value_redemption"],
     "Synthetic telemetry shows clusters of redemptions converging on a small set of high-ADR properties within narrow date windows."),
    ("Credential stuffing spike", "Credential Stuffing", "Critical", 1,
     ["new_device", "password_changed"],
     "Spike in failed-then-successful login sequences from rotating IP ranges, followed by immediate password changes."),
    ("Reseller activity indicator", "Reseller Activity", "High", 3,
     ["guest_booking", "redemption_within_48h"],
     "Marketplace-style behaviour: profile change followed by third-party guest bookings within 48 hours."),
    ("Loyalty redemption abuse trend", "Redemption Abuse", "Medium", 4,
     ["high_value_redemption", "dormant_balance_check"],
     "Dormant high-balance accounts being checked and drained via large single redemptions."),
]


def build_intel(rng):
    notes = []
    for i in range(25):
        title, cat, sev, tier, sigs, summary = INTEL_TEMPLATES[i % 5]
        suffix = ["", " — APAC region", " — EU corridor", " — Americas", " — Gulf properties"][i // 5]
        notes.append(
            models.ThreatIntel(
                title=f"{title}{suffix}",
                category=cat,
                severity=sev,
                summary=summary,
                related_signals=json.dumps(sigs),
                ecosystem_tier=tier,
                created_at=iso(NOW - timedelta(days=rng.randint(0, 30), hours=rng.randint(0, 23))),
            )
        )
    return notes


def build_graph(rng, accounts):
    """10 suspicious clusters + benign background links."""
    devices, bookings, clusters = [], [], []
    high = [a for a in accounts if a.risk_status == "High"]
    med = [a for a in accounts if a.risk_status == "Medium"]
    pool = high + med + rng.sample([a for a in accounts if a.risk_status == "Low"], 10)
    used = set()

    def pick(n):
        avail = [a for a in pool if a.account_id not in used]
        chosen = rng.sample(avail, min(n, len(avail)))
        for c in chosen:
            used.add(c.account_id)
        return chosen

    cluster_num = 0
    # 3 shared-device clusters
    for _ in range(3):
        cluster_num += 1
        members = pick(rng.randint(3, 4))
        dev = f"DVC-{rng.randint(1000, 9999)}"
        ip = f"185.{rng.randint(10, 250)}.{rng.randint(0, 255)}.{rng.randint(1, 254)}"
        for m in members:
            devices.append(models.AccountDevice(account_id=m.account_id, device_id=dev, ip_address=ip, suspicious=True))
        clusters.append(models.Cluster(
            cluster_id=f"CLU-{cluster_num:03d}", cluster_type="shared_device", severity="Critical",
            description=f"Device {dev} used to access {len(members)} unrelated loyalty accounts.",
            account_ids=json.dumps([m.account_id for m in members])))

    # 2 shared-guest clusters
    for _ in range(2):
        cluster_num += 1
        members = pick(3)
        guest = rng.choice(GUESTS)
        for m in members:
            bookings.append(models.Booking(
                account_id=m.account_id, guest_name=guest, property_name=rng.choice(PROPERTIES),
                booking_date=iso(NOW - timedelta(days=rng.randint(1, 20)))[:10],
                points_used=rng.randint(30, 150) * 1000, suspicious=True))
        clusters.append(models.Cluster(
            cluster_id=f"CLU-{cluster_num:03d}", cluster_type="shared_guest", severity="High",
            description=f"Guest '{guest}' appears in bookings across {len(members)} unrelated accounts.",
            account_ids=json.dumps([m.account_id for m in members])))

    # 3 same-property/date clusters
    for _ in range(3):
        cluster_num += 1
        members = pick(rng.randint(3, 5))
        prop = rng.choice(PROPERTIES)
        base_day = NOW - timedelta(days=rng.randint(3, 25))
        for m in members:
            bookings.append(models.Booking(
                account_id=m.account_id, guest_name=rng.choice(GUESTS), property_name=prop,
                booking_date=iso(base_day + timedelta(days=rng.randint(0, 2)))[:10],
                points_used=rng.randint(40, 180) * 1000, suspicious=True))
        clusters.append(models.Cluster(
            cluster_id=f"CLU-{cluster_num:03d}", cluster_type="same_property_dates", severity="High",
            description=f"{len(members)} accounts redeemed at {prop} within a 72-hour window.",
            account_ids=json.dumps([m.account_id for m in members])))

    # 2 shared-IP rings
    for _ in range(2):
        cluster_num += 1
        members = pick(rng.randint(3, 4))
        ip = f"91.{rng.randint(10, 250)}.{rng.randint(0, 255)}.{rng.randint(1, 254)}"
        for m in members:
            devices.append(models.AccountDevice(
                account_id=m.account_id, device_id=f"DVC-{rng.randint(1000, 9999)}",
                ip_address=ip, suspicious=True))
        clusters.append(models.Cluster(
            cluster_id=f"CLU-{cluster_num:03d}", cluster_type="shared_ip", severity="Medium",
            description=f"IP address {ip} associated with logins on {len(members)} accounts.",
            account_ids=json.dumps([m.account_id for m in members])))

    # benign background: ~20 normal accounts with own device/booking
    for a in rng.sample([x for x in accounts if x.account_id not in used], 20):
        devices.append(models.AccountDevice(
            account_id=a.account_id, device_id=f"DVC-{rng.randint(1000, 9999)}",
            ip_address=f"73.{rng.randint(10, 250)}.{rng.randint(0, 255)}.{rng.randint(1, 254)}", suspicious=False))
        if rng.random() < 0.5:
            bookings.append(models.Booking(
                account_id=a.account_id, guest_name=rng.choice(GUESTS), property_name=rng.choice(PROPERTIES),
                booking_date=iso(NOW - timedelta(days=rng.randint(1, 40)))[:10],
                points_used=rng.randint(10, 60) * 1000, suspicious=False))
    return devices, bookings, clusters


def run():
    rng = random.Random(SEED)
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        accounts = build_accounts(rng)
        db.add_all(accounts)
        db.add_all(build_events(rng, accounts))
        db.add_all(build_cases(rng, accounts))
        db.add_all(build_intel(rng))
        devices, bookings, clusters = build_graph(rng, accounts)
        db.add_all(devices)
        db.add_all(bookings)
        db.add_all(clusters)
        db.add_all([
            models.Property(name=n, city=g[0], country=g[1], latitude=g[2], longitude=g[3], source="demo")
            for n, g in PROPERTY_GEO.items()
        ])
        db.commit()
        print(f"Seeded: {len(accounts)} accounts, 1000 events, 30 cases, 25 intel notes, {len(clusters)} clusters")
    finally:
        db.close()


if __name__ == "__main__":
    run()
