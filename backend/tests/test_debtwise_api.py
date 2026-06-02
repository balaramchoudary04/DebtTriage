"""DebtWise backend API tests (pytest).

Covers: auth (register/login/me/logout), Google OAuth session 401, debts CRUD,
strategies calculate + compare, reminders, brute force lockout.
"""
import os
import time
import uuid
import requests
import pytest

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://payoff-planner-26.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"


def _new_email():
    return f"test_{uuid.uuid4().hex[:10]}@example.com"


@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def registered_user(session):
    email = _new_email()
    password = "Passw0rd!"
    r = session.post(f"{API}/auth/register", json={"email": email, "password": password, "name": "Test User"})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["email"] == email
    assert body["name"] == "Test User"
    assert body["auth_provider"] == "email"
    assert "user_id" in body
    # httpOnly cookies should be set
    assert "access_token" in session.cookies, f"access_token cookie missing: {session.cookies}"
    assert "refresh_token" in session.cookies
    return {"email": email, "password": password, "user": body}


# ---------------- Health ----------------
def test_health_root():
    r = requests.get(f"{API}/")
    assert r.status_code == 200
    assert r.json().get("ok") is True


# ---------------- Auth ----------------
class TestAuth:
    def test_register_sets_cookies(self, registered_user):
        assert registered_user["user"]["user_id"].startswith("user_")

    def test_register_duplicate_email_400(self, session, registered_user):
        r = session.post(f"{API}/auth/register", json={
            "email": registered_user["email"], "password": "Passw0rd!", "name": "Dup"
        })
        assert r.status_code == 400

    def test_me_returns_user(self, session, registered_user):
        r = session.get(f"{API}/auth/me")
        assert r.status_code == 200
        assert r.json()["email"] == registered_user["email"]

    def test_me_unauthorized_without_cookies(self):
        r = requests.get(f"{API}/auth/me")
        assert r.status_code == 401

    def test_login_success(self, registered_user):
        s = requests.Session()
        r = s.post(f"{API}/auth/login", json={
            "email": registered_user["email"], "password": registered_user["password"]
        })
        assert r.status_code == 200
        assert "access_token" in s.cookies
        # Verify me works with these cookies
        r2 = s.get(f"{API}/auth/me")
        assert r2.status_code == 200
        assert r2.json()["email"] == registered_user["email"]

    def test_login_invalid_credentials_401(self):
        s = requests.Session()
        r = s.post(f"{API}/auth/login", json={
            "email": "nonexistent_xyz@example.com", "password": "wrongpass"
        })
        assert r.status_code == 401

    def test_logout_clears_cookies(self, registered_user):
        s = requests.Session()
        s.post(f"{API}/auth/login", json={
            "email": registered_user["email"], "password": registered_user["password"]
        })
        assert s.cookies.get("access_token")
        r = s.post(f"{API}/auth/logout")
        assert r.status_code == 200
        # After logout, /me should fail
        r2 = s.get(f"{API}/auth/me")
        assert r2.status_code == 401

    def test_oauth_session_invalid_returns_401(self):
        # Should NOT 500 on bad session_id; gracefully returns 401
        r = requests.post(f"{API}/auth/session", json={"session_id": "invalid_session_xyz_123"})
        assert r.status_code == 401, f"Expected 401, got {r.status_code}: {r.text}"

    def test_oauth_session_missing_field_422(self):
        r = requests.post(f"{API}/auth/session", json={})
        assert r.status_code == 422

    def test_brute_force_lockout(self):
        """After 5 failed attempts -> 429."""
        s = requests.Session()
        email = _new_email()
        # Register a real user first
        s.post(f"{API}/auth/register", json={"email": email, "password": "RealPass1!", "name": "BF Test"})
        # Now hit /login with wrong password 5 times from a fresh session
        s2 = requests.Session()
        codes = []
        for _ in range(6):
            r = s2.post(f"{API}/auth/login", json={"email": email, "password": "wrong"})
            codes.append(r.status_code)
        # First 5 should be 401, 6th should be 429
        assert codes[:5] == [401, 401, 401, 401, 401], f"Got {codes}"
        assert codes[5] == 429, f"Expected lockout on 6th, got {codes}"


# ---------------- Debts CRUD ----------------
@pytest.fixture(scope="module")
def auth_session(registered_user):
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json={
        "email": registered_user["email"], "password": registered_user["password"]
    })
    assert r.status_code == 200
    return s


