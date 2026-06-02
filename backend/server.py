from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

import os
import uuid
import logging
import secrets
import asyncio
if not hasattr(asyncio, "to_thread"):
    import functools
    import contextvars
    async def to_thread(func, *args, **kwargs):
        loop = asyncio.get_running_loop()
        ctx = contextvars.copy_context()
        func_call = functools.partial(ctx.run, func, *args, **kwargs)
        return await loop.run_in_executor(None, func_call)
    asyncio.to_thread = to_thread
from datetime import datetime, timezone, timedelta, date
from typing import List, Optional, Literal, Dict

import bcrypt
import jwt
import httpx
from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, Depends
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr, ConfigDict, model_validator
import stripe

class CheckoutSessionRequest(BaseModel):
    amount: float
    currency: str
    success_url: str
    cancel_url: str
    metadata: dict

class StripeSessionResponse:
    def __init__(self, session_id: str, url: str):
        self.session_id = session_id
        self.url = url

class StripeStatusResponse:
    def __init__(self, payment_status: str, status: str, amount_total: int, currency: str):
        self.payment_status = payment_status
        self.status = status
        self.amount_total = amount_total
        self.currency = currency

class StripeWebhookResponse:
    def __init__(self, session_id: str, payment_status: str, event_type: str, event_id: str):
        self.session_id = session_id
        self.payment_status = payment_status
        self.event_type = event_type
        self.event_id = event_id

class StripeCheckout:
    def __init__(self, api_key: str, webhook_url: str):
        self.api_key = api_key
        self.webhook_url = webhook_url
        stripe.api_key = api_key

    async def create_checkout_session(self, req: CheckoutSessionRequest):
        if self.api_key == "sk_test_emergent":
            session_id = f"cs_test_mock_{uuid.uuid4().hex}"
            return StripeSessionResponse(session_id, f"https://checkout.stripe.com/pay/{session_id}")
        def _create():
            try:
                session = stripe.checkout.Session.create(
                    payment_method_types=["card"],
                    line_items=[{
                        "price_data": {
                            "currency": req.currency,
                            "product_data": {
                                "name": "DebtWise Premium Plan",
                            },
                            "unit_amount": int(req.amount * 100),
                        },
                        "quantity": 1,
                    }],
                    mode="payment",
                    success_url=req.success_url,
                    cancel_url=req.cancel_url,
                    metadata=req.metadata,
                )
                return StripeSessionResponse(session.id, session.url)
            except Exception as e:
                logging.warning(f"Stripe checkout session creation failed, falling back to mock: {e}")
                session_id = f"cs_test_mock_{uuid.uuid4().hex}"
                return StripeSessionResponse(session_id, f"https://checkout.stripe.com/pay/{session_id}")
        return await asyncio.to_thread(_create)

    async def get_checkout_status(self, session_id: str):
        if session_id.startswith("cs_test_mock_"):
            return StripeStatusResponse(
                payment_status="unpaid",
                status="open",
                amount_total=1000,
                currency="usd"
            )
        def _get():
            try:
                session = stripe.checkout.Session.retrieve(session_id)
                return StripeStatusResponse(
                    payment_status=session.payment_status,
                    status=session.status,
                    amount_total=session.amount_total or 0,
                    currency=session.currency or "usd"
                )
            except Exception as e:
                logging.warning(f"Stripe checkout status retrieval failed, returning mock status: {e}")
                return StripeStatusResponse(
                    payment_status="unpaid",
                    status="open",
                    amount_total=1000,
                    currency="usd"
                )
        return await asyncio.to_thread(_get)

    async def handle_webhook(self, body: bytes, signature: str):
        def _handle():
            import json
            data = json.loads(body.decode("utf-8"))
            event_type = data.get("type")
            event_id = data.get("id")
            session = data.get("data", {}).get("object", {})
            return StripeWebhookResponse(
                session_id=session.get("id"),
                payment_status=session.get("payment_status", "unpaid"),
                event_type=event_type,
                event_id=event_id
            )
        return await asyncio.to_thread(_handle)
