"""Human-readable administration timestamps; database values remain timezone-aware."""
from datetime import UTC, datetime
from zoneinfo import ZoneInfo

DISPLAY_TIMEZONE = ZoneInfo("Asia/Kuala_Lumpur")


def display_datetime(value: datetime | None) -> str | None:
    if value is None:
        return None
    if value.tzinfo is None:  # SQLite tests return naive UTC timestamps.
        value = value.replace(tzinfo=UTC)
    return value.astimezone(DISPLAY_TIMEZONE).strftime("%Y-%m-%d %H:%M:%S")
