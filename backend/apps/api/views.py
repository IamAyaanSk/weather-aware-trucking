import uuid
from datetime import UTC

from django.conf import settings
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import (
    api_view,
    authentication_classes,
    permission_classes,
)
from rest_framework.permissions import AllowAny
from rest_framework.request import Request
from rest_framework.response import Response

from apps.api.auth import get_expected_token
from apps.api.domain.aggregation import compute_route_metrics
from apps.api.domain.checkpoints import (
    determine_sample_interval_miles,
    generate_checkpoints_for_route,
)
from apps.api.domain.heatmap import build_corridor_heatmap
from apps.api.domain.ranking import rank_routes
from apps.api.domain.types import Checkpoint
from apps.api.models import RouteAnalysis
from apps.api.permissions import HasSiteAccess
from apps.api.serializers import PlanRouteQuerySerializer
from apps.api.services.analysis_cache import (
    build_reused_response,
    compute_request_hash,
    get_cached_analysis,
    normalize_plan_request,
)
from apps.api.services.open_meteo import fetch_weather_for_routes
from apps.api.services.routing import fetch_routes


def _get_client_id(request: Request) -> str:
    """Extract client ID from X-Client-Id header, defaulting to 'anonymous'."""
    client_id = request.headers.get('x-client-id', '').strip()
    return client_id or 'anonymous'


@api_view(['GET'])
@authentication_classes([])
@permission_classes([AllowAny])
def health(_request: Request) -> Response:
    """Liveness check used by the hosting platform."""
    return Response({'status': 'ok'})


@api_view(['POST'])
@authentication_classes([])
@permission_classes([AllowAny])
def verify_access_code(request: Request) -> Response:
    """Verify shared site access password and return derived bearer token."""
    entered_password = str(request.data.get('password', '')).strip()
    configured_password = str(getattr(settings, 'SITE_ACCESS_PASSWORD', '')).strip()

    if not configured_password or entered_password == configured_password:
        return Response(
            {
                'status': 'ok',
                'token': get_expected_token(),
            },
            status=status.HTTP_200_OK,
        )

    return Response(
        {
            'error': {
                'code': 'invalid_passcode',
                'message': 'Incorrect access password. Please try again.',
            }
        },
        status=status.HTTP_401_UNAUTHORIZED,
    )


