import json

from sqlalchemy import Boolean, Column, Float, Integer, String, Text

from database import Base


class Account(Base):
    __tablename__ = "accounts"

    id = Column(Integer, primary_key=True, index=True)
    account_id = Column(String, unique=True, index=True)
    loyalty_tier = Column(String)  # Bronze / Silver / Gold / Platinum
    account_age_days = Column(Integer)
    points_balance = Column(Integer)
    country = Column(String)
    last_login_region = Column(String)
    trusted_devices = Column(Integer)
    risk_score = Column(Integer)
    risk_status = Column(String)  # Low / Medium / High
    signals = Column(Text, default="{}")  # JSON of triggered risk signal flags
    days_between_change_and_booking = Column(Integer, nullable=True)
    reviewed = Column(Boolean, default=False)
    created_at = Column(String)  # ISO 8601 UTC

    def to_dict(self):
        return {
            "id": self.id,
            "account_id": self.account_id,
            "loyalty_tier": self.loyalty_tier,
            "account_age_days": self.account_age_days,
            "points_balance": self.points_balance,
            "country": self.country,
            "last_login_region": self.last_login_region,
            "trusted_devices": self.trusted_devices,
            "risk_score": self.risk_score,
            "risk_status": self.risk_status,
            "signals": json.loads(self.signals or "{}"),
            "days_between_change_and_booking": self.days_between_change_and_booking,
            "reviewed": self.reviewed,
            "created_at": self.created_at,
        }


class Event(Base):
    __tablename__ = "events"

    id = Column(Integer, primary_key=True, index=True)
    account_id = Column(String, index=True)
    event_type = Column(String)
    timestamp = Column(String)  # ISO 8601 UTC
    severity = Column(String)  # Low / Medium / High / Critical
    risk_delta = Column(Integer)
    description = Column(Text)

    def to_dict(self):
        return {
            "id": self.id,
            "account_id": self.account_id,
            "event_type": self.event_type,
            "timestamp": self.timestamp,
            "severity": self.severity,
            "risk_delta": self.risk_delta,
            "description": self.description,
        }


class Case(Base):
    __tablename__ = "cases"

    id = Column(Integer, primary_key=True, index=True)
    case_id = Column(String, unique=True, index=True)
    account_id = Column(String, index=True)
    severity = Column(String)  # Low / Medium / High / Critical
    status = Column(String)  # New / Investigating / Escalated / Confirmed Fraud / False Positive / Closed
    assigned_analyst = Column(String)
    summary = Column(Text)
    analyst_notes = Column(Text, default="")
    recommended_action = Column(Text, default="")
    created_at = Column(String)
    updated_at = Column(String)

    def to_dict(self):
        return {
            "id": self.id,
            "case_id": self.case_id,
            "account_id": self.account_id,
            "severity": self.severity,
            "status": self.status,
            "assigned_analyst": self.assigned_analyst,
            "summary": self.summary,
            "analyst_notes": self.analyst_notes,
            "recommended_action": self.recommended_action,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
        }


class ThreatIntel(Base):
    __tablename__ = "threat_intel"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String)
    category = Column(String)
    severity = Column(String)  # Low / Medium / High / Critical
    summary = Column(Text)
    related_signals = Column(Text, default="[]")  # JSON list of signal keys
    ecosystem_tier = Column(Integer)  # 1-4
    created_at = Column(String)

    def to_dict(self):
        return {
            "id": self.id,
            "title": self.title,
            "category": self.category,
            "severity": self.severity,
            "summary": self.summary,
            "related_signals": json.loads(self.related_signals or "[]"),
            "ecosystem_tier": self.ecosystem_tier,
            "created_at": self.created_at,
        }


class Booking(Base):
    __tablename__ = "bookings"

    id = Column(Integer, primary_key=True, index=True)
    account_id = Column(String, index=True)
    guest_name = Column(String)
    property_name = Column(String)
    booking_date = Column(String)  # ISO 8601 date
    points_used = Column(Integer)
    suspicious = Column(Boolean, default=False)


class AccountDevice(Base):
    __tablename__ = "account_devices"

    id = Column(Integer, primary_key=True, index=True)
    account_id = Column(String, index=True)
    device_id = Column(String, index=True)
    ip_address = Column(String, index=True)
    suspicious = Column(Boolean, default=False)


class Cluster(Base):
    __tablename__ = "clusters"

    id = Column(Integer, primary_key=True, index=True)
    cluster_id = Column(String, unique=True, index=True)
    cluster_type = Column(String)
    description = Column(Text)
    severity = Column(String)
    account_ids = Column(Text, default="[]")  # JSON list

    def to_dict(self):
        return {
            "cluster_id": self.cluster_id,
            "cluster_type": self.cluster_type,
            "description": self.description,
            "severity": self.severity,
            "account_ids": json.loads(self.account_ids or "[]"),
        }
