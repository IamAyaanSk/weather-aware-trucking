from rest_framework import status
from rest_framework.decorators import (
    api_view,
    authentication_classes,
    permission_classes,
)
from rest_framework.permissions import AllowAny
from rest_framework.request import Request
from rest_framework.response import Response

from apps.api.domain.checkpoints import generate_checkpoints_for_route
from apps.api.domain.heatmap import build_corridor_heatmap
from apps.api.domain.types import Checkpoint
from apps.api.serializers import PlanRequestSerializer
from apps.api.services.analysis_cache import (
    build_reused_response,
    compute_request_hash,
    get_cached_analysis,
    normalize_plan_request,
)
from apps.api.services.mapbox import fetch_mapbox_routes
from apps.api.services.open_meteo import fetch_weather_for_routes


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
def plan_route(request: Request) -> Response:
    """Plan routes or return a cached analysis within 1 hour."""

    serializer = PlanRequestSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    validated_data = serializer.validated_data

    client_id = _get_client_id(request)
    normalized_request = normalize_plan_request(validated_data)
    request_hash = compute_request_hash(normalized_request)

    cached_analysis = get_cached_analysis(client_id, request_hash)
    if cached_analysis:
        response_data = build_reused_response(cached_analysis)
        return Response(response_data, status=status.HTTP_200_OK)
    else:
        routes_data = fetch_mapbox_routes(
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

        for route, cps in zip(routes, routes_checkpoints, strict=True):
            route['checkpoints'] = [cp.to_dict() for cp in cps]

        corridor_heatmap = build_corridor_heatmap(
            routes_checkpoints=routes_checkpoints,
            point_forecasts=point_forecasts,
            departure_time=departure_time,
            load_weight_lbs=validated_data['load_weight_lbs'],
        )
        routes_data['corridor_heatmap'] = corridor_heatmap.to_dict()

        return Response(routes_data, status=status.HTTP_200_OK)
