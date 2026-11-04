import logging
from datetime import UTC, datetime
from typing import Any

from django.conf import settings

from apps.api.exceptions import (
    UnprocessableEntityError,
    UpstreamServiceError,
)
from apps.api.serializers import MapboxDirectionsResponseSerializer
from apps.api.services.http import request_with_retry
from apps.api.types import (
    MapboxResponseData,
    MapboxRoutesResult,
    ParsedRoute,
    RouteWarning,
    SnappedCoordinate,
)

logger = logging.getLogger(__name__)

METERS_TO_MILES = 1609.344
SECONDS_TO_HOURS = 3600.0
LBS_TO_KG = 0.45359237


def validate_mapbox_response(raw_data: Any) -> MapboxResponseData:
    """Validate and strictly type check the raw response from Mapbox Directions API.

    Ensures distance, duration, geometry, legs, and waypoint coordinates are present
    and properly typed. Raises UpstreamServiceError on malformed structures.
    """
    if not isinstance(raw_data, dict):
        raise UpstreamServiceError(
            'Malformed response structure received from Mapbox Directions API.'
        )

    serializer = MapboxDirectionsResponseSerializer(data=raw_data)
    if not serializer.is_valid():
        logger.error('Mapbox response validation failed: %s', serializer.errors)
        raise UpstreamServiceError(
            'Invalid response structure received from Mapbox Directions API.'
        )

    return serializer.validated_data




def calculate_truck_dimensions(
    load_weight_lbs: int,
) -> tuple[float, float, float]:
    """Calculate metric truck height (m), width (m), and gross weight (metric tons)."""
    height_mm = getattr(settings, 'TRUCK_HEIGHT_MM', 4114)
    width_mm = getattr(settings, 'TRUCK_WIDTH_MM', 2590)
    tare_lbs = getattr(settings, 'TRUCK_TARE_WEIGHT_LBS', 30000)

    height_m = round(height_mm / 1000.0, 3)
    width_m = round(width_mm / 1000.0, 3)
    gross_weight_lbs = load_weight_lbs + tare_lbs
    weight_metric_tons = round((gross_weight_lbs * LBS_TO_KG) / 1000.0, 2)

    return height_m, width_m, weight_metric_tons


def fetch_mapbox_routes(
    origin: dict[str, Any],
    destination: dict[str, Any],
    departure_time: datetime,
    load_weight_lbs: int,
) -> MapboxRoutesResult:
    """Fetch driving-traffic routes from Mapbox Directions API with truck limits.

    Conforms to AGENTS.md §7.1 and §6.3.
    """
    access_token = getattr(settings, 'MAPBOX_ACCESS_TOKEN', '').strip()
    if not access_token:
        logger.error('MAPBOX_ACCESS_TOKEN is not configured.')
        raise UpstreamServiceError(
            'Mapbox access token is not configured on the server.'
        )

    base_url = getattr(
        settings,
        'MAPBOX_DIRECTIONS_BASE_URL',
        'https://api.mapbox.com/directions/v5',
    ).rstrip('/')
    profile = getattr(settings, 'MAPBOX_PROFILE', 'driving-traffic')

    coords = (
        f'{origin["lng"]},{origin["lat"]};{destination["lng"]},{destination["lat"]}'
    )
    url = f'{base_url}/mapbox/{profile}/{coords}'

    depart_at_str = departure_time.astimezone(UTC).strftime('%Y-%m-%dT%H:%M:%SZ')
    height_m, width_m, weight_tons = calculate_truck_dimensions(load_weight_lbs)

    params: dict[str, Any] = {
        'alternatives': 'true',
        'geometries': 'polyline',
        'overview': 'full',
        'steps': 'false',
        'notifications': 'none',
        'depart_at': depart_at_str,
        'max_height': height_m,
        'max_width': width_m,
        'max_weight': weight_tons,
        'access_token': access_token,
    }

    response = request_with_retry('GET', url, params=params)

    if response.status_code == 422:
        logger.error('Mapbox returned 422 InvalidInput')
        raise UpstreamServiceError(
            'Invalid request parameters sent to Mapbox Directions API.'
        )

    if response.status_code != 200:
        raise UpstreamServiceError(
            f'Mapbox Directions API failed with status {response.status_code}.'
        )

    validated_data = validate_mapbox_response(response.json())
    code = validated_data['code']

    if code in ('NoRoute', 'NoSegment'):
        raise UnprocessableEntityError(
            'No driving route found between origin and destination.'
        )

    if code != 'Ok':
        raise UnprocessableEntityError(
            f'Mapbox route resolution failed with code: {code}'
        )

    raw_routes = validated_data['routes']
    if not raw_routes:
        raise UnprocessableEntityError(
            'No routes returned by Mapbox for the given coordinates.'
        )

    warnings: list[RouteWarning] = []

    if len(raw_routes) < 3:
        warnings.append(
            {
                'code': 'fewer_than_three_routes',
                'message': 'There are less than 3 routes to reach your destination.',
            }
        )


    parsed_routes: list[ParsedRoute] = []

    for idx, r in enumerate(raw_routes[:3]):
        route_id = f'route_{idx + 1}'

        legs = r.get('legs', [])
        summary = legs[0].get('summary') if legs else None
        name = summary if summary else f'Route {idx + 1}'

        distance_m = r['distance']
        duration_s = r['duration']

        if duration_s is None:
            # Try typical duration wuth warning
            duration_s = r['duration_typical']

            if duration_s is not None:
                warnings.append(
                    {
                        'code': 'duration_approximated',
                        'message': f'Route {idx + 1} duration was missing; duration_typical was used.',
                    }
                )

        if duration_s is None:
            raise UpstreamServiceError(
                f'Mapbox route {idx + 1} is missing duration data.'
            )

        duration_s = float(duration_s)
        distance_miles = distance_m / METERS_TO_MILES
        duration_hours = duration_s / SECONDS_TO_HOURS
        avg_speed_mph = distance_miles / duration_hours if duration_hours > 0 else 0.0

        geometry = r['geometry']

        parsed_routes.append(
            {
                'id': route_id,
                'source_index': idx,
                'name': name,
                'distance_meters': distance_m,
                'duration_seconds': duration_s,
                'total_distance_miles': round(distance_miles, 2),
                'total_duration_hours': round(duration_hours, 2),
                'avg_speed_mph': round(avg_speed_mph, 1),
                'geometry': geometry,
                'legs': legs,
            }
        )

    # Extract snapped road coordinates from waypoints
    waypoints = validated_data['waypoints']

    snapped_origin: SnappedCoordinate | None = None
    snapped_destination: SnappedCoordinate | None = None

    if waypoints:
        orig_loc = waypoints[0]['location']
        snapped_origin = {'lng': orig_loc[0], 'lat': orig_loc[1]}

        dest_loc = waypoints[-1]['location']
        snapped_destination = {'lng': dest_loc[0], 'lat': dest_loc[1]}

    return {
        'routes': parsed_routes,
        'snapped_origin': snapped_origin
        or {'lat': origin['lat'], 'lng': origin['lng']},
        'snapped_destination': snapped_destination
        or {'lat': destination['lat'], 'lng': destination['lng']},
        'warnings': warnings,
    }
