"""DebtWise iteration 3 backend tests:
- Strict due_date validation (rejects 2026-02-31)
- Accepts 2026-03-31 and returns YYYY-MM-DD
- PUT /api/profile accepts phone/notify_email/notify_sms, normalizes phone
- POST /api/reminders/test no-ops gracefully when keys are empty
- /api/strategies/calculate with custom + per_debt_extra differs from no per_debt_extra
"""
import os
import uuid
import requests
import pytest

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://payoff-planner-26.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"


def _new_email():
    return f"test_{uuid.uuid4().hex[:10]}@example.com"


@pytest.fixture(scope="module")
def user_session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    email = _new_email()
    r = s.post(f"{API}/auth/register",
               json={"email": email, "password": "Passw0rd!", "name": "Iter3 User"})
    assert r.status_code == 200, r.text
    return s, r.json()


@pytest.fixture(scope="module")
def demo_session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    r = s.post(f"{API}/auth/login",
               json={"email": "demo@debtwise.app", "password": "Demo@1234"})
    if r.status_code != 200:
        pytest.skip(f"demo login failed: {r.status_code} {r.text}")
    return s, r.json()


# --------------- Strict due_date validation ---------------
class TestDueDateValidation:
    def test_invalid_due_date_feb_31_rejected(self, user_session):
        s, _ = user_session
        payload = {
            "name": "TEST_BadDate",
            "type": "credit_card",
            "balance": 500.0,
            "apr": 12.0,
            "min_payment": 25.0,
            "due_date": "2026-02-31",
        }
        r = s.post(f"{API}/debts", json=payload)
        assert r.status_code == 422, f"Expected 422, got {r.status_code}: {r.text}"

    def test_valid_due_date_mar_31_accepted_and_round_trips(self, user_session):
        s, _ = user_session
        payload = {
            "name": f"TEST_Mar31_{uuid.uuid4().hex[:6]}",
            "type": "credit_card",
            "balance": 500.0,
            "apr": 12.0,
            "min_payment": 25.0,
            "due_date": "2026-03-31",
        }
        r = s.post(f"{API}/debts", json=payload)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["due_date"] == "2026-03-31"
        assert isinstance(body["due_date"], str)
        # verify via GET
        debts = s.get(f"{API}/debts").json()
        match = [d for d in debts if d["debt_id"] == body["debt_id"]]
        assert match and match[0]["due_date"] == "2026-03-31"


# --------------- Profile phone + toggles ---------------
class TestProfileNotifications:
    def test_update_profile_phone_normalization(self, user_session):
        s, _ = user_session
        r = s.put(f"{API}/profile",
                  json={"phone": "+1 (555) 987-6543", "notify_email": True, "notify_sms": True})
        assert r.status_code == 200, r.text
        data = r.json()
        # Normalized: only + and digits
        assert data["phone"] == "+15559876543", f"got {data['phone']}"
        assert data["notify_email"] is True
        assert data["notify_sms"] is True
        # Verify persistence
        me = s.get(f"{API}/auth/me").json()
        assert me["phone"] == "+15559876543"
        assert me["notify_email"] is True
        assert me["notify_sms"] is True

    def test_update_profile_toggle_off(self, user_session):
        s, _ = user_session
        r = s.put(f"{API}/profile", json={"notify_sms": False})
        assert r.status_code == 200
        assert r.json()["notify_sms"] is False
        # notify_email should remain True
        assert r.json()["notify_email"] is True


# --------------- Reminder test endpoint (no-op channels) ---------------
class TestReminderTest:
    def test_reminders_test_noop_when_keys_missing(self, user_session):
        s, _ = user_session
        # Ensure notifications enabled & phone set
        s.put(f"{API}/profile", json={"phone": "+15551234567", "notify_email": True, "notify_sms": True})
        r = s.post(f"{API}/reminders/test")
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["email_configured"] is False, "Expect email no-op since RESEND_API_KEY empty"
        assert data["sms_configured"] is False, "Expect sms no-op since TWILIO_* empty"
        actions = data["actions"]
        assert "email" in actions and "sms" in actions
        assert actions["email"]["sent"] is False
        assert "reason" in actions["email"]
        assert actions["sms"]["sent"] is False
        assert "reason" in actions["sms"]

    def test_reminders_test_does_not_500(self, user_session):
        s, _ = user_session
        r = s.post(f"{API}/reminders/test")
        assert r.status_code != 500


# --------------- Custom strategy with per_debt_extra ---------------
class TestCustomStrategy:
    def test_custom_with_per_debt_extra_differs(self, demo_session):
        s, _ = demo_session
        debts = s.get(f"{API}/debts").json()
        assert len(debts) >= 2, "demo needs >=2 debts for this test"
        debt_ids = [d["debt_id"] for d in debts][:3]
        # Baseline: custom, no per_debt_extra, $0 extra
        r1 = s.post(f"{API}/strategies/calculate",
                    json={"strategy": "custom", "extra_payment": 0,
                          "custom_order": debt_ids})
        assert r1.status_code == 200, r1.text
        base = r1.json()
        # With per_debt_extra of $50 on first debt
        r2 = s.post(f"{API}/strategies/calculate",
                    json={"strategy": "custom", "extra_payment": 0,
                          "custom_order": debt_ids,
                          "per_debt_extra": {debt_ids[0]: 50.0}})
        assert r2.status_code == 200, r2.text
        with_extra = r2.json()
        # With extra payments, months should be <= baseline and interest <= baseline
        assert with_extra["months"] <= base["months"], \
            f"expected shorter/equal payoff with per_debt_extra: {with_extra['months']} vs {base['months']}"
        # At least one of months or total_interest must improve
        assert (with_extra["months"] < base["months"]
                or with_extra["total_interest"] < base["total_interest"]), \
            "per_debt_extra had no effect"
        assert with_extra["strategy"] == "custom"

    def test_custom_strategy_response_structure(self, demo_session):
        s, _ = demo_session
        debts = s.get(f"{API}/debts").json()
        debt_ids = [d["debt_id"] for d in debts]
        r = s.post(f"{API}/strategies/calculate",
                   json={"strategy": "custom", "extra_payment": 0,
                         "custom_order": debt_ids,
                         "per_debt_extra": {debt_ids[0]: 25.0}})
        assert r.status_code == 200
        data = r.json()
        for k in ("months", "total_interest", "total_paid", "schedule", "per_debt", "strategy"):
            assert k in data
        assert len(data["schedule"]) == data["months"]


# --------------- Reminder loop doesn't crash app ---------------
class TestServerHealth:
    def test_root_alive(self):
        r = requests.get(f"{API}/")
        assert r.status_code == 200
        assert r.json().get("ok") is True
