"""Role/principal abstraction for LoyaltyShield AI.

Authentication is intentionally omitted in this research prototype
(local authorized environment). All requests resolve to a default
Analyst principal. When real auth (JWT / OAuth2 / SSO) is added later,
only `get_current_principal` needs to change — routes already depend
on this abstraction.
"""

from fastapi import Header


ROLES = ("Viewer", "Analyst", "Admin")


def get_current_principal(x_role: str = Header(default="Analyst")) -> dict:
    role = x_role if x_role in ROLES else "Analyst"
    return {"name": "Avery Chen", "role": role, "authenticated": False}
