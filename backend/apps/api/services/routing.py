import logging
from datetime import datetime
from typing import Any

from django.conf import settings

from apps.api.services.mapbox import fetch_mapbox_routes
from apps.api.services.tomtom import fetch_tomtom_routes
from apps.api.types import RoutesResult

logger = logging.getLogger(__name__)


def fetch_routes(
    origin: dict[str, Any],
    destination: dict[str, Any],
    departure_time: datetime,
    load_weight_lbs: int,
) -> RoutesResult:
    """Fetch truck routes using the configured routing provider (TomTom or Mapbox).

    Defaults to TomTom for true commercial truck restrictions and up to 3+ alternative routes.
    Falls back gracefully to Mapbox if TomTom API key is not configured.
    """
    provider = getattr(settings, 'ROUTING_PROVIDER', 'tomtom').lower().strip()

    if provider == 'tomtom':
        tomtom_key = getattr(settings, 'TOMTOM_API_KEY', '').strip()
        mapbox_token = getattr(settings, 'MAPBOX_ACCESS_TOKEN', '').strip()

        if not tomtom_key and mapbox_token:
            logger.warning(
                'ROUTING_PROVIDER is "tomtom" but TOMTOM_API_KEY is unset; falling back to Mapbox Directions.'
            )
            return fetch_mapbox_routes(
                origin=origin,
                destination=destination,
                departure_time=departure_time,
                load_weight_lbs=load_weight_lbs,
            )

        return fetch_tomtom_routes(
            origin=origin,
            destination=destination,
            departure_time=departure_time,
            load_weight_lbs=load_weight_lbs,
        )

    return fetch_mapbox_routes(
        origin=origin,
        destination=destination,
        departure_time=departure_time,
        load_weight_lbs=load_weight_lbs,
    )