class TestDebts:
    def test_list_debts_requires_auth(self):
        r = requests.get(f"{API}/debts")
        assert r.status_code == 401

    def test_create_list_update_delete(self, auth_session):
        # Create
        payload = {
            "name": "TEST_CreditCard",
            "type": "credit_card",
            "balance": 5000.0,
            "apr": 22.5,
            "min_payment": 150.0,
            "due_date": "2026-06-15",
        }
        r = auth_session.post(f"{API}/debts", json=payload)
        assert r.status_code == 200, r.text
        debt = r.json()
        assert debt["name"] == "TEST_CreditCard"
        assert debt["balance"] == 5000.0
        assert debt["debt_id"].startswith("debt_")
        debt_id = debt["debt_id"]

        # List
        r = auth_session.get(f"{API}/debts")
        assert r.status_code == 200
        items = r.json()
        assert any(d["debt_id"] == debt_id for d in items)

        # Update
        payload["balance"] = 4500.0
        payload["name"] = "TEST_CreditCard_Updated"
        r = auth_session.put(f"{API}/debts/{debt_id}", json=payload)
        assert r.status_code == 200
        assert r.json()["balance"] == 4500.0
        assert r.json()["name"] == "TEST_CreditCard_Updated"

        # Delete
        r = auth_session.delete(f"{API}/debts/{debt_id}")
        assert r.status_code == 200
        # Confirm gone
        r = auth_session.get(f"{API}/debts")
        assert not any(d["debt_id"] == debt_id for d in r.json())

    def test_update_nonexistent_404(self, auth_session):
        r = auth_session.put(f"{API}/debts/debt_does_not_exist", json={
            "name": "x", "type": "other", "balance": 100, "apr": 5, "min_payment": 10
        })
        assert r.status_code == 404

    def test_delete_nonexistent_404(self, auth_session):
        r = auth_session.delete(f"{API}/debts/debt_does_not_exist")
        assert r.status_code == 404

    def test_validation_negative_balance(self, auth_session):
        r = auth_session.post(f"{API}/debts", json={
            "name": "Bad", "type": "credit_card", "balance": -100, "apr": 10, "min_payment": 10
        })
        assert r.status_code == 422

    def test_user_scoped(self, registered_user, auth_session):
        # Create a debt as user A
        r = auth_session.post(f"{API}/debts", json={
            "name": "TEST_UserA", "type": "credit_card", "balance": 100, "apr": 5, "min_payment": 10
        })
        debt_id = r.json()["debt_id"]
        # Register user B
        s_b = requests.Session()
        email_b = _new_email()
        s_b.post(f"{API}/auth/register", json={"email": email_b, "password": "Passw0rd!", "name": "B"})
        # User B sees no debts
        r2 = s_b.get(f"{API}/debts")
        assert r2.status_code == 200
        assert not any(d["debt_id"] == debt_id for d in r2.json())
        # User B can't delete A's debt
        r3 = s_b.delete(f"{API}/debts/{debt_id}")
        assert r3.status_code == 404
        # Cleanup
        auth_session.delete(f"{API}/debts/{debt_id}")


# ---------------- Strategies ----------------
@pytest.fixture(scope="module")
def seeded_debts(auth_session):
    debts = []
    payloads = [
        {"name": "TEST_CC1", "type": "credit_card", "balance": 5000, "apr": 22.0, "min_payment": 150, "due_date": "2026-06-10"},
        {"name": "TEST_CC2", "type": "credit_card", "balance": 1500, "apr": 18.0, "min_payment": 50, "due_date": "2026-06-20"},
        {"name": "TEST_Car", "type": "car_loan", "balance": 12000, "apr": 6.5, "min_payment": 280, "due_date": "2026-06-05"},
    ]
    for p in payloads:
        r = auth_session.post(f"{API}/debts", json=p)
        debts.append(r.json())
    yield debts
    for d in debts:
        auth_session.delete(f"{API}/debts/{d['debt_id']}")


class TestStrategies:
    def test_calculate_avalanche(self, auth_session, seeded_debts):
        r = auth_session.post(f"{API}/strategies/calculate", json={"strategy": "avalanche", "extra_payment": 200})
        assert r.status_code == 200, r.text
        body = r.json()
        for k in ["months", "total_interest", "total_paid", "payoff_date", "schedule", "per_debt"]:
            assert k in body
        assert body["months"] > 0
        assert body["total_interest"] >= 0
        assert len(body["schedule"]) == body["months"]
        assert len(body["per_debt"]) == 3

    def test_calculate_snowball(self, auth_session, seeded_debts):
        r = auth_session.post(f"{API}/strategies/calculate", json={"strategy": "snowball", "extra_payment": 0})
        assert r.status_code == 200
        assert r.json()["months"] > 0

    def test_calculate_highest_payment(self, auth_session, seeded_debts):
        r = auth_session.post(f"{API}/strategies/calculate", json={"strategy": "highest_payment", "extra_payment": 100})
        assert r.status_code == 200
        assert r.json()["months"] > 0

    def test_calculate_custom(self, auth_session, seeded_debts):
        order = [d["debt_id"] for d in seeded_debts]
        r = auth_session.post(f"{API}/strategies/calculate", json={
            "strategy": "custom", "extra_payment": 50, "custom_order": order
        })
        assert r.status_code == 200
        assert r.json()["months"] > 0

    def test_avalanche_less_interest_than_min_only(self, auth_session, seeded_debts):
        r0 = auth_session.post(f"{API}/strategies/calculate", json={"strategy": "avalanche", "extra_payment": 0}).json()
        r1 = auth_session.post(f"{API}/strategies/calculate", json={"strategy": "avalanche", "extra_payment": 500}).json()
        # With extra payment, total interest should be lower
        assert r1["total_interest"] < r0["total_interest"]
        assert r1["months"] <= r0["months"]

    def test_compare(self, auth_session, seeded_debts):
        r = auth_session.post(f"{API}/strategies/compare?extra_payment=100")
        assert r.status_code == 200
        body = r.json()
        assert set(body["strategies"].keys()) == {"avalanche", "snowball", "highest_payment"}
        for s, v in body["strategies"].items():
            assert v["months"] > 0


# ---------------- Reminders ----------------
class TestReminders:
    def test_upcoming_returns_sorted(self, auth_session, seeded_debts):
        r = auth_session.get(f"{API}/reminders/upcoming")
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        # All seeded debts have due_day -> should appear
        names = {x["name"] for x in data}
        assert {"TEST_CC1", "TEST_CC2", "TEST_Car"}.issubset(names)
        # Sorted ascending by days_until
        days = [x["days_until"] for x in data]
        assert days == sorted(days)
