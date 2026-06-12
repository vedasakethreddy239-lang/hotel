"""PDF report generation via ReportLab for LoyaltyShield AI (synthetic data only)."""

import json
from datetime import datetime, timezone
from io import BytesIO

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

import models
from risk import SIGNALS, compute_risk

ACCENT = colors.HexColor("#3B82F6")
DARK = colors.HexColor("#111823")

DISCLAIMER = (
    "LoyaltyShield AI is a defensive cybersecurity research prototype using synthetic data only. "
    "It is intended to help analysts understand and mitigate hotel loyalty account takeover and "
    "reward redemption fraud. It must not be used to access, trade, test, or process real compromised accounts."
)


def _styles():
    ss = getSampleStyleSheet()
    ss.add(ParagraphStyle("H1x", parent=ss["Title"], textColor=DARK, spaceAfter=4))
    ss.add(ParagraphStyle("Meta", parent=ss["Normal"], textColor=colors.grey, fontSize=8))
    ss.add(ParagraphStyle("Disc", parent=ss["Normal"], textColor=colors.grey, fontSize=7, spaceBefore=12))
    return ss


def _table(data, col_widths=None):
    t = Table(data, colWidths=col_widths, repeatRows=1)
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), DARK),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTSIZE", (0, 0), (-1, -1), 8),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#CBD5E1")),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F1F5F9")]),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    return t


def _doc(buf, title):
    return SimpleDocTemplate(buf, pagesize=A4, title=title,
                             leftMargin=18 * mm, rightMargin=18 * mm, topMargin=16 * mm, bottomMargin=16 * mm)


def _header(story, ss, title, subtitle):
    story.append(Paragraph(title, ss["H1x"]))
    story.append(Paragraph(
        f"LoyaltyShield AI — {subtitle} | Generated {datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')} | SYNTHETIC DATA",
        ss["Meta"]))
    story.append(Spacer(1, 8))


def build_summary_pdf(db, report_type: str) -> BytesIO:
    from ingest import active_source
    src = active_source(db)
    ss = _styles()
    buf = BytesIO()
    accounts = db.query(models.Account).filter(models.Account.source == src).all()
    cases = db.query(models.Case).all()
    intel = db.query(models.ThreatIntel).order_by(models.ThreatIntel.created_at.desc()).limit(10).all()
    high = [a for a in accounts if a.risk_status == "High"]
    open_cases = [c for c in cases if c.status in ("New", "Investigating", "Escalated")]
    avg = round(sum(a.risk_score for a in accounts) / max(1, len(accounts)), 1)

    titles = {
        "investigation": "Investigation Summary Report",
        "weekly": "Weekly Fraud Intelligence Report",
        "executive": "Executive Dashboard Report",
    }
    title = titles.get(report_type, titles["weekly"])
    story = []
    _header(story, ss, title, "Hotel Loyalty Fraud Intelligence")

    story.append(_table([
        ["Metric", "Value"],
        ["Accounts monitored", str(len(accounts))],
        ["High-risk accounts", str(len(high))],
        ["Open investigations", str(len(open_cases))],
        ["Average risk score", f"{avg}/100"],
        ["Threat intel notes (recent)", str(len(intel))],
    ], [80 * mm, 60 * mm]))
    story.append(Spacer(1, 12))

    if report_type == "investigation":
        story.append(Paragraph("Active Investigations", ss["Heading2"]))
        rows = [["Case", "Account", "Severity", "Status", "Analyst"]]
        for c in sorted(open_cases, key=lambda x: x.created_at, reverse=True)[:15]:
            rows.append([c.case_id, c.account_id, c.severity, c.status, c.assigned_analyst])
        story.append(_table(rows))
    elif report_type == "executive":
        story.append(Paragraph("Risk Posture by Tier", ss["Heading2"]))
        dist = {"Low": 0, "Medium": 0, "High": 0}
        for a in accounts:
            dist[a.risk_status] += 1
        story.append(_table([["Risk Tier", "Accounts", "Share"]] + [
            [k, str(v), f"{round(100 * v / max(1, len(accounts)))}%"] for k, v in dist.items()
        ], [50 * mm, 40 * mm, 40 * mm]))
        story.append(Spacer(1, 10))
        story.append(Paragraph("Cases by Status", ss["Heading2"]))
        by_status = {}
        for c in cases:
            by_status[c.status] = by_status.get(c.status, 0) + 1
        story.append(_table([["Status", "Count"]] + [[k, str(v)] for k, v in by_status.items()], [70 * mm, 40 * mm]))
    else:  # weekly
        story.append(Paragraph("Top High-Risk Accounts", ss["Heading2"]))
        rows = [["Account", "Tier", "Points", "Risk Score", "Status"]]
        for a in sorted(accounts, key=lambda x: -x.risk_score)[:12]:
            rows.append([a.account_id, a.loyalty_tier, f"{a.points_balance:,}", str(a.risk_score), a.risk_status])
        story.append(_table(rows))
        story.append(Spacer(1, 10))
        story.append(Paragraph("Latest Threat Intelligence", ss["Heading2"]))
        rows = [["Title", "Category", "Severity", "Tier"]]
        for n in intel[:8]:
            rows.append([Paragraph(n.title, ss["Normal"]), n.category, n.severity, f"Tier {n.ecosystem_tier}"])
        story.append(_table(rows, [80 * mm, 40 * mm, 25 * mm, 20 * mm]))

    story.append(Paragraph(DISCLAIMER, ss["Disc"]))
    _doc(buf, title).build(story)
    buf.seek(0)
    return buf


