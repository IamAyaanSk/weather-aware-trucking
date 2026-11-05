import logging
from datetime import UTC, datetime
from typing import Any

import polyline
from django.conf import settings

from apps.api.domain.geo import calculate_segment_distances_meters
from apps.api.exceptions import (
    UnprocessableEntityError,
    UpstreamServiceError,
)
from apps.api.services.http import request_with_retry
from apps.api.types import (
    ParsedRoute,
    RoutesResult,
    RouteWarning,
    SnappedCoordinate,
)

logger = logging.getLogger(__name__)

METERS_TO_MILES = 1609.344
SECONDS_TO_HOURS = 3600.0
LBS_TO_KG = 0.45359237


def calculate_truck_dimensions(
    load_weight_lbs: int,
) -> tuple[float, float, float, int, int, int]:
    """Calculate metric truck dimensions and gross weight for TomTom commercial truck routing.

    Returns:
        (height_m, width_m, length_m, gross_weight_kg, axle_weight_kg, axle_count)
    """
    height_mm = getattr(settings, 'TRUCK_HEIGHT_MM', 4114)
    width_mm = getattr(settings, 'TRUCK_WIDTH_MM', 2590)
    length_mm = getattr(settings, 'TRUCK_LENGTH_MM', 21945)
    axle_count = getattr(settings, 'TRUCK_AXLE_COUNT', 5)
    tare_lbs = getattr(settings, 'TRUCK_TARE_WEIGHT_LBS', 30000)

    height_m = round(height_mm / 1000.0, 3)
    width_m = round(width_mm / 1000.0, 3)
    length_m = round(length_mm / 1000.0, 3)

    gross_weight_lbs = load_weight_lbs + tare_lbs
    gross_weight_kg = int(round(gross_weight_lbs * LBS_TO_KG))
    axle_weight_kg = int(round(gross_weight_kg / max(1, axle_count)))

    return height_m, width_m, length_m, gross_weight_kg, axle_weight_kg, axle_count


def extract_route_name(route_dict: dict[str, Any], fallback_index: int) -> str:
    """Extract highway/road name summary from guidance instructions, or fallback to 'Route {index}'."""
    guidance = route_dict.get('guidance')
    if not isinstance(guidance, dict):
        return f'Route {fallback_index}'

    instructions = guidance.get('instructions')
    if not isinstance(instructions, list):
        return f'Route {fallback_index}'

    roads: list[str] = []
    seen: set[str] = set()

    for inst in instructions:
        if not isinstance(inst, dict):
            continue
        road = inst.get('roadNumber') or inst.get('street')
        if road and isinstance(road, str) and road.strip():
            clean_road = road.strip()
            if clean_road not in seen:
                seen.add(clean_road)
                roads.append(clean_road)
                if len(roads) >= 2:
                    break

    if roads:
        return ', '.join(roads)
    return f'Route {fallback_index}'


