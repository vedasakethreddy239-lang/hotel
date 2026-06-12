"""LoyaltyShield AI backend integration tests.

Covers: accounts, risk scoring math, simulation, graph, threat-intel, cases, reports, dashboard.
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "http://localhost:8000").rstrip("/")
API = f"{BASE_URL}/api"


@pytest.fixture(scope="session")
def s():
    sess = requests.Session()
    sess.headers.update({"Content-Type": "application/json"})
    return sess


# ---------- Dashboard ----------
class TestDashboard:
    def test_dashboard_stats(self, s):
        r = s.get(f"{API}/dashboard/stats")
        assert r.status_code == 200
        d = r.json()
        for k in ["total_accounts", "high_risk_accounts", "open_investigations",
                  "flagged_guest_bookings", "average_risk_score",
                  "risk_distribution", "events_over_time"]:
            assert k in d, f"missing {k}"
        assert d["total_accounts"] == 100


# ---------- Accounts ----------
class TestAccounts:
    def test_list_default_pagination(self, s):
        r = s.get(f"{API}/accounts")
        assert r.status_code == 200
        d = r.json()
        assert d["total"] == 100
        assert len(d["items"]) == 20
        assert d["page"] == 1

    def test_pagination_page2(self, s):
        r = s.get(f"{API}/accounts", params={"page": 2})
        assert r.status_code == 200
        d = r.json()
        assert d["page"] == 2
        assert len(d["items"]) == 20

    def test_sort_risk_score_desc(self, s):
        r = s.get(f"{API}/accounts", params={"sort_by": "risk_score", "order": "desc"})
        assert r.status_code == 200
        items = r.json()["items"]
        scores = [x["risk_score"] for x in items]
        assert scores == sorted(scores, reverse=True)

    def test_sort_points_balance_asc(self, s):
        r = s.get(f"{API}/accounts", params={"sort_by": "points_balance", "order": "asc"})
        items = r.json()["items"]
        bal = [x["points_balance"] for x in items]
        assert bal == sorted(bal)

    def test_sort_account_age_asc(self, s):
        r = s.get(f"{API}/accounts", params={"sort_by": "account_age_days", "order": "asc"})
        items = r.json()["items"]
        ages = [x["account_age_days"] for x in items]
        assert ages == sorted(ages)

    def test_filter_risk_status_high(self, s):
        r = s.get(f"{API}/accounts", params={"risk_status": "High", "page_size": 100})
        items = r.json()["items"]
        assert all(x["risk_status"] == "High" for x in items)

    def test_search(self, s):
        r = s.get(f"{API}/accounts", params={"search": "LTY-10005"})
        assert r.status_code == 200
        items = r.json()["items"]
        assert any("LTY-10005" in x["account_id"] for x in items)

    def test_get_account_detail(self, s):
        r = s.get(f"{API}/accounts/LTY-10005")
        assert r.status_code == 200
        d = r.json()
        assert d["account_id"] == "LTY-10005"
        assert "risk_explanation" in d
        assert "breakdown" in d["risk_explanation"]
        for b in d["risk_explanation"]["breakdown"]:
            assert "weight" in b
            assert "ecosystem_tier" in b
        assert "related_cases" in d

    def test_get_account_events(self, s):
        r = s.get(f"{API}/accounts/LTY-10005/events")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_account_not_found(self, s):
        r = s.get(f"{API}/accounts/LTY-99999")
        assert r.status_code == 404

    def test_generate_account(self, s):
        r = s.post(f"{API}/accounts/generate")
        assert r.status_code in (200, 201)
        d = r.json()
        assert "account_id" in d
        # verify persistence
        r2 = s.get(f"{API}/accounts/{d['account_id']}")
        assert r2.status_code == 200

    def test_mark_reviewed(self, s):
        r = s.post(f"{API}/accounts/LTY-10010/review")
        assert r.status_code in (200, 201)
        # event should be appended
        evs = s.get(f"{API}/accounts/LTY-10010/events").json()
        assert any(e.get("event_type") == "analyst_review" for e in evs)


# ---------- Risk Scoring Math ----------
class TestRiskScore:
    def test_ato_combo_70(self, s):
        r = s.post(f"{API}/risk/score", json={
            "new_device": True, "password_changed": True, "guest_booking": True,
            "days_between_change_and_booking": 1
        })
        assert r.status_code == 200
        d = r.json()
        assert d["risk_score"] == 70, f"expected 70 got {d['risk_score']}"
        assert d["risk_status"] == "High"
        triggered_keys = {t["signal"] for t in d["triggered"]}
        assert "redemption_within_48h" in triggered_keys

    def test_combo_does_not_fire_far_apart(self, s):
        r = s.post(f"{API}/risk/score", json={
            "password_changed": True, "guest_booking": True,
            "days_between_change_and_booking": 5
        })
        d = r.json()
        triggered_keys = {t["signal"] for t in d["triggered"]}
        assert "redemption_within_48h" not in triggered_keys
        assert d["risk_score"] == 35  # 20 + 15

    def test_combo_requires_redemption(self, s):
        r = s.post(f"{API}/risk/score", json={
            "password_changed": True, "email_changed": True,
            "days_between_change_and_booking": 1
        })
        d = r.json()
        triggered_keys = {t["signal"] for t in d["triggered"]}
        assert "redemption_within_48h" not in triggered_keys
        assert d["risk_score"] == 35

    def test_floor_at_0(self, s):
        r = s.post(f"{API}/risk/score", json={
            "trusted_device": True, "long_clean_history": True
        })
        d = r.json()
        assert d["risk_score"] == 0
        assert d["risk_status"] == "Low"

    def test_cap_at_100(self, s):
        payload = {k: True for k in ["new_device", "password_changed", "email_changed",
                                      "phone_changed", "dormant_balance_check",
                                      "guest_booking", "high_value_redemption",
                                      "same_property_cluster"]}
        payload["days_between_change_and_booking"] = 1
        r = s.post(f"{API}/risk/score", json=payload)
        d = r.json()
        assert d["risk_score"] == 100
        assert d["risk_status"] == "High"


# ---------- Simulation ----------
class TestSimulation:
    def test_simulation_consistent(self, s):
        payload = {
            "new_device": True, "password_changed": True, "guest_booking": True,
            "days_between_change_and_booking": 1
        }
        r1 = s.post(f"{API}/risk/score", json=payload).json()
        r2 = s.post(f"{API}/simulation/run", json=payload)
        assert r2.status_code == 200
        d = r2.json()
        assert d["risk_score"] == r1["risk_score"]
        assert "breakdown" in d
        assert "timeline" in d
        assert "recommended_action" in d

    def test_normal_guest_low(self, s):
        r = s.post(f"{API}/simulation/run", json={})
        d = r.json()
        assert d["risk_score"] == 0
        assert d["risk_status"] == "Low"


# ---------- Graph & Threat Intel ----------
class TestGraph:
    def test_clusters(self, s):
        r = s.get(f"{API}/graph/clusters")
        assert r.status_code == 200
        d = r.json()
        assert "nodes" in d and "edges" in d and "clusters" in d
        assert len(d["clusters"]) == 10


class TestThreatIntel:
    def test_list(self, s):
        r = s.get(f"{API}/threat-intel")
        assert r.status_code == 200
        d = r.json()
        items = d if isinstance(d, list) else d.get("items", [])
        assert len(items) >= 25

    def test_create(self, s):
        r = s.post(f"{API}/threat-intel", json={
            "title": "TEST_intel",
            "category": "ATO",
            "summary": "test summary",
            "severity": "Medium"
        })
        assert r.status_code in (200, 201)


# ---------- Cases ----------
class TestCases:
    def test_list_pagination(self, s):
        r = s.get(f"{API}/cases")
        assert r.status_code == 200
        d = r.json()
        assert "items" in d or isinstance(d, list)

    def test_sort_severity(self, s):
        r = s.get(f"{API}/cases", params={"sort_by": "severity"})
        assert r.status_code == 200

    def test_create_case(self, s):
        r = s.post(f"{API}/cases", json={
            "account_id": "LTY-10005",
            "severity": "High",
            "summary": "TEST_ case auto",
            "status": "Open"
        })
        assert r.status_code in (200, 201)
        d = r.json()
        assert "case_id" in d
        assert d["case_id"].startswith("CASE-")
        cid = d["case_id"]

        # GET
        rg = s.get(f"{API}/cases/{cid}")
        assert rg.status_code == 200
        gd = rg.json()
        assert "account" in gd or "account_id" in gd
        assert "linked_events" in gd

        # PATCH status (valid)
        rp = s.patch(f"{API}/cases/{cid}", json={"status": "Investigating"})
        assert rp.status_code == 200
        assert rp.json()["status"] == "Investigating"

        # PATCH invalid enum
        rp2 = s.patch(f"{API}/cases/{cid}", json={"status": "InvalidStatus"})
        assert rp2.status_code in (400, 422)


# ---------- Reports ----------
class TestReports:
    @pytest.mark.parametrize("rtype", ["weekly", "investigation", "executive"])
    def test_summary_pdf(self, s, rtype):
        r = s.get(f"{API}/reports/summary", params={"report_type": rtype})
        assert r.status_code == 200
        assert "application/pdf" in r.headers.get("content-type", "")
        assert len(r.content) > 1000

    def test_account_pdf(self, s):
        r = s.get(f"{API}/reports/account/LTY-10005")
        assert r.status_code == 200
        assert "application/pdf" in r.headers.get("content-type", "")
        assert len(r.content) > 1000


# ---------- Risk Signals (for ResearchFramework) ----------
class TestRiskSignals:
    def test_signals_endpoint(self, s):
        r = s.get(f"{API}/risk/signals")
        assert r.status_code == 200
