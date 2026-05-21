from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

import os
import uuid
import logging
import secrets
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Literal

import bcrypt
import jwt
import httpx
from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, Depends
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr, ConfigDict
from emergentintegrations.payments.stripe.checkout import (
    StripeCheckout,
    CheckoutSessionRequest,
)

# ============================================================
# Setup
# ============================================================
mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

JWT_ALGORITHM = "HS256"
JWT_SECRET = os.environ["JWT_SECRET"]
FRONTEND_URL = os.environ.get("FRONTEND_URL", "http://localhost:3000")

app = FastAPI(title="DebtWise API")
api_router = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s - %(message)s")
logger = logging.getLogger("debtwise")


# ============================================================
# Models
# ============================================================
class UserPublic(BaseModel):
    model_config = ConfigDict(extra="ignore")
    user_id: str
    email: str
    name: str
    picture: Optional[str] = None
    auth_provider: str = "email"
    role: str = "user"
    premium_until: Optional[str] = None
    plan: Optional[str] = None  # "monthly" | "annual" | None


class SubscriptionCheckoutPayload(BaseModel):
    package_id: Literal["monthly", "annual"]
    origin_url: str


SUBSCRIPTION_PACKAGES = {
    "monthly": {"amount": 5.00, "currency": "usd", "days": 30, "label": "Monthly"},
    "annual": {"amount": 50.00, "currency": "usd", "days": 365, "label": "Annual"},
}

FREE_DEBT_LIMIT = 3


def is_premium(user: dict) -> bool:
    pu = user.get("premium_until")
    if not pu:
        return False
    if isinstance(pu, str):
        try:
            pu = datetime.fromisoformat(pu)
        except ValueError:
            return False
    if pu.tzinfo is None:
        pu = pu.replace(tzinfo=timezone.utc)
    return pu > datetime.now(timezone.utc)


class RegisterPayload(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)
    name: str = Field(min_length=1, max_length=80)


class LoginPayload(BaseModel):
    email: EmailStr
    password: str


class SessionPayload(BaseModel):
    session_id: str


DebtType = Literal["credit_card", "personal_loan", "car_loan", "student_loan", "mortgage", "medical", "other"]