def fetch_tomtom_routes(
    origin: dict[str, Any],
    destination: dict[str, Any],
    departure_time: datetime,
    load_weight_lbs: int,
) -> RoutesResult:
    """Fetch commercial truck routes from TomTom Routing API.

    Features:
    - Dedicated 'truck' travel mode with commercial vehicle compliance.
    - Physical clearance (height, width, length) and weight limits (gross + axle).
    - Alternative paths via maxAlternatives and alternativeType=anyRoute.
    - Automatic segment distance computation and polyline encoding.
    """
    api_key = getattr(settings, 'TOMTOM_API_KEY', '').strip()
    if not api_key:
        logger.error('TOMTOM_API_KEY is not configured.')
        raise UpstreamServiceError('TomTom API key is not configured on the server.')

    base_url = getattr(
        settings,
        'TOMTOM_ROUTING_BASE_URL',
        'https://api.tomtom.com/routing/1',
    ).rstrip('/')

    locations = f'{origin["lat"]:.6f},{origin["lng"]:.6f}:{destination["lat"]:.6f},{destination["lng"]:.6f}'
    url = f'{base_url}/calculateRoute/{locations}/json'

    depart_at_str = departure_time.astimezone(UTC).strftime('%Y-%m-%dT%H:%M:%SZ')
    (
        height_m,
        width_m,
        length_m,
        weight_kg,
        axle_weight_kg,
        axle_count,
    ) = calculate_truck_dimensions(load_weight_lbs)

    max_alts = int(getattr(settings, 'TOMTOM_MAX_ALTERNATIVES', 3))

    params: dict[str, Any] = {
        'key': api_key,
        'travelMode': 'truck',
        'vehicleCommercial': 'true',
        'traffic': 'true',
        'departAt': depart_at_str,
        'maxAlternatives': max_alts,
        'alternativeType': 'anyRoute',
        'extendedRouteRepresentation': 'distance',
        'instructionsType': 'text',
        'language': getattr(settings, 'TOMTOM_LANGUAGE', 'en-US'),
        'vehicleHeight': height_m,
        'vehicleWidth': width_m,
        'vehicleLength': length_m,
        'vehicleWeight': weight_kg,
        'vehicleAxleWeight': axle_weight_kg,
        'vehicleNumberOfAxles': axle_count,
    }

    response = request_with_retry('GET', url, params=params)

    if response.status_code in (400, 422):
        logger.error('TomTom returned %d: %s', response.status_code, response.text)
        raise UpstreamServiceError(
            'Invalid request parameters sent to TomTom Routing API.'
        )

    if response.status_code in (401, 403):
        logger.error(
            'TomTom authentication failed with status %d', response.status_code
        )
        raise UpstreamServiceError('TomTom API key authentication failed.')

    if response.status_code != 200:
        raise UpstreamServiceError(
            f'TomTom Routing API failed with status {response.status_code}.'
        )

    try:
        raw_data = response.json()
    except Exception as exc:
        raise UpstreamServiceError('Malformed JSON received from TomTom API.') from exc

    if not isinstance(raw_data, dict):
        raise UpstreamServiceError(
            'Unexpected response structure received from TomTom API.'
        )

    # Check for TomTom error payloads
    detailed_error = raw_data.get('detailedError') or raw_data.get('error')
    if detailed_error and isinstance(detailed_error, dict):
        err_code = detailed_error.get('code', '')
        if err_code in ('NO_ROUTE_FOUND', 'MAP_MATCHING_FAILURE'):
            raise UnprocessableEntityError(
                'No commercial truck route found between origin and destination.'
            )
        err_msg = detailed_error.get('message', 'Unknown TomTom error.')
        logger.error('TomTom detailed error: %s (%s)', err_msg, err_code)
        raise UpstreamServiceError(f'TomTom error: {err_msg}')

    raw_routes = raw_data.get('routes')
    if not raw_routes or not isinstance(raw_routes, list):
        raise UnprocessableEntityError(
            'No routes returned by TomTom for the given coordinates.'
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
        summary = r.get('summary', {})
        distance_m = summary.get('lengthInMeters')
        duration_s = summary.get('travelTimeInSeconds')

        if distance_m is None or duration_s is None:
            raise UpstreamServiceError(
                f'TomTom route {idx + 1} is missing distance or duration data.'
            )

        distance_m = float(distance_m)
        duration_s = float(duration_s)
        distance_miles = distance_m / METERS_TO_MILES
        duration_hours = duration_s / SECONDS_TO_HOURS
        avg_speed_mph = distance_miles / duration_hours if duration_hours > 0 else 0.0

        legs = r.get('legs', [])
        all_points: list[tuple[float, float]] = []

        for leg in legs:
            if isinstance(leg, dict):
                for pt in leg.get('points', []):
                    lat = pt.get('latitude')
                    lng = pt.get('longitude')
                    if lat is not None and lng is not None:
                        all_points.append((round(float(lat), 5), round(float(lng), 5)))

        if len(all_points) <= 1:
            raise UpstreamServiceError(
                f'TomTom route {idx + 1} returned insufficient coordinates.'
            )

        encoded_geometry = polyline.encode(all_points)

        # Compute segment distances between vertices scaled to TomTom total distance
        distance_annotations = calculate_segment_distances_meters(
            all_points, target_total_meters=distance_m
        )

        name = extract_route_name(r, idx + 1)

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
                'geometry': encoded_geometry,
                'legs': legs,
                'distance_annotations': distance_annotations,
            }
        )

    # Extract clean snapped coordinates from first route's decoded points
    first_route_points = polyline.decode(parsed_routes[0]['geometry'])
    if first_route_points:
        snapped_origin: SnappedCoordinate = {
            'lat': round(first_route_points[0][0], 5),
            'lng': round(first_route_points[0][1], 5),
        }
        snapped_destination: SnappedCoordinate = {
            'lat': round(first_route_points[-1][0], 5),
            'lng': round(first_route_points[-1][1], 5),
        }
    else:
        snapped_origin = {'lat': origin['lat'], 'lng': origin['lng']}
        snapped_destination = {'lat': destination['lat'], 'lng': destination['lng']}

    return {
        'routes': parsed_routes,
        'snapped_origin': snapped_origin,
        'snapped_destination': snapped_destination,
        'warnings': warnings,
    }
