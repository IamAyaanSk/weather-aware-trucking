import copy
import hashlib
import json
from datetime import UTC, datetime, timedelta
from typing import Any

from django.conf import settings
from django.utils import timezone

from apps.api.models import RouteAnalysis


def normalize_plan_request(data: dict[str, Any]) -> dict[str, Any]:
    """Normalize plan request inputs into a canonical dict for consistent hashing."""

    departure_time: datetime = data['departure_time']
    departure_utc = departure_time.astimezone(UTC).strftime('%Y-%m-%dT%H:%M:%SZ')

    return {
        'origin': {
            'name': data['origin']['name'].strip().casefold(),
            'lat': round(float(data['origin']['lat']), 5),
            'lng': round(float(data['origin']['lng']), 5),
        },
        'destination': {
            'name': data['destination']['name'].strip().casefold(),
            'lat': round(float(data['destination']['lat']), 5),
            'lng': round(float(data['destination']['lng']), 5),
        },
        'departure_time': departure_utc,
        'load_weight_lbs': int(data['load_weight_lbs']),
        'sample_interval_miles': int(data['sample_interval_miles']),
        'cache_version': getattr(settings, 'PLAN_CACHE_VERSION', 'v1'),
        'truck_profile_version': getattr(settings, 'TRUCK_PROFILE_VERSION', 'v1'),
    }


def compute_request_hash(normalized_request: dict[str, Any]) -> str:
    """Compute sha256 hex digest of canonical sorted JSON."""
    canonical_json = json.dumps(
        normalized_request, sort_keys=True, separators=(',', ':')
    )
    return hashlib.sha256(canonical_json.encode('utf-8')).hexdigest()


def get_cached_analysis(client_id: str, request_hash: str) -> RouteAnalysis | None:
    """Look up latest analysis for this client and hash within the TTL window (default 1h)."""
    
    ttl_seconds = getattr(settings, 'PLAN_CACHE_TTL_SECONDS', 3600)
    cutoff = timezone.now() - timedelta(seconds=ttl_seconds)

    return (
        RouteAnalysis.objects.filter(
            client_id=client_id,
            request_hash=request_hash,
            created_at__gte=cutoff,
        )
        .order_by('-created_at')
        .first()
    )


def build_reused_response(analysis: RouteAnalysis) -> dict[str, Any]:
    """Return a deep copy of the stored response_payload with reused set to true."""
    payload = copy.deepcopy(analysis.response_payload)
    payload['reused'] = True
    return payload
