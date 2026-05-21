"""DebtWise iteration 2 tests:
- POST/PUT /api/debts with due_date (YYYY-MM-DD), accepts days > 28
- /api/reminders/upcoming reads due_date AND legacy due_day
- Free debt limit gating returns 402
- PUT /api/profile updates name
- /api/subscription/* endpoints (plans, me, checkout, status, cancel)
- /api/webhook/stripe exists
"""
import os
import uuid
import requests
import pytest

BASE_URL = os.environ.get(
    "REACT_APP_BACKEND_URL", "https://payoff-planner-26.preview.emergentagent.com"
).rstrip("/")
API = f"{BASE_URL}/api"


def _new_email():
    return f"test_{uuid.uuid4().hex[:10]}@example.com"


@pytest.fixture(scope="module")
def user_session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    email = _new_email()
    password = "Passw0rd!"
    r = s.post(f"{API}/auth/register", json={"email": email, "password": password, "name": "Iter2 User"})
    assert r.status_code == 200, r.text
    return s, r.json()


@pytest.fixture(scope="module")
def demo_session():
    """Login as the seeded demo user that already has 3 debts (free tier)."""
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    r = s.post(f"{API}/auth/login", json={"email": "demo@debtwise.app", "password": "Demo@1234"})
    if r.status_code != 200:
        pytest.skip(f"demo user login failed: {r.status_code} {r.text}")
    return s, r.json()


# ----------------------- Due date -----------------------
class TestDebtDueDate:
    def test_create_debt_with_due_date_day_31(self, user_session):
        s, _ = user_session
        payload = {
            "name": "TEST_DueDate31",
            "type": "credit_card",
            "balance": 1000.0,
            "apr": 15.0,
            "min_payment": 25.0,
            "due_date": "2026-03-31",
        }
        r = s.post(f"{API}/debts", json=payload)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["due_date"] == "2026-03-31"
        # GET to verify persistence
        r2 = s.get(f"{API}/debts")
        assert r2.status_code == 200
        match = [d for d in r2.json() if d["debt_id"] == body["debt_id"]]
        assert match and match[0]["due_date"] == "2026-03-31"

    def test_create_debt_with_due_date_day_30(self, user_session):
        s, _ = user_session
        payload = {
            "name": "TEST_DueDate30",
            "type": "personal_loan",
            "balance": 500.0,
            "apr": 8.0,
            "min_payment": 50.0,
            "due_date": "2026-04-30",
        }
        r = s.post(f"{API}/debts", json=payload)
        assert r.status_code == 200, r.text
        assert r.json()["due_date"] == "2026-04-30"

    def test_update_debt_due_date(self, user_session):
        s, _ = user_session
        # find one of our debts
        debts = s.get(f"{API}/debts").json()
        target = [d for d in debts if d["name"] == "TEST_DueDate31"][0]
        upd = {
            "name": target["name"],
            "type": target["type"],
            "balance": target["balance"],
            "apr": target["apr"],
            "min_payment": target["min_payment"],
            "due_date": "2026-05-29",
        }
        r = s.put(f"{API}/debts/{target['debt_id']}", json=upd)
        assert r.status_code == 200, r.text
        assert r.json()["due_date"] == "2026-05-29"
        # verify persisted
        after = s.get(f"{API}/debts").json()
        m = [d for d in after if d["debt_id"] == target["debt_id"]][0]
        assert m["due_date"] == "2026-05-29"

    def test_reminders_use_due_date(self, user_session):
        s, _ = user_session
        r = s.get(f"{API}/reminders/upcoming")
        assert r.status_code == 200, r.text
        rems = r.json()
        # We have debts with due_date 31 (now 29 after update) and 30
        names = {d["name"] for d in rems}
        assert "TEST_DueDate30" in names
        # Ensure sorted by days_until ascending
        days = [x["days_until"] for x in rems]
        assert days == sorted(days)
        # Each must have a YYYY-MM-DD date
        for x in rems:
            assert len(x["due_date"]) == 10 and x["due_date"][4] == "-"