def build_account_pdf(db, account: models.Account) -> BytesIO:
    ss = _styles()
    buf = BytesIO()
    story = []
    _header(story, ss, f"Account Risk Report — {account.account_id}", "Account-Level Investigation")

    story.append(_table([
        ["Field", "Value"],
        ["Account ID", account.account_id],
        ["Loyalty tier", account.loyalty_tier],
        ["Points balance", f"{account.points_balance:,}"],
        ["Account age", f"{account.account_age_days} days"],
        ["Country / last login region", f"{account.country} / {account.last_login_region}"],
        ["Risk score", f"{account.risk_score}/100 ({account.risk_status})"],
    ], [70 * mm, 80 * mm]))
    story.append(Spacer(1, 12))

    flags = json.loads(account.signals or "{}")
    result = compute_risk(flags, account.days_between_change_and_booking)
    story.append(Paragraph("Risk Signal Breakdown (shared scoring engine)", ss["Heading2"]))
    rows = [["Signal", "Weight", "Ecosystem Tier", "Triggered"]]
    for b in result["breakdown"]:
        rows.append([b["label"], f"{b['weight']:+d}", f"Tier {b['ecosystem_tier']}" if b["ecosystem_tier"] else "Protective",
                     "YES" if b["triggered"] else "—"])
    story.append(_table(rows, [70 * mm, 20 * mm, 30 * mm, 25 * mm]))
    story.append(Spacer(1, 12))

    events = db.query(models.Event).filter(models.Event.account_id == account.account_id).order_by(models.Event.timestamp).all()
    story.append(Paragraph("Event Timeline", ss["Heading2"]))
    rows = [["Timestamp (UTC)", "Event", "Severity", "Δ Risk"]]
    for e in events[:20]:
        rows.append([e.timestamp, e.event_type.replace("_", " "), e.severity, f"+{e.risk_delta}" if e.risk_delta else "0"])
    story.append(_table(rows, [45 * mm, 60 * mm, 25 * mm, 20 * mm]))
    story.append(Spacer(1, 8))
    story.append(Paragraph(f"Recommended action: {result['recommended_action']}", ss["Normal"]))
    story.append(Paragraph(DISCLAIMER, ss["Disc"]))
    _doc(buf, f"Account Risk Report {account.account_id}").build(story)
    buf.seek(0)
    return buf