@api_view(['GET'])
@authentication_classes([])
@permission_classes([HasSiteAccess])
def plan_route(request: Request) -> Response:
    """Plan routes or return a cached analysis within 1 hour."""
    serializer = PlanRouteQuerySerializer(data=request.query_params)
    serializer.is_valid(raise_exception=True)
    validated_data = serializer.validated_data

    client_id = _get_client_id(request)
    normalized_request = normalize_plan_request(validated_data)
    request_hash = compute_request_hash(normalized_request)

    cached_analysis = get_cached_analysis(client_id, request_hash)
    if cached_analysis:
        response_data = build_reused_response(cached_analysis)
        return Response(response_data, status=status.HTTP_200_OK)

    # Cache miss

    routes_data = fetch_routes(
        origin=validated_data['origin'],
        destination=validated_data['destination'],
        departure_time=validated_data['departure_time'],
        load_weight_lbs=validated_data['load_weight_lbs'],
    )

    departure_time = validated_data['departure_time']
    snapped_origin = routes_data.get('snapped_origin')
    snapped_destination = routes_data.get('snapped_destination')

    routes = routes_data['routes']
    routes_checkpoints: list[list[Checkpoint]] = []

    for route in routes:
        cps = generate_checkpoints_for_route(
            geometry=route['geometry'],
            total_distance_miles=route['total_distance_miles'],
            avg_speed_mph=route['avg_speed_mph'],
            departure_time=departure_time,
            segment_distances_meters=route.get('distance_annotations', []),
            snapped_origin=snapped_origin,
            snapped_destination=snapped_destination,
        )
        routes_checkpoints.append(cps)

    point_forecasts = fetch_weather_for_routes(
        routes_checkpoints=routes_checkpoints,
        departure_time=departure_time,
        load_weight_lbs=validated_data['load_weight_lbs'],
    )

    # Route matrics and checkpoints association
    for route, cps in zip(routes, routes_checkpoints, strict=True):
        metrics = compute_route_metrics(cps, route['total_distance_miles'])
        route['metrics'] = metrics.to_dict()
        route['checkpoints'] = [cp.to_dict() for cp in cps]

    # Rank routes and assign recommendation flag
    ranked_routes, recommended_route_id, no_safe_route = rank_routes(routes)

    warnings = list(routes_data.get('warnings', []))
    if no_safe_route:
        warnings.append(
            {
                'code': 'no_safe_route',
                'message': 'All routes contain No Travel conditions. No route is recommended.',
            }
        )

    # Heatmap
    corridor_heatmap = build_corridor_heatmap(
        routes_checkpoints=routes_checkpoints,
        point_forecasts=point_forecasts,
        departure_time=departure_time,
        load_weight_lbs=validated_data['load_weight_lbs'],
    )

    # Extract metadata
    max_arrival_offset = max(
        (cp.arrival_hour_offset for cps in routes_checkpoints for cp in cps),
        default=48,
    )
    max_forecast_hours = max(48, max_arrival_offset)

    recommended_route = next(
        (r for r in ranked_routes if r['id'] == recommended_route_id),
        ranked_routes[0] if ranked_routes else None,
    )
    sample_interval_miles = (
        determine_sample_interval_miles(recommended_route['total_distance_miles'])
        if recommended_route
        else None
    )

    clean_routes = [
        {
            'id': r['id'],
            'name': r['name'],
            'is_recommended': r['is_recommended'],
            'total_distance_miles': r['total_distance_miles'],
            'total_duration_hours': r['total_duration_hours'],
            'avg_speed_mph': r['avg_speed_mph'],
            'metrics': r['metrics'],
            'overview_polyline': r['geometry'],
            'checkpoints': r['checkpoints'],
        }
        for r in ranked_routes
    ]

    analysis_id: str = str(uuid.uuid4())
    created_at_dt = timezone.now()
    created_at_iso = created_at_dt.astimezone(UTC).strftime('%Y-%m-%dT%H:%M:%SZ')
    departure_time_iso = departure_time.astimezone(UTC).strftime('%Y-%m-%dT%H:%M:%SZ')

    request_meta = {
        'origin': validated_data['origin'],
        'destination': validated_data['destination'],
        'departure_time': departure_time_iso,
        'load_weight_lbs': validated_data['load_weight_lbs'],
        'sample_interval_miles': sample_interval_miles,
        'max_forecast_hours': max_forecast_hours,
    }

    response_payload = {
        'analysis_id': analysis_id,
        'created_at': created_at_iso,
        'reused': False,
        'request_meta': request_meta,
        'recommended_route_id': recommended_route_id,
        'routes': clean_routes,
        'corridor_heatmap': corridor_heatmap.to_dict(),
        'warnings': warnings,
    }

    # Save to database for 1-hour reuse
    RouteAnalysis.objects.create(
        id=analysis_id,
        client_id=client_id,
        request_hash=request_hash,
        origin=validated_data['origin']['name'],
        destination=validated_data['destination']['name'],
        departure_time=departure_time,
        load_weight_lbs=validated_data['load_weight_lbs'],
        sample_interval_miles=sample_interval_miles,
        request_meta=request_meta,
        response_payload=response_payload,
        recommended_route_id=recommended_route_id,
        recommended_route_name=(
            recommended_route['name'] if recommended_route else None
        ),
        total_distance_miles=(
            recommended_route['total_distance_miles'] if recommended_route else None
        ),
        total_duration_hours=(
            recommended_route['total_duration_hours'] if recommended_route else None
        ),
        created_at=created_at_dt,
    )

    return Response(response_payload, status=status.HTTP_200_OK)