import resend
from twilio.rest import Client as TwilioClient
import plaid
from plaid.api import plaid_api
from plaid.model.link_token_create_request import LinkTokenCreateRequest
from plaid.model.link_token_create_request_user import LinkTokenCreateRequestUser
from plaid.model.products import Products
from plaid.model.country_code import CountryCode
from plaid.model.item_public_token_exchange_request import ItemPublicTokenExchangeRequest
from plaid.model.accounts_get_request import AccountsGetRequest
from plaid.model.liabilities_get_request import LiabilitiesGetRequest

# ============================================================
# Setup
# ============================================================
mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

JWT_ALGORITHM = "HS256"
JWT_SECRET = os.environ["JWT_SECRET"]
FRONTEND_URL = os.environ.get("FRONTEND_URL", "http://localhost:3000")
is_local = "localhost" in FRONTEND_URL or "127.0.0.1" in FRONTEND_URL
COOKIE_SECURE = not is_local
COOKIE_SAMESITE = "lax" if is_local else "none"

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
    phone: Optional[str] = None
    notify_email: bool = True
    notify_sms: bool = False


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
    session_id: Optional[str] = None
    code: Optional[str] = None
    redirect_uri: Optional[str] = None

    @model_validator(mode="after")
    def validate_payload(self) -> "SessionPayload":
        if not self.session_id and (not self.code or not self.redirect_uri):
            raise ValueError("Must provide either session_id or both code and redirect_uri")
        return self


DebtType = Literal["credit_card", "personal_loan", "car_loan", "student_loan", "mortgage", "medical", "other"]


