"""Lightweight site access passphrase authentication utility."""

import hashlib
from typing import Any

from django.conf import settings


def get_expected_token() -> str:
    """Generate deterministic bearer token derived from configured site access password."""
    password: Any = getattr(settings, 'SITE_ACCESS_PASSWORD', 'spotter2026')
    raw_str = str(password).strip()
    return hashlib.sha256(f'spotter-trucking:{raw_str}'.encode()).hexdigest()


def verify_token(token: str | None) -> bool:
    """Verify incoming token against expected token."""
    expected_password = str(getattr(settings, 'SITE_ACCESS_PASSWORD', '')).strip()
    # If no password is configured, access is unrestricted
    if not expected_password:
        return True
    if not token:
        return False
    return token.strip() == get_expected_token()