# ----------------------- Free-tier limit -----------------------
class TestFreeLimitGate:
    def test_demo_user_has_3_debts_and_is_free(self, demo_session):
        s, me = demo_session
        debts = s.get(f"{API}/debts").json()
        assert len(debts) >= 3, f"expected demo to have >=3 debts, got {len(debts)}"
        sub = s.get(f"{API}/subscription/me").json()
        assert sub["debt_limit_free"] == 3
        assert sub["premium"] is False

    def test_demo_user_4th_debt_returns_402(self, demo_session):
        s, _ = demo_session
        payload = {
            "name": "TEST_ShouldBeBlocked",
            "type": "other",
            "balance": 100.0,
            "apr": 5.0,
            "min_payment": 10.0,
            "due_date": "2026-06-15",
        }
        r = s.post(f"{API}/debts", json=payload)
        assert r.status_code == 402, r.text
        detail = r.json().get("detail", "")
        assert "Free plan" in detail or "limited" in detail.lower()


# ----------------------- Profile -----------------------
class TestProfile:
    def test_update_profile_name(self, user_session):
        s, _ = user_session
        r = s.put(f"{API}/profile", json={"name": "Renamed Iter2"})
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["name"] == "Renamed Iter2"
        # Verify via /me
        me = s.get(f"{API}/auth/me").json()
        assert me["name"] == "Renamed Iter2"


# ----------------------- Subscription -----------------------
class TestSubscription:
    def test_subscription_plans(self, user_session):
        s, _ = user_session
        r = s.get(f"{API}/subscription/plans")
        assert r.status_code == 200
        data = r.json()
        assert data["monthly"]["amount"] == 5.0
        assert data["annual"]["amount"] == 50.0
        assert data["monthly"]["interval"] == "month"
        assert data["annual"]["interval"] == "year"

    def test_subscription_me_initial(self, user_session):
        s, _ = user_session
        r = s.get(f"{API}/subscription/me")
        assert r.status_code == 200
        data = r.json()
        assert data["premium"] is False
        assert data["plan"] is None
        assert data["debt_limit_free"] == 3

    def test_checkout_monthly_returns_stripe_url(self, user_session):
        s, _ = user_session
        r = s.post(
            f"{API}/subscription/checkout",
            json={"package_id": "monthly", "origin_url": BASE_URL},
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert "url" in body and "session_id" in body
        assert "stripe.com" in body["url"]
        # Poll status
        sid = body["session_id"]
        rs = s.get(f"{API}/subscription/status/{sid}")
        assert rs.status_code == 200, rs.text
        st = rs.json()
        assert "payment_status" in st
        # Status will typically be "unpaid"/"open" since payment not completed
        assert st["payment_status"] in ("unpaid", "paid", "no_payment_required")

    def test_checkout_annual_returns_stripe_url(self, user_session):
        s, _ = user_session
        r = s.post(
            f"{API}/subscription/checkout",
            json={"package_id": "annual", "origin_url": BASE_URL},
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert "stripe.com" in body["url"]

    def test_checkout_invalid_package(self, user_session):
        s, _ = user_session
        r = s.post(
            f"{API}/subscription/checkout",
            json={"package_id": "lifetime", "origin_url": BASE_URL},
        )
        # Pydantic Literal validation -> 422
        assert r.status_code in (400, 422)

    def test_cancel_subscription(self, user_session):
        s, _ = user_session
        r = s.post(f"{API}/subscription/cancel")
        assert r.status_code == 200
        # plan should be None
        me = s.get(f"{API}/subscription/me").json()
        assert me["plan"] is None


# ----------------------- Stripe Webhook -----------------------
class TestWebhook:
    def test_webhook_endpoint_exists(self):
        # POST with empty body, no valid signature — endpoint should swallow error and 200
        r = requests.post(f"{API}/webhook/stripe", data=b"", headers={"Stripe-Signature": "invalid"})
        assert r.status_code == 200
        assert r.json() == {"received": True}