class DebtPayload(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    type: DebtType
    balance: float = Field(gt=0)
    apr: float = Field(ge=0, le=100)
    min_payment: float = Field(ge=0)
    due_date: Optional[str] = Field(default=None, description="ISO date YYYY-MM-DD")


class Debt(DebtPayload):
    debt_id: str
    user_id: str
    created_at: str


class StrategyRequest(BaseModel):
    strategy: Literal["avalanche", "snowball", "highest_payment", "custom"]
    extra_payment: float = Field(default=0, ge=0)
    custom_order: Optional[List[str]] = None  # list of debt_ids in priority


# ============================================================
# Auth helpers
# ============================================================
def hash_password(p: str) -> str:
    return bcrypt.hashpw(p.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(p: str, h: str) -> bool:
    try:
        return bcrypt.checkpw(p.encode("utf-8"), h.encode("utf-8"))
    except Exception:
        return False


def create_access_token(user_id: str, email: str) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "exp": datetime.now(timezone.utc) + timedelta(minutes=60 * 24),
        "type": "access",
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def create_refresh_token(user_id: str) -> str:
    payload = {
        "sub": user_id,
        "exp": datetime.now(timezone.utc) + timedelta(days=7),
        "type": "refresh",
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def set_auth_cookies(response: Response, access: str, refresh: str):
    response.set_cookie("access_token", access, httponly=True, secure=True, samesite="none", max_age=60 * 60 * 24, path="/")
    response.set_cookie("refresh_token", refresh, httponly=True, secure=True, samesite="none", max_age=60 * 60 * 24 * 7, path="/")


def clear_auth_cookies(response: Response):
    response.delete_cookie("access_token", path="/")
    response.delete_cookie("refresh_token", path="/")
    response.delete_cookie("session_token", path="/")


async def get_current_user(request: Request) -> dict:
    # Try JWT first
    token = request.cookies.get("access_token")
    if not token:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]

    if token:
        try:
            payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
            if payload.get("type") == "access":
                user = await db.users.find_one({"user_id": payload["sub"]}, {"_id": 0, "password_hash": 0})
                if user:
                    return user
        except jwt.PyJWTError:
            pass

    # Try Emergent OAuth session
    session_token = request.cookies.get("session_token")
    if not session_token:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            session_token = auth_header[7:]

    if session_token:
        sess = await db.user_sessions.find_one({"session_token": session_token}, {"_id": 0})
        if sess:
            expires_at = sess["expires_at"]
            if isinstance(expires_at, str):
                expires_at = datetime.fromisoformat(expires_at)
            if expires_at.tzinfo is None:
                expires_at = expires_at.replace(tzinfo=timezone.utc)
            if expires_at >= datetime.now(timezone.utc):
                user = await db.users.find_one({"user_id": sess["user_id"]}, {"_id": 0, "password_hash": 0})
                if user:
                    return user

    raise HTTPException(status_code=401, detail="Not authenticated")


# ============================================================
# Auth Endpoints
# ============================================================
@api_router.post("/auth/register")
async def register(payload: RegisterPayload, response: Response):
    email = payload.email.lower()
    existing = await db.users.find_one({"email": email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    user_id = f"user_{uuid.uuid4().hex[:12]}"
    doc = {
        "user_id": user_id,
        "email": email,
        "password_hash": hash_password(payload.password),
        "name": payload.name,
        "picture": None,
        "auth_provider": "email",
        "role": "user",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.users.insert_one(doc)

    access = create_access_token(user_id, email)
    refresh = create_refresh_token(user_id)
    set_auth_cookies(response, access, refresh)

    return UserPublic(**doc).model_dump()


@api_router.post("/auth/login")
async def login(payload: LoginPayload, request: Request, response: Response):
    email = payload.email.lower()
    ip = request.client.host if request.client else "unknown"
    identifier = f"{ip}:{email}"

    attempts_doc = await db.login_attempts.find_one({"identifier": identifier}, {"_id": 0})
    if attempts_doc and attempts_doc.get("count", 0) >= 5:
        locked_until = attempts_doc.get("locked_until")
        if locked_until:
            if isinstance(locked_until, str):
                locked_until = datetime.fromisoformat(locked_until)
            if locked_until.tzinfo is None:
                locked_until = locked_until.replace(tzinfo=timezone.utc)
            if locked_until > datetime.now(timezone.utc):
                raise HTTPException(status_code=429, detail="Too many failed attempts. Try again later.")

    user = await db.users.find_one({"email": email})
    if not user or not user.get("password_hash") or not verify_password(payload.password, user["password_hash"]):
        await db.login_attempts.update_one(
            {"identifier": identifier},
            {
                "$inc": {"count": 1},
                "$set": {"locked_until": (datetime.now(timezone.utc) + timedelta(minutes=15)).isoformat()},
            },
            upsert=True,
        )
        raise HTTPException(status_code=401, detail="Invalid credentials")

    await db.login_attempts.delete_one({"identifier": identifier})

    access = create_access_token(user["user_id"], email)
    refresh = create_refresh_token(user["user_id"])
    set_auth_cookies(response, access, refresh)

    return UserPublic(**user).model_dump()


@api_router.post("/auth/logout")
async def logout(request: Request, response: Response):
    session_token = request.cookies.get("session_token")
    if session_token:
        await db.user_sessions.delete_one({"session_token": session_token})
    clear_auth_cookies(response)
    return {"ok": True}


@api_router.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    return UserPublic(**user).model_dump()


@api_router.post("/auth/session")
async def emergent_session(payload: SessionPayload, response: Response):
    """Exchange Emergent session_id for a session_token cookie."""
    async with httpx.AsyncClient(timeout=10) as hx:
        r = await hx.get(
            "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
            headers={"X-Session-ID": payload.session_id},
        )
        if r.status_code != 200:
            raise HTTPException(status_code=401, detail="Invalid session")
        data = r.json()

    email = data["email"].lower()
    user = await db.users.find_one({"email": email}, {"_id": 0})
    if not user:
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        user = {
            "user_id": user_id,
            "email": email,
            "name": data.get("name") or email.split("@")[0],
            "picture": data.get("picture"),
            "auth_provider": "google",
            "role": "user",
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        await db.users.insert_one(user)
    else:
        await db.users.update_one(
            {"user_id": user["user_id"]},
            {"$set": {"picture": data.get("picture"), "name": user.get("name") or data.get("name")}},
        )

    session_token = data["session_token"]
    expires_at = datetime.now(timezone.utc) + timedelta(days=7)
    await db.user_sessions.insert_one(
        {
            "session_token": session_token,
            "user_id": user["user_id"],
            "expires_at": expires_at.isoformat(),
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
    )
    response.set_cookie("session_token", session_token, httponly=True, secure=True, samesite="none", max_age=60 * 60 * 24 * 7, path="/")
    return UserPublic(**user).model_dump()


# ============================================================
# Debts CRUD
# ============================================================
@api_router.get("/debts")
async def list_debts(user: dict = Depends(get_current_user)) -> List[dict]:
    cursor = db.debts.find({"user_id": user["user_id"]}, {"_id": 0})
    items = await cursor.to_list(length=1000)
    return items


@api_router.post("/debts")
async def create_debt(payload: DebtPayload, user: dict = Depends(get_current_user)):
    if not is_premium(user):
        count = await db.debts.count_documents({"user_id": user["user_id"]})
        if count >= FREE_DEBT_LIMIT:
            raise HTTPException(
                status_code=402,
                detail=f"Free plan is limited to {FREE_DEBT_LIMIT} debts. Upgrade to Premium for unlimited debts.",
            )
    debt = {
        "debt_id": f"debt_{uuid.uuid4().hex[:12]}",
        "user_id": user["user_id"],
        "created_at": datetime.now(timezone.utc).isoformat(),
        **payload.model_dump(),
    }
    await db.debts.insert_one(debt)
    debt.pop("_id", None)
    return debt


@api_router.put("/debts/{debt_id}")
async def update_debt(debt_id: str, payload: DebtPayload, user: dict = Depends(get_current_user)):
    res = await db.debts.update_one(
        {"debt_id": debt_id, "user_id": user["user_id"]},
        {"$set": payload.model_dump()},
    )
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Debt not found")
    debt = await db.debts.find_one({"debt_id": debt_id}, {"_id": 0})
    return debt


@api_router.delete("/debts/{debt_id}")
async def delete_debt(debt_id: str, user: dict = Depends(get_current_user)):
    res = await db.debts.delete_one({"debt_id": debt_id, "user_id": user["user_id"]})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Debt not found")
    return {"ok": True}


# ============================================================
# Strategy Engine
# ============================================================
def simulate_strategy(debts: List[dict], strategy: str, extra_payment: float, custom_order: Optional[List[str]] = None):
    """Simulate month-by-month payoff. Returns schedule & summary."""
    debts = [dict(d) for d in debts if d["balance"] > 0]
    if not debts:
        return {"months": 0, "total_interest": 0.0, "total_paid": 0.0, "payoff_date": None, "schedule": [], "per_debt": []}

    # Initial copies
    state = {d["debt_id"]: {**d, "remaining": d["balance"], "paid_total": 0.0, "interest_total": 0.0, "payoff_month": None} for d in debts}

    def priority_order():
        active = [d for d in state.values() if d["remaining"] > 0.01]
        if strategy == "avalanche":
            return sorted(active, key=lambda x: (-x["apr"], -x["balance"]))
        if strategy == "snowball":
            return sorted(active, key=lambda x: (x["remaining"], -x["apr"]))
        if strategy == "highest_payment":
            return sorted(active, key=lambda x: (-x["min_payment"], -x["apr"]))
        if strategy == "custom" and custom_order:
            order = {dbt_id: i for i, dbt_id in enumerate(custom_order)}
            return sorted(active, key=lambda x: order.get(x["debt_id"], 9999))
        return active

    schedule = []
    month = 0
    max_months = 600  # 50 years cap
    while any(s["remaining"] > 0.01 for s in state.values()) and month < max_months:
        month += 1
        # Apply interest
        for s in state.values():
            if s["remaining"] > 0:
                interest = s["remaining"] * (s["apr"] / 100 / 12)
                s["remaining"] += interest
                s["interest_total"] += interest

        # Pay minimums
        pool = extra_payment
        for s in state.values():
            if s["remaining"] > 0:
                pay = min(s["min_payment"], s["remaining"])
                s["remaining"] -= pay
                s["paid_total"] += pay
            else:
                pool += s["min_payment"]  # freed minimum rolls into pool (snowball effect)

        # Apply extra/freed funds in priority order
        for s in priority_order():
            if pool <= 0:
                break
            pay = min(pool, s["remaining"])
            s["remaining"] -= pay
            s["paid_total"] += pay
            pool -= pay

        # Record payoff months
        for s in state.values():
            if s["remaining"] <= 0.01 and s["payoff_month"] is None:
                s["payoff_month"] = month
                s["remaining"] = 0

        total_remaining = sum(s["remaining"] for s in state.values())
        schedule.append({
            "month": month,
            "total_remaining": round(total_remaining, 2),
        })

    total_interest = sum(s["interest_total"] for s in state.values())
    total_paid = sum(s["paid_total"] for s in state.values())

    payoff_date = (datetime.now(timezone.utc) + timedelta(days=30 * month)).strftime("%b %Y") if month > 0 else None

    return {
        "months": month,
        "total_interest": round(total_interest, 2),
        "total_paid": round(total_paid, 2),
        "payoff_date": payoff_date,
        "schedule": schedule,
        "per_debt": [
            {
                "debt_id": s["debt_id"],
                "name": s["name"],
                "payoff_month": s["payoff_month"],
                "interest_paid": round(s["interest_total"], 2),
                "total_paid": round(s["paid_total"], 2),
            }
            for s in state.values()
        ],
    }


@api_router.post("/strategies/calculate")
async def calculate_strategy(req: StrategyRequest, user: dict = Depends(get_current_user)):
    debts = await db.debts.find({"user_id": user["user_id"]}, {"_id": 0}).to_list(length=1000)
    result = simulate_strategy(debts, req.strategy, req.extra_payment, req.custom_order)
    result["strategy"] = req.strategy
    result["extra_payment"] = req.extra_payment
    return result


@api_router.post("/strategies/compare")
async def compare_strategies(extra_payment: float = 0, user: dict = Depends(get_current_user)):
    debts = await db.debts.find({"user_id": user["user_id"]}, {"_id": 0}).to_list(length=1000)
    results = {}
    for s in ["avalanche", "snowball", "highest_payment"]:
        results[s] = simulate_strategy(debts, s, extra_payment)
    return {"strategies": results, "extra_payment": extra_payment}


# ============================================================
# Reminders
# ============================================================
@api_router.get("/reminders/upcoming")
async def upcoming_reminders(user: dict = Depends(get_current_user)):
    debts = await db.debts.find({"user_id": user["user_id"]}, {"_id": 0}).to_list(length=1000)
    today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    reminders = []
    for d in debts:
        # Prefer new due_date (YYYY-MM-DD). Fallback to legacy due_day.
        due_day = None
        due_iso = d.get("due_date")
        if due_iso:
            try:
                parsed = datetime.fromisoformat(due_iso).replace(tzinfo=timezone.utc)
                due_day = parsed.day
            except ValueError:
                due_day = None
        if due_day is None and d.get("due_day"):
            due_day = int(d["due_day"])
        if not due_day:
            continue

        year, month = today.year, today.month
        # Clamp to last valid day of month (handle Feb / 30-day months)
        import calendar
        last_day = calendar.monthrange(year, month)[1]
        target_day = min(due_day, last_day)
        due = today.replace(year=year, month=month, day=target_day)
        if due < today:
            if month == 12:
                year, month = year + 1, 1
            else:
                month += 1
            last_day = calendar.monthrange(year, month)[1]
            target_day = min(due_day, last_day)
            due = today.replace(year=year, month=month, day=target_day)
        days_until = (due - today).days
        reminders.append({
            "debt_id": d["debt_id"],
            "name": d["name"],
            "type": d["type"],
            "min_payment": d["min_payment"],
            "due_date": due.strftime("%Y-%m-%d"),
            "days_until": days_until,
        })
    reminders.sort(key=lambda x: x["days_until"])
    return reminders


# ============================================================
# Subscription / Stripe
# ============================================================
class ProfileUpdatePayload(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=80)


@api_router.put("/profile")
async def update_profile(payload: ProfileUpdatePayload, user: dict = Depends(get_current_user)):
    updates = {}
    if payload.name is not None:
        updates["name"] = payload.name
    if updates:
        await db.users.update_one({"user_id": user["user_id"]}, {"$set": updates})
    refreshed = await db.users.find_one(
        {"user_id": user["user_id"]}, {"_id": 0, "password_hash": 0}
    )
    return UserPublic(**refreshed).model_dump()


@api_router.get("/subscription/plans")
async def subscription_plans():
    return {
        "monthly": {"amount": 5.00, "currency": "usd", "label": "Monthly", "interval": "month"},
        "annual": {"amount": 50.00, "currency": "usd", "label": "Annual", "interval": "year"},
    }


@api_router.get("/subscription/me")
async def my_subscription(user: dict = Depends(get_current_user)):
    return {
        "premium": is_premium(user),
        "premium_until": user.get("premium_until"),
        "plan": user.get("plan"),
        "debt_limit_free": FREE_DEBT_LIMIT,
    }


def _stripe_client(request: Request) -> StripeCheckout:
    api_key = os.environ.get("STRIPE_API_KEY", "sk_test_emergent")
    host_url = str(request.base_url)
    webhook_url = f"{host_url.rstrip('/')}/api/webhook/stripe"
    return StripeCheckout(api_key=api_key, webhook_url=webhook_url)


@api_router.post("/subscription/checkout")
async def subscription_checkout(
    payload: SubscriptionCheckoutPayload,
    request: Request,
    user: dict = Depends(get_current_user),
):
    pkg = SUBSCRIPTION_PACKAGES.get(payload.package_id)
    if not pkg:
        raise HTTPException(status_code=400, detail="Invalid package")

    origin = payload.origin_url.rstrip("/")
    success_url = f"{origin}/settings?session_id={{CHECKOUT_SESSION_ID}}"
    cancel_url = f"{origin}/settings?subscription=cancelled"

    sc = _stripe_client(request)
    req = CheckoutSessionRequest(
        amount=pkg["amount"],
        currency=pkg["currency"],
        success_url=success_url,
        cancel_url=cancel_url,
        metadata={
            "user_id": user["user_id"],
            "email": user["email"],
            "package_id": payload.package_id,
            "days": str(pkg["days"]),
        },
    )
    session = await sc.create_checkout_session(req)

    await db.payment_transactions.insert_one(
        {
            "session_id": session.session_id,
            "user_id": user["user_id"],
            "email": user["email"],
            "package_id": payload.package_id,
            "amount": pkg["amount"],
            "currency": pkg["currency"],
            "days": pkg["days"],
            "payment_status": "initiated",
            "status": "open",
            "metadata": req.metadata,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
    )

    return {"url": session.url, "session_id": session.session_id}


@api_router.get("/subscription/status/{session_id}")
async def subscription_status(
    session_id: str, request: Request, user: dict = Depends(get_current_user)
):
    txn = await db.payment_transactions.find_one(
        {"session_id": session_id, "user_id": user["user_id"]}, {"_id": 0}
    )
    if not txn:
        raise HTTPException(status_code=404, detail="Transaction not found")

    # If already processed, just return current state
    if txn.get("payment_status") == "paid" and txn.get("granted"):
        return {
            "payment_status": "paid",
            "status": txn.get("status", "complete"),
            "amount_total": int(txn["amount"] * 100),
            "currency": txn["currency"],
        }

    sc = _stripe_client(request)
    status = await sc.get_checkout_status(session_id)

    update = {
        "payment_status": status.payment_status,
        "status": status.status,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }

    if status.payment_status == "paid" and not txn.get("granted"):
        # Grant premium
        days = int(txn.get("days", 30))
        current_user = await db.users.find_one({"user_id": user["user_id"]}, {"_id": 0})
        existing_until = current_user.get("premium_until") if current_user else None
        base = datetime.now(timezone.utc)
        if existing_until:
            try:
                existing_dt = datetime.fromisoformat(existing_until)
                if existing_dt.tzinfo is None:
                    existing_dt = existing_dt.replace(tzinfo=timezone.utc)
                if existing_dt > base:
                    base = existing_dt
            except ValueError:
                pass
        new_until = (base + timedelta(days=days)).isoformat()
        await db.users.update_one(
            {"user_id": user["user_id"]},
            {"$set": {"premium_until": new_until, "plan": txn["package_id"]}},
        )
        update["granted"] = True
        update["granted_at"] = datetime.now(timezone.utc).isoformat()

    await db.payment_transactions.update_one({"session_id": session_id}, {"$set": update})

    return {
        "payment_status": status.payment_status,
        "status": status.status,
        "amount_total": status.amount_total,
        "currency": status.currency,
    }


@api_router.post("/subscription/cancel")
async def cancel_subscription(user: dict = Depends(get_current_user)):
    """Cancel auto-renewal. The user keeps premium until premium_until expires."""
    await db.users.update_one(
        {"user_id": user["user_id"]},
        {"$set": {"plan": None}},
    )
    return {"ok": True, "premium_until": user.get("premium_until")}


@api_router.post("/webhook/stripe")
async def stripe_webhook(request: Request):
    body = await request.body()
    signature = request.headers.get("Stripe-Signature", "")
    sc = _stripe_client(request)
    try:
        evt = await sc.handle_webhook(body, signature)
    except Exception as e:
        logger.warning(f"Stripe webhook error: {e}")
        return {"received": True}

    txn = await db.payment_transactions.find_one({"session_id": evt.session_id}, {"_id": 0})
    if not txn:
        return {"received": True}

    update = {
        "payment_status": evt.payment_status,
        "webhook_event_type": evt.event_type,
        "webhook_event_id": evt.event_id,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    if evt.payment_status == "paid" and not txn.get("granted"):
        days = int(txn.get("days", 30))
        user = await db.users.find_one({"user_id": txn["user_id"]}, {"_id": 0})
        existing_until = user.get("premium_until") if user else None
        base = datetime.now(timezone.utc)
        if existing_until:
            try:
                existing_dt = datetime.fromisoformat(existing_until)
                if existing_dt.tzinfo is None:
                    existing_dt = existing_dt.replace(tzinfo=timezone.utc)
                if existing_dt > base:
                    base = existing_dt
            except ValueError:
                pass
        new_until = (base + timedelta(days=days)).isoformat()
        await db.users.update_one(
            {"user_id": txn["user_id"]},
            {"$set": {"premium_until": new_until, "plan": txn["package_id"]}},
        )
        update["granted"] = True
        update["granted_at"] = datetime.now(timezone.utc).isoformat()

    await db.payment_transactions.update_one({"session_id": evt.session_id}, {"$set": update})
    return {"received": True}


# ============================================================
# Routes mounted
# ============================================================
@api_router.get("/")
async def root():
    return {"app": "DebtWise", "ok": True}


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=[FRONTEND_URL, "http://localhost:3000"],
    allow_origin_regex=r"https://.*\.(preview\.emergentagent\.com|emergent\.host|emergentagent\.com)",
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================================
# Startup
# ============================================================
@app.on_event("startup")
async def startup():
    await db.users.create_index("email", unique=True)
    await db.users.create_index("user_id", unique=True)
    await db.debts.create_index("user_id")
    await db.user_sessions.create_index("session_token", unique=True)
    await db.login_attempts.create_index("identifier")
    await db.payment_transactions.create_index("session_id", unique=True)
    await db.payment_transactions.create_index("user_id")
    # Seed admin
    admin_email = os.environ.get("ADMIN_EMAIL", "admin@debtwise.app").lower()
    admin_password = os.environ.get("ADMIN_PASSWORD", "Admin@123")
    existing = await db.users.find_one({"email": admin_email})
    if not existing:
        await db.users.insert_one({
            "user_id": f"user_{uuid.uuid4().hex[:12]}",
            "email": admin_email,
            "password_hash": hash_password(admin_password),
            "name": "Admin",
            "picture": None,
            "auth_provider": "email",
            "role": "admin",
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
    elif not verify_password(admin_password, existing.get("password_hash", "")):
        await db.users.update_one({"email": admin_email}, {"$set": {"password_hash": hash_password(admin_password)}})

    # Write test credentials
    creds_path = Path("/app/memory")
    creds_path.mkdir(parents=True, exist_ok=True)
    (creds_path / "test_credentials.md").write_text(
        f"""# Test Credentials

## Admin
- Email: {admin_email}
- Password: {admin_password}
- Role: admin

## Auth Endpoints
- POST /api/auth/register
- POST /api/auth/login
- POST /api/auth/logout
- GET  /api/auth/me
- POST /api/auth/session  (Emergent Google OAuth exchange)

## Notes
- JWT auth uses httpOnly cookies (`access_token`, `refresh_token`).
- Google OAuth uses `session_token` cookie via Emergent Auth.
"""
    )
    logger.info("Startup complete.")


@app.on_event("shutdown")
async def shutdown():
    client.close()
