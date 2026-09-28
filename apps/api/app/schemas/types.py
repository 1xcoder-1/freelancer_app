"""Shared schema types.

`UTCDatetime` is the single input type for every datetime that lands in a DB
column. All timestamp columns in this project are naive `timestamp` fields that
hold UTC (the models default to `datetime.utcnow`). Feeding them a
timezone-aware value is what made `GET/POST /calendar/events` throw a 500 on
`...Z` / `+05:00` input: asyncpg refuses a tz-aware parameter against a naive
column. Validating through this type converts any aware input to its UTC
instant and drops the offset, so aware and naive inputs are comparable and
storable on exactly the same axis.

Note the lossy-but-intended asymmetry: a *naive* input is trusted as-is (that
is what the app has always sent and stored), while an *aware* input is
converted to its UTC equivalent before the offset is dropped.
"""

from datetime import datetime, timezone
from typing import Annotated

from pydantic import BeforeValidator, TypeAdapter

_DATETIME_ADAPTER = TypeAdapter(datetime)


def to_naive_utc(value):
    """Coerce ISO strings / tz-aware datetimes to a naive UTC datetime.

    Public because endpoints that take a range as plain strings (the calendar
    feed's `start`/`end` query params) must normalise on exactly the same axis
    as the request bodies do.
    """
    if isinstance(value, str):
        value = _DATETIME_ADAPTER.validate_python(value)
    if isinstance(value, datetime) and value.tzinfo is not None:
        value = value.astimezone(timezone.utc).replace(tzinfo=None)
    return value


UTCDatetime = Annotated[datetime, BeforeValidator(to_naive_utc)]
