"""Shared risk scoring engine for LoyaltyShield AI.

This is THE single scoring function used by:
- POST /api/risk/score
- POST /api/simulation/run
- Account detail risk explanations
- Synthetic seed data generation

Risk Score = sum of triggered signal weights, additive, capped at 0-100.
"""

from typing import Optional

# Signal registry: weight + the ecosystem tier (from the research framework)
# each detection signal maps to. Tier 0 = protective signal (no actor tier).
SIGNALS = {
    "new_device": {
        "label": "Login from new device",
        "weight": 15,
        "tier": 1,
        "description": "Unrecognized device fingerprint at login — consistent with credential compromise.",
    },
    "password_changed": {
        "label": "Password changed",
        "weight": 20,
        "tier": 1,
        "description": "Credential rotation immediately after access — classic account takeover lockout step.",
    },
    "email_changed": {
        "label": "Email changed",
        "weight": 15,
        "tier": 1,
        "description": "Contact email replaced, redirecting notifications away from the legitimate owner.",
    },
    "phone_changed": {
        "label": "Phone changed",
        "weight": 15,
        "tier": 1,
        "description": "Recovery phone replaced, defeating SMS-based verification.",
    },
    "dormant_balance_check": {
        "label": "Dormant account balance check",
        "weight": 20,
        "tier": 2,
        "description": "Points balance queried on a long-dormant account — valuation behaviour before resale.",
    },
    "guest_booking": {
        "label": "Guest booking created",
        "weight": 15,
        "tier": 3,
        "description": "Reservation created for a third-party guest name unrelated to the account holder.",
    },
    "high_value_redemption": {
        "label": "High-value redemption",
        "weight": 20,
        "tier": 4,
        "description": "Large points redemption — monetization of stolen loyalty value.",
    },
    "same_property_cluster": {
        "label": "Same property cluster",
        "weight": 25,
        "tier": 3,
        "description": "Multiple unrelated accounts redeeming at the same property/date range — coordinated reseller pattern.",
    },
    "redemption_within_48h": {
        "label": "Redemption within 48h of profile change",
        "weight": 20,
        "tier": 3,
        "description": "Combination bonus: profile-change signal AND a redemption signal within a 48-hour window.",
    },
    "trusted_device": {
        "label": "Trusted device",
        "weight": -10,
        "tier": 0,
        "description": "Login from a previously verified device reduces takeover likelihood.",
    },
    "long_clean_history": {
        "label": "Long clean history",
        "weight": -10,
        "tier": 0,
        "description": "Years of consistent, anomaly-free activity reduces risk.",
    },
}

RISK_TIERS = [
    {"name": "Low", "min": 0, "max": 39},
    {"name": "Medium", "min": 40, "max": 69},
    {"name": "High", "min": 70, "max": 100},
]

RECOMMENDED_ACTIONS = {
    "Low": "Continue routine monitoring. No analyst action required.",
    "Medium": "Step-up verification: require MFA re-authentication on next login and review recent profile changes.",
    "High": "Freeze redemptions, lock the account pending identity verification, and open a fraud investigation case.",
}

PROFILE_CHANGE_KEYS = ("password_changed", "email_changed", "phone_changed")
REDEMPTION_KEYS = ("guest_booking", "high_value_redemption")


def risk_status_for(score: int) -> str:
    if score <= 39:
        return "Low"
    if score <= 69:
        return "Medium"
    return "High"


def compute_risk(flags: dict, days_between: Optional[int] = None) -> dict:
    """Compute the risk score from boolean signal flags.

    flags: dict of signal_key -> bool (combination bonus is derived, not passed).
    days_between: days between profile change and booking/redemption (None = N/A).
    Returns score, risk_status and a full per-signal breakdown with tier mapping.
    """
    derived = dict(flags)

    profile_change = any(derived.get(k) for k in PROFILE_CHANGE_KEYS)
    redemption = any(derived.get(k) for k in REDEMPTION_KEYS)
    derived["redemption_within_48h"] = bool(
        profile_change and redemption and days_between is not None and 0 <= days_between <= 2
    )

    raw = 0
    breakdown = []
    for key, meta in SIGNALS.items():
        triggered = bool(derived.get(key))
        if triggered:
            raw += meta["weight"]
        breakdown.append(
            {
                "signal": key,
                "label": meta["label"],
                "weight": meta["weight"],
                "ecosystem_tier": meta["tier"],
                "triggered": triggered,
                "description": meta["description"],
            }
        )

    score = max(0, min(100, raw))
    status = risk_status_for(score)
    return {
        "risk_score": score,
        "raw_score": raw,
        "risk_status": status,
        "recommended_action": RECOMMENDED_ACTIONS[status],
        "breakdown": breakdown,
        "triggered": [b for b in breakdown if b["triggered"]],
    }


def build_narrative(account: dict, result: dict) -> str:
    """Plain-English 'Why was this flagged?' explanation for analysts."""
    triggered = sorted(result["triggered"], key=lambda t: -t["weight"])
    risky = [t for t in triggered if t["weight"] > 0]
    protective = [t for t in triggered if t["weight"] < 0]
    aid = account.get("account_id", "This account")
    status = result["risk_status"]

    if not risky:
        base = (
            f"{aid} scored {result['risk_score']}/100 ({status}). No anomalous signals were "
            "observed in its recent activity."
        )
        if protective:
            base += " Protective factors — " + ", ".join(p["label"].lower() for p in protective) + \
                    " — further reduce takeover likelihood."
        return base

    parts = [
        f"{aid} was flagged {status} risk with a composite score of {result['risk_score']}/100."
    ]
    top = risky[0]
    parts.append(
        f"The strongest contributor is \u201c{top['label']}\u201d (+{top['weight']}): {top['description']}"
    )
    if len(risky) > 1:
        others = ", ".join(f"{t['label'].lower()} (+{t['weight']})" for t in risky[1:4])
        parts.append(f"Supporting signals include {others}.")
    if any(t["signal"] == "redemption_within_48h" for t in risky):
        days = account.get("days_between_change_and_booking")
        parts.append(
            f"Critically, a redemption occurred within {days if days is not None else '<2'} day(s) of a profile "
            "change — the hallmark sequence of loyalty account takeover (lock out the owner, then drain points)."
        )
    tiers = sorted({t["ecosystem_tier"] for t in risky if t["ecosystem_tier"] > 0})
    if tiers:
        parts.append(
            "Mapped fraud-ecosystem activity spans tier" + ("s " if len(tiers) > 1 else " ") +
            ", ".join(str(t) for t in tiers) + " of the four-tier model."
        )
    if protective:
        parts.append(
            "Mitigating factors: " + ", ".join(f"{p['label'].lower()} ({p['weight']})" for p in protective) + "."
        )
    parts.append(f"Recommended action: {result['recommended_action']}")
    return " ".join(parts)