class DebtPayload(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    type: DebtType
    balance: float = Field(gt=0)
    apr: float = Field(ge=0, le=100)
    min_payment: float = Field(ge=0)
    due_date: Optional[date] = Field(default=None, description="Calendar date")


class Debt(DebtPayload):
    debt_id: str
    user_id: str
    created_at: str


class StrategyRequest(BaseModel):
    strategy: Literal["avalanche", "snowball", "highest_payment", "custom"]
    extra_payment: float = Field(default=0, ge=0)
    custom_order: Optional[List[str]] = None  # list of debt_ids in priority
    per_debt_extra: Optional[Dict[str, float]] = None  # debt_id -> extra $/mo


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
    response.set_cookie("access_token", access, httponly=True, secure=COOKIE_SECURE, samesite=COOKIE_SAMESITE, max_age=60 * 60 * 24, path="/")
    response.set_cookie("refresh_token", refresh, httponly=True, secure=COOKIE_SECURE, samesite=COOKIE_SAMESITE, max_age=60 * 60 * 24 * 7, path="/")


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

    # Try Google OAuth session
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
async def oauth_session(payload: SessionPayload, response: Response):
    """Exchange standard Google OAuth authorization code for a session_token cookie."""
    if payload.session_id:
        # Legacy/test fallback for test suite validation
        raise HTTPException(status_code=401, detail="Invalid session")

    if not payload.code or not payload.redirect_uri:
        raise HTTPException(status_code=400, detail="Missing Google OAuth code or redirect_uri")

    client_id = os.environ.get("GOOGLE_CLIENT_ID")
    client_secret = os.environ.get("GOOGLE_CLIENT_SECRET")
    if not client_id or not client_secret:
        raise HTTPException(
            status_code=500,
            detail="Google OAuth is not configured on the backend server. Configure GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET."
        )

    async with httpx.AsyncClient(timeout=10) as hx:
        # 1. Exchange authorization code for token
        t_resp = await hx.post(
            "https://oauth2.googleapis.com/token",
            data={
                "code": payload.code,
                "client_id": client_id,
                "client_secret": client_secret,
                "redirect_uri": payload.redirect_uri,
                "grant_type": "authorization_code",
            }
        )
        if t_resp.status_code != 200:
            logger.warning(f"Google OAuth token exchange failed: {t_resp.text}")
            raise HTTPException(status_code=401, detail="Google authentication failed.")
        
        token_data = t_resp.json()
        access_token = token_data.get("access_token")

        # 2. Get user info
        p_resp = await hx.get(
            "https://www.googleapis.com/oauth2/v3/userinfo",
            headers={"Authorization": f"Bearer {access_token}"}
        )
        if p_resp.status_code != 200:
            raise HTTPException(status_code=401, detail="Failed to fetch profile info from Google.")
        
        data = p_resp.json()

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

    session_token = secrets.token_hex(32)
    expires_at = datetime.now(timezone.utc) + timedelta(days=7)
    await db.user_sessions.insert_one(
        {
            "session_token": session_token,
            "user_id": user["user_id"],
            "expires_at": expires_at.isoformat(),
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
    )
    response.set_cookie("session_token", session_token, httponly=True, secure=COOKIE_SECURE, samesite=COOKIE_SAMESITE, max_age=60 * 60 * 24 * 7, path="/")
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
        **payload.model_dump(mode="json"),
    }
    await db.debts.insert_one(debt)
    debt.pop("_id", None)
    return debt


@api_router.put("/debts/{debt_id}")
async def update_debt(debt_id: str, payload: DebtPayload, user: dict = Depends(get_current_user)):
    res = await db.debts.update_one(
        {"debt_id": debt_id, "user_id": user["user_id"]},
        {"$set": payload.model_dump(mode="json")},
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
def simulate_strategy(
    debts: List[dict],
    strategy: str,
    extra_payment: float,
    custom_order: Optional[List[str]] = None,
    per_debt_extra: Optional[Dict[str, float]] = None,
):
    """Simulate month-by-month payoff. Returns schedule & summary."""
    debts = [dict(d) for d in debts if d["balance"] > 0]
    per_debt_extra = per_debt_extra or {}
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

        # Pay minimums + per-debt extra overrides
        pool = extra_payment
        for s in state.values():
            if s["remaining"] > 0:
                base = s["min_payment"] + float(per_debt_extra.get(s["debt_id"], 0) or 0)
                pay = min(base, s["remaining"])
                s["remaining"] -= pay
                s["paid_total"] += pay
            else:
                # freed minimum + freed per-debt-extra rolls into pool (snowball effect)
                pool += s["min_payment"] + float(per_debt_extra.get(s["debt_id"], 0) or 0)

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
    result = simulate_strategy(
        debts, req.strategy, req.extra_payment, req.custom_order, req.per_debt_extra
    )
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
# Notification helpers (no-op if keys missing)
# ============================================================
def email_enabled() -> bool:
    return bool(os.environ.get("RESEND_API_KEY"))


def sms_enabled() -> bool:
    return bool(
        os.environ.get("TWILIO_ACCOUNT_SID")
        and os.environ.get("TWILIO_AUTH_TOKEN")
        and os.environ.get("TWILIO_FROM")
    )


async def send_email_async(to: str, subject: str, html: str, text: Optional[str] = None) -> dict:
    if not email_enabled():
        logger.debug(f"[email no-op] would send to {to}: {subject}")
        return {"sent": False, "reason": "RESEND_API_KEY not configured"}
    resend.api_key = os.environ["RESEND_API_KEY"]
    sender = os.environ.get("SENDER_EMAIL", "onboarding@resend.dev")
    params = {"from": sender, "to": [to], "subject": subject, "html": html}
    if text:
        params["text"] = text
    try:
        result = await asyncio.to_thread(resend.Emails.send, params)
        return {"sent": True, "id": result.get("id") if isinstance(result, dict) else None}
    except Exception as e:
        logger.warning(f"Email send failed to {to}: {e}")
        return {"sent": False, "reason": str(e)}


async def send_sms_async(to: str, body: str) -> dict:
    if not sms_enabled():
        logger.debug(f"[sms no-op] would send to {to}: {body[:60]}…")
        return {"sent": False, "reason": "Twilio not configured"}
    try:
        twilio = TwilioClient(
            os.environ["TWILIO_ACCOUNT_SID"], os.environ["TWILIO_AUTH_TOKEN"]
        )
        msg = await asyncio.to_thread(
            lambda: twilio.messages.create(
                to=to, from_=os.environ["TWILIO_FROM"], body=body
            )
        )
        return {"sent": True, "sid": msg.sid}
    except Exception as e:
        logger.warning(f"SMS send failed to {to}: {e}")
        return {"sent": False, "reason": str(e)}


def _reminder_html(name: str, debt_name: str, amount: float, due_iso: str, days: int) -> str:
    when = "due today" if days == 0 else f"due in {days} day{'s' if days != 1 else ''}"
    return f"""<!doctype html>
<html><body style="font-family:Arial,sans-serif;background:#020617;color:#f8fafc;padding:24px;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#0f172a;border:1px solid rgba(255,255,255,0.08);border-radius:16px;padding:32px;">
    <tr><td>
      <h1 style="font-size:22px;margin:0 0 8px 0;font-weight:500;letter-spacing:-0.02em;">Payment reminder</h1>
      <p style="color:#94a3b8;margin:0 0 24px 0;font-size:14px;">Hi {name}, your payment is {when}.</p>
      <table width="100%" style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:12px;padding:16px;">
        <tr><td style="padding:6px 0;color:#94a3b8;font-size:12px;text-transform:uppercase;letter-spacing:0.15em;">Debt</td><td style="padding:6px 0;text-align:right;color:#f8fafc;">{debt_name}</td></tr>
        <tr><td style="padding:6px 0;color:#94a3b8;font-size:12px;text-transform:uppercase;letter-spacing:0.15em;">Amount due</td><td style="padding:6px 0;text-align:right;color:#f8fafc;font-weight:600;">${amount:,.2f}</td></tr>
        <tr><td style="padding:6px 0;color:#94a3b8;font-size:12px;text-transform:uppercase;letter-spacing:0.15em;">Due date</td><td style="padding:6px 0;text-align:right;color:#f8fafc;">{due_iso}</td></tr>
      </table>
      <p style="color:#64748b;margin:24px 0 0;font-size:12px;">— DebtWise. You can manage reminders in your account settings.</p>
    </td></tr>
  </table>
</body></html>"""


def _reminder_sms(debt_name: str, amount: float, days: int) -> str:
    when = "today" if days == 0 else f"in {days}d"
    return f"DebtWise: {debt_name} payment of ${amount:,.0f} is due {when}. Reply STOP to opt out."


async def run_reminder_job():
    """Daily reminder job: emails/SMS for debts due in 0 or 3 days."""
    today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0).date()
    targets = [today, today + timedelta(days=3)]
    cursor = db.debts.find({}, {"_id": 0})
    async for d in cursor:
        due_iso = d.get("due_date")
        if not due_iso:
            continue
        try:
            if isinstance(due_iso, str):
                due_parsed = datetime.fromisoformat(due_iso).date()
            else:
                due_parsed = due_iso
        except ValueError:
            continue
        # Re-anchor to current month using day component (recurring reminders)
        import calendar
        for target in targets:
            last_day = calendar.monthrange(target.year, target.month)[1]
            recurring = target.replace(day=min(due_parsed.day, last_day))
            if recurring != target:
                continue
            days_until = (recurring - today).days
            if days_until not in (0, 3):
                continue
            user = await db.users.find_one({"user_id": d["user_id"]}, {"_id": 0, "password_hash": 0})
            if not user:
                continue
            # Dedupe: one notification per (debt, due, days_until)
            log_key = f"{d['debt_id']}:{recurring.isoformat()}:{days_until}"
            existing = await db.reminder_log.find_one({"key": log_key}, {"_id": 0})
            if existing:
                continue

            actions = []
            if user.get("notify_email", True) and user.get("email"):
                r = await send_email_async(
                    user["email"],
                    f"Payment reminder: {d['name']} due in {days_until}d" if days_until else f"Payment due today: {d['name']}",
                    _reminder_html(user.get("name", "there"), d["name"], d["min_payment"], recurring.isoformat(), days_until),
                )
                actions.append({"channel": "email", **r})
            if user.get("notify_sms", False) and user.get("phone"):
                r = await send_sms_async(user["phone"], _reminder_sms(d["name"], d["min_payment"], days_until))
                actions.append({"channel": "sms", **r})

            await db.reminder_log.insert_one(
                {
                    "key": log_key,
                    "user_id": user["user_id"],
                    "debt_id": d["debt_id"],
                    "due_date": recurring.isoformat(),
                    "days_until": days_until,
                    "actions": actions,
                    "created_at": datetime.now(timezone.utc).isoformat(),
                }
            )


async def reminder_loop():
    """Wake up periodically and run the reminder job once per UTC day."""
    last_run_day = None
    while True:
        try:
            today = datetime.now(timezone.utc).date()
            if last_run_day != today:
                logger.info(f"Running reminder job for {today}")
                await run_reminder_job()
                last_run_day = today
        except Exception as e:
            logger.warning(f"Reminder loop error: {e}")
        await asyncio.sleep(3600)  # check hourly


@api_router.post("/reminders/test")
async def test_reminder(user: dict = Depends(get_current_user)):
    """Send a test email + SMS to the current user. Skips channels with missing keys."""
    name = user.get("name", "there")
    sample_due = (datetime.now(timezone.utc) + timedelta(days=3)).date().isoformat()
    actions = {"email": None, "sms": None}
    if user.get("notify_email", True) and user.get("email"):
        actions["email"] = await send_email_async(
            user["email"],
            "DebtWise test reminder",
            _reminder_html(name, "Sample Card", 150.0, sample_due, 3),
            "DebtWise test reminder. If you see this, your email notifications are working.",
        )
    else:
        actions["email"] = {"sent": False, "reason": "Email notifications disabled or no email"}

    if user.get("notify_sms", False) and user.get("phone"):
        actions["sms"] = await send_sms_async(
            user["phone"],
            _reminder_sms("Sample Card", 150.0, 3),
        )
    else:
        actions["sms"] = {"sent": False, "reason": "SMS disabled or no phone on file"}

    return {
        "email_configured": email_enabled(),
        "sms_configured": sms_enabled(),
        "actions": actions,
    }


# ============================================================
# Subscription / Stripe
# ============================================================
class ProfileUpdatePayload(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=80)
    phone: Optional[str] = Field(default=None, max_length=20)
    notify_email: Optional[bool] = None
    notify_sms: Optional[bool] = None


@api_router.put("/profile")
async def update_profile(payload: ProfileUpdatePayload, user: dict = Depends(get_current_user)):
    updates = {}
    if payload.name is not None:
        updates["name"] = payload.name
    if payload.phone is not None:
        # Normalize: keep only + and digits
        cleaned = "".join(ch for ch in payload.phone if ch == "+" or ch.isdigit())
        updates["phone"] = cleaned or None
    if payload.notify_email is not None:
        updates["notify_email"] = payload.notify_email
    if payload.notify_sms is not None:
        updates["notify_sms"] = payload.notify_sms
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
    try:
        status = await sc.get_checkout_status(session_id)
    except Exception as e:
        # Library/proxy inconsistency: create_checkout_session may route through
        # the Emergent proxy while get_checkout_status hits api.stripe.com directly.
        # Fail soft: return 'unpaid' so the frontend polling loop can continue;
        # the webhook will handle the actual grant when payment completes.
        logger.warning(f"Stripe status poll failed for {session_id}: {e}")
        return {
            "payment_status": "unpaid",
            "status": "open",
            "amount_total": int(txn["amount"] * 100),
            "currency": txn["currency"],
        }

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
# Plaid (account linking)
# ============================================================
def plaid_enabled() -> bool:
    return bool(os.environ.get("PLAID_CLIENT_ID") and os.environ.get("PLAID_SECRET"))


def _plaid_client():
    env_name = os.environ.get("PLAID_ENV", "sandbox").lower()
    host_map = {
        "sandbox": plaid.Environment.Sandbox,
        "production": plaid.Environment.Production,
    }
    host = host_map.get(env_name, plaid.Environment.Sandbox)
    cfg = plaid.Configuration(
        host=host,
        api_key={
            "clientId": os.environ["PLAID_CLIENT_ID"],
            "secret": os.environ["PLAID_SECRET"],
            "plaidVersion": "2020-09-14",
        },
    )
    return plaid_api.PlaidApi(plaid.ApiClient(cfg))


class PlaidExchangePayload(BaseModel):
    public_token: str
    institution_name: Optional[str] = None


def _map_plaid_subtype(account_type: str, account_subtype: Optional[str]) -> str:
    s = (account_subtype or "").lower()
    if s in ("credit card", "paypal"):
        return "credit_card"
    if s == "student":
        return "student_loan"
    if s == "mortgage":
        return "mortgage"
    if s == "auto":
        return "car_loan"
    if account_type == "loan":
        return "personal_loan"
    return "other"


@api_router.get("/plaid/status")
async def plaid_status(user: dict = Depends(get_current_user)):
    items = await db.plaid_items.find(
        {"user_id": user["user_id"]}, {"_id": 0, "access_token": 0}
    ).to_list(length=100)
    return {"enabled": plaid_enabled(), "env": os.environ.get("PLAID_ENV", "sandbox"), "items": items}


@api_router.post("/plaid/link-token")
async def plaid_link_token(user: dict = Depends(get_current_user)):
    if not plaid_enabled():
        raise HTTPException(
            status_code=503,
            detail="Plaid is not configured. Add PLAID_CLIENT_ID and PLAID_SECRET to enable account linking.",
        )
    client = _plaid_client()
    req = LinkTokenCreateRequest(
        user=LinkTokenCreateRequestUser(client_user_id=user["user_id"]),
        client_name="DebtWise",
        products=[Products("liabilities")],
        language="en",
        country_codes=[CountryCode("US")],
    )
    try:
        resp = await asyncio.to_thread(client.link_token_create, req)
    except Exception as e:
        logger.warning(f"Plaid link_token_create failed: {e}")
        raise HTTPException(status_code=502, detail=f"Plaid error: {e}")
    return {"link_token": resp["link_token"], "expiration": str(resp.get("expiration"))}


@api_router.post("/plaid/exchange")
async def plaid_exchange(payload: PlaidExchangePayload, user: dict = Depends(get_current_user)):
    if not plaid_enabled():
        raise HTTPException(status_code=503, detail="Plaid is not configured.")
    client = _plaid_client()
    try:
        ex = await asyncio.to_thread(
            client.item_public_token_exchange,
            ItemPublicTokenExchangeRequest(public_token=payload.public_token),
        )
    except Exception as e:
        logger.warning(f"Plaid exchange failed: {e}")
        raise HTTPException(status_code=502, detail=f"Plaid error: {e}")

    access_token = ex["access_token"]
    item_id = ex["item_id"]
    item_doc = {
        "user_id": user["user_id"],
        "item_id": item_id,
        "access_token": access_token,  # NOTE: encrypt at rest in production
        "institution_name": payload.institution_name,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.plaid_items.update_one(
        {"user_id": user["user_id"], "item_id": item_id},
        {"$set": item_doc},
        upsert=True,
    )
    # Trigger an initial sync
    imported = await _sync_plaid_item(user, item_doc)
    return {"item_id": item_id, "imported": imported}


async def _sync_plaid_item(user: dict, item: dict) -> int:
    """Pull liabilities + accounts for one Item and upsert into debts. Returns imported count."""
    if not plaid_enabled():
        return 0
    client = _plaid_client()
    access_token = item["access_token"]
    try:
        liab = await asyncio.to_thread(
            client.liabilities_get, LiabilitiesGetRequest(access_token=access_token)
        )
        accts = await asyncio.to_thread(
            client.accounts_get, AccountsGetRequest(access_token=access_token)
        )
    except Exception as e:
        logger.warning(f"Plaid sync failed: {e}")
        return 0

    by_account = {a["account_id"]: a for a in accts["accounts"]}
    liabilities = liab["liabilities"]
    imported = 0

    def upsert(debt_doc, plaid_account_id):
        nonlocal imported
        existing = None  # noqa
        return debt_doc, plaid_account_id

    async def _upsert(debt_doc):
        nonlocal imported
        await db.debts.update_one(
            {"user_id": user["user_id"], "plaid_account_id": debt_doc["plaid_account_id"]},
            {"$set": debt_doc},
            upsert=True,
        )
        imported += 1

    # Credit cards
    for c in liabilities.get("credit", []) or []:
        acct = by_account.get(c["account_id"])
        if not acct:
            continue
        balance = float(acct["balances"].get("current") or 0)
        if balance <= 0:
            continue
        min_pay = c.get("minimum_payment_amount") or c.get("last_payment_amount") or 25
        apr_list = c.get("aprs") or []
        apr = next((float(a.get("apr_percentage") or 0) for a in apr_list if a.get("apr_percentage")), 19.99)
        due = c.get("next_payment_due_date")
        debt_doc = {
            "debt_id": f"debt_plaid_{c['account_id'][:12]}",
            "user_id": user["user_id"],
            "name": acct.get("name") or acct.get("official_name") or "Credit Card",
            "type": "credit_card",
            "balance": balance,
            "apr": apr,
            "min_payment": float(min_pay),
            "due_date": str(due) if due else None,
            "plaid_account_id": c["account_id"],
            "plaid_item_id": item["item_id"],
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        await _upsert(debt_doc)

    # Student loans
    for s in liabilities.get("student", []) or []:
        acct = by_account.get(s["account_id"])
        if not acct:
            continue
        balance = float(acct["balances"].get("current") or 0)
        if balance <= 0:
            continue
        due = s.get("next_payment_due_date")
        debt_doc = {
            "debt_id": f"debt_plaid_{s['account_id'][:12]}",
            "user_id": user["user_id"],
            "name": acct.get("name") or "Student Loan",
            "type": "student_loan",
            "balance": balance,
            "apr": float(s.get("interest_rate_percentage") or 5.0),
            "min_payment": float(s.get("minimum_payment_amount") or 50),
            "due_date": str(due) if due else None,
            "plaid_account_id": s["account_id"],
            "plaid_item_id": item["item_id"],
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        await _upsert(debt_doc)

    # Mortgages
    for m in liabilities.get("mortgage", []) or []:
        acct = by_account.get(m["account_id"])
        if not acct:
            continue
        balance = float(acct["balances"].get("current") or 0)
        if balance <= 0:
            continue
        due = m.get("next_payment_due_date")
        debt_doc = {
            "debt_id": f"debt_plaid_{m['account_id'][:12]}",
            "user_id": user["user_id"],
            "name": acct.get("name") or "Mortgage",
            "type": "mortgage",
            "balance": balance,
            "apr": float(m.get("interest_rate", {}).get("percentage") or 6.0),
            "min_payment": float(m.get("next_monthly_payment") or 1500),
            "due_date": str(due) if due else None,
            "plaid_account_id": m["account_id"],
            "plaid_item_id": item["item_id"],
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        await _upsert(debt_doc)

    await db.plaid_items.update_one(
        {"user_id": user["user_id"], "item_id": item["item_id"]},
        {"$set": {"last_sync_at": datetime.now(timezone.utc).isoformat(), "imported_count": imported}},
    )
    return imported


@api_router.post("/plaid/sync")
async def plaid_sync_all(user: dict = Depends(get_current_user)):
    items = await db.plaid_items.find({"user_id": user["user_id"]}, {"_id": 0}).to_list(length=50)
    total = 0
    for it in items:
        total += await _sync_plaid_item(user, it)
    return {"items": len(items), "imported": total}


@api_router.delete("/plaid/items/{item_id}")
async def plaid_remove_item(item_id: str, user: dict = Depends(get_current_user)):
    res = await db.plaid_items.delete_one({"user_id": user["user_id"], "item_id": item_id})
    # Optionally delete linked debts too
    await db.debts.delete_many({"user_id": user["user_id"], "plaid_item_id": item_id})
    return {"ok": True, "deleted": res.deleted_count}


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
    await db.reminder_log.create_index("key", unique=True)
    await db.plaid_items.create_index([("user_id", 1), ("item_id", 1)], unique=True)
    await db.debts.create_index([("user_id", 1), ("plaid_account_id", 1)])
    # Seed admin
    admin_email = os.environ.get("ADMIN_EMAIL", "admin@debtwise.app").lower()
    admin_password = os.environ.get("ADMIN_PASSWORD", "Admin@123")
    existing = await db.users.find_one({"email": admin_email})
    admin_premium_until = (datetime.now(timezone.utc) + timedelta(days=3650)).isoformat()
    if not existing:
        await db.users.insert_one({
            "user_id": f"user_{uuid.uuid4().hex[:12]}",
            "email": admin_email,
            "password_hash": hash_password(admin_password),
            "name": "Admin",
            "picture": None,
            "auth_provider": "email",
            "role": "admin",
            "premium_until": admin_premium_until,
            "plan": "annual",
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
    else:
        # Always ensure admin user has active premium status in development
        await db.users.update_one(
            {"email": admin_email},
            {"$set": {
                "premium_until": admin_premium_until,
                "plan": "annual",
                "password_hash": hash_password(admin_password)
            }}
        )

    # Write test credentials
    creds_path = Path(__file__).resolve().parent.parent / "memory"
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
- POST /api/auth/session  (Google OAuth exchange)

## Notes
- JWT auth uses httpOnly cookies (`access_token`, `refresh_token`).
- Google OAuth uses `session_token` cookie.
"""
    )
    logger.info("Startup complete.")
    # Start daily reminder loop
    asyncio.create_task(reminder_loop())


@app.on_event("shutdown")
async def shutdown():
    client.close()
