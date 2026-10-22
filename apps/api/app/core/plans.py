"""Plan/pricing truth for the whole product.

The matrix lives in ONE file, apps/api/config/pricing.json, and is loaded here
and served to the web app (GET /billing/plans) so the marketing cards, the
dashboard meters and the enforcement in this API can never disagree. Numbers
are never duplicated in either frontend.

Ownership model: Clerk Billing runs the payment. The tier a user actually gets
is stored in user_plans (written by the Clerk webhook / the web BFF sync); this
module only turns a tier key into limits, meters, entitlements and rate
ceilings. Owner accounts (OWNER_EMAILS) are resolved to the top tier without a
subscription so the founder always has full headroom.
"""

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, Mapping, Optional, Tuple

from app.core.config import settings

_PRICING_PATH = Path(__file__).resolve().parents[2] / "config" / "pricing.json"

PLAN_ORDER: Tuple[str, ...] = ("free", "starter", "growth", "pro")
FREE_TIER = "free"
TOP_TIER = "pro"


@dataclass(frozen=True)
class RateCeiling:
    reads_per_min: int
    writes_per_min: int
    ai_per_min: int
    burst: int


@dataclass(frozen=True)
class PlanDefinition:
    key: str
    name: str
    price: int
    tagline: str
    limits: Mapping[str, int]
    meters: Mapping[str, int]
    features: Mapping[str, Any]
    rate: RateCeiling
    highlighted: bool = False

    @property
    def insight_modules(self) -> Mapping[str, bool]:
        return self.features.get("insight_modules", {})


def _load_raw() -> Dict[str, Any]:
    try:
        raw = json.loads(_PRICING_PATH.read_text(encoding="utf-8"))
    except FileNotFoundError as exc:
        raise RuntimeError(f"{_PRICING_PATH} is missing — the pricing matrix ships with the API") from exc
    except json.JSONDecodeError as exc:
        raise RuntimeError(f"{_PRICING_PATH} is not valid JSON: {exc}") from exc
    _validate(raw)
    return raw


def _validate(raw: Mapping[str, Any]) -> None:
    """Fail at import rather than silently granting unlimited access.

    A plan missing a dimension/meter key would make `limit_for()` return None,
    which every caller reads as "no cap" — the one pricing bug that would let
    free accounts mint unlimited rows, so it is refused at boot.
    """
    dims = list(raw.get("dimensions") or {})
    meters = list(raw.get("meters") or {})
    plans = raw.get("plans") or []
    keys = [p.get("key") for p in plans]
    if keys != list(PLAN_ORDER):
        raise RuntimeError(f"pricing.json plans must be exactly {list(PLAN_ORDER)}, got {keys}")
    for plan in plans:
        key = plan["key"]
        for d in dims:
            if not isinstance((plan.get("limits") or {}).get(d), int):
                raise RuntimeError(f"pricing.json: plan '{key}' is missing integer limit '{d}'")
        for m in meters:
            if not isinstance((plan.get("meters") or {}).get(m), int):
                raise RuntimeError(f"pricing.json: plan '{key}' is missing integer meter '{m}'")
        rate = plan.get("rate") or {}
        for r in ("reads_per_min", "writes_per_min", "ai_per_min", "burst"):
            if not isinstance(rate.get(r), int):
                raise RuntimeError(f"pricing.json: plan '{key}' is missing rate ceiling '{r}'")


def _build(raw: Mapping[str, Any]) -> Tuple[PlanDefinition, ...]:
    out = []
    for plan in raw["plans"]:
        rate = plan["rate"]
        out.append(
            PlanDefinition(
                key=plan["key"],
                name=plan["name"],
                price=plan["price"],
                tagline=plan["tagline"],
                limits=dict(plan["limits"]),
                meters=dict(plan["meters"]),
                features=dict(plan["features"]),
                rate=RateCeiling(
                    reads_per_min=rate["reads_per_min"],
                    writes_per_min=rate["writes_per_min"],
                    ai_per_min=rate["ai_per_min"],
                    burst=rate["burst"],
                ),
                highlighted=bool(plan.get("highlighted")),
            )
        )
    return tuple(out)


_RAW = _load_raw()
PLANS: Tuple[PlanDefinition, ...] = _build(_RAW)
PLAN_BY_KEY: Dict[str, PlanDefinition] = {p.key: p for p in PLANS}
DIMENSIONS: Dict[str, Dict[str, str]] = dict(_RAW["dimensions"])
METERS: Dict[str, Dict[str, str]] = dict(_RAW["meters"])
INSIGHT_MODULES: Dict[str, str] = dict(_RAW.get("insight_modules") or {})
PRICING_PUBLIC_PAYLOAD: Dict[str, Any] = {
    "version": _RAW["version"],
    "currency": _RAW["currency"],
    "billingPeriod": _RAW["billing_period"],
    "dimensions": DIMENSIONS,
    "meters": METERS,
    "insightModules": INSIGHT_MODULES,
    "plans": _RAW["plans"],
}


def normalize_tier(tier: Optional[str]) -> str:
    """Unknown / missing tiers degrade to Free — never to the top tier."""
    return tier if tier in PLAN_BY_KEY else FREE_TIER


def plan_for(tier: Optional[str]) -> PlanDefinition:
    return PLAN_BY_KEY[normalize_tier(tier)]


def limit_for(tier: Optional[str], kind: str) -> int:
    return plan_for(tier).limits[kind]


def meter_for(tier: Optional[str], kind: str) -> int:
    return plan_for(tier).meters[kind]


def feature_allowed(tier: Optional[str], feature: str) -> bool:
    """Gate for whole features that are sold, not toggled (proposals, insights).

    Owner accounts need no special case here: resolve_tier() already maps them
    to the top tier, which allows every module.
    """
    return bool(plan_for(tier).features.get(feature, False))


def insight_module_allowed(tier: Optional[str], module: str) -> bool:
    plan = plan_for(tier)
    if not plan.features.get("insights", False):
        return False
    return bool(plan.insight_modules.get(module, False))


def rate_for(tier: Optional[str]) -> RateCeiling:
    return plan_for(tier).rate


def owner_emails() -> set:
    return {e.strip().lower() for e in settings.OWNER_EMAILS.split(",") if e.strip()}


def owner_clerk_ids() -> set:
    return {e.strip() for e in settings.OWNER_CLERK_IDS.split(",") if e.strip()}


def is_owner_email(email: Optional[str]) -> bool:
    claimed = (email or "").strip().lower()
    return bool(claimed) and claimed in owner_emails()


def is_owner(email: Optional[str], clerk_id: Optional[str] = None) -> bool:
    """Ownership is matched on the Clerk id as well as the email because the
    email claim is a per-template choice in Clerk: a token minted without it
    would otherwise silently demote the founder to their stored tier."""
    return (
        is_owner_email(email)
        or bool(clerk_id)
        and clerk_id.strip() in owner_clerk_ids()
    )


def resolve_tier(
    email: Optional[str], stored_tier: Optional[str], clerk_id: Optional[str] = None
) -> str:
    """Owner accounts get the top tier without paying; everyone else is bound
    by their subscription record."""
    if is_owner(email, clerk_id):
        return TOP_TIER
    return normalize_tier(stored_tier)
