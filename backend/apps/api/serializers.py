from datetime import UTC, datetime, timedelta
from typing import Any

import polyline
from rest_framework import serializers

MAX_LOAD_WEIGHT_LBS = 150_000
COORDINATE_PRECISION_TOLERANCE = (
    0.001  # Minimum coordinate delta required between origin and dest.
)

# Route planning serializers


class AwareDateTimeField(serializers.DateTimeField):
    """DateTime field that strictly requires an explicit timezone offset and normalizes to UTC."""

    def to_internal_value(self, value: Any) -> datetime:
        if isinstance(value, str):
            try:
                parsed = datetime.fromisoformat(value)
                if parsed.tzinfo is None:
                    raise serializers.ValidationError(
                        "Departure time must include an explicit timezone offset (e.g. 'Z' or '+00:00')."
                    )
            except ValueError:
                pass  # Let parent class handle invalid format errors

        dt = super().to_internal_value(value)
        return dt.astimezone(UTC)


class PlanRouteQuerySerializer(serializers.Serializer):
    """Validates and normalizes query parameters for GET /api/v1/routes/plan/."""

    origin_lat = serializers.FloatField(min_value=-90.0, max_value=90.0)
    origin_lng = serializers.FloatField(min_value=-180.0, max_value=180.0)
    origin_name = serializers.CharField(max_length=255, required=False, allow_blank=True)

    dest_lat = serializers.FloatField(min_value=-90.0, max_value=90.0)
    dest_lng = serializers.FloatField(min_value=-180.0, max_value=180.0)
    dest_name = serializers.CharField(max_length=255, required=False, allow_blank=True)

    departure_time = AwareDateTimeField()
    load_weight_lbs = serializers.IntegerField(
        min_value=0,
        max_value=MAX_LOAD_WEIGHT_LBS,
        default=0,
        required=False,
    )

    def validate_departure_time(self, value: datetime) -> datetime:
        now_utc = datetime.now(UTC)
        if value < now_utc - timedelta(seconds=60):
            raise serializers.ValidationError('Departure time cannot be in the past.')

        max_future = now_utc + timedelta(days=16)
        if value > max_future:
            raise serializers.ValidationError(
                'Departure time cannot be beyond 16 days.'
            )
        return value

    def validate(self, attrs: dict[str, Any]) -> dict[str, Any]:
        origin_lat = attrs['origin_lat']
        origin_lng = attrs['origin_lng']
        dest_lat = attrs['dest_lat']
        dest_lng = attrs['dest_lng']

        if (
            abs(origin_lat - dest_lat) < COORDINATE_PRECISION_TOLERANCE
            and abs(origin_lng - dest_lng) < COORDINATE_PRECISION_TOLERANCE
        ):
            raise serializers.ValidationError(
                'Origin and destination cannot be the same location (within 0.001°).'
            )

        origin_name = attrs.get('origin_name') or f'{origin_lat},{origin_lng}'
        dest_name = attrs.get('dest_name') or f'{dest_lat},{dest_lng}'

        return {
            'origin': {
                'lat': origin_lat,
                'lng': origin_lng,
                'name': origin_name,
            },
            'destination': {
                'lat': dest_lat,
                'lng': dest_lng,
                'name': dest_name,
            },
            'departure_time': attrs['departure_time'],
            'load_weight_lbs': attrs.get('load_weight_lbs', 0),
        }


# Mapbox serializers
class MapboxAnnotationSerializer(serializers.Serializer):
    """Serializer for distance annotations between geometry vertices."""

    distance = serializers.ListField(
        child=serializers.FloatField(min_value=0.0),
        required=False,
        default=list,
    )


class MapboxLegSerializer(serializers.Serializer):
    """Serializer for individual leg summaries and annotations in a route."""

    summary = serializers.CharField(required=False, allow_null=True, allow_blank=True)
    annotation = MapboxAnnotationSerializer(required=False, allow_null=True)


class MapboxRouteSerializer(serializers.Serializer):
    """Serializer for route fields we care about."""

    distance = serializers.FloatField(min_value=0.0)
    duration = serializers.FloatField(required=False, allow_null=True, min_value=0.0)
    duration_typical = serializers.FloatField(
        required=False, allow_null=True, min_value=0.0
    )
    geometry = serializers.CharField()
    legs = serializers.ListField(
        child=MapboxLegSerializer(), required=False, default=list
    )

    def validate(self, attrs: dict[str, Any]) -> dict[str, Any]:
        geometry = attrs.get('geometry', '')
        try:
            points = polyline.decode(geometry)
        except Exception:
            raise serializers.ValidationError('Invalid encoded polyline geometry.')

        if not points:
            raise serializers.ValidationError('Route geometry cannot be empty.')

        legs = attrs.get('legs', [])
        total_annotation_distances = 0
        has_annotation = False

        for leg in legs:
            ann = leg.get('annotation')
            if ann and 'distance' in ann:
                has_annotation = True
                total_annotation_distances += len(ann['distance'])

        expected_segments = max(0, len(points) - 1)
        if expected_segments > 0 and not has_annotation:
            raise serializers.ValidationError(
                'Route is missing required distance annotations.'
            )

        if total_annotation_distances != expected_segments:
            raise serializers.ValidationError(
                f'Distance annotations count ({total_annotation_distances}) does not match '
                f'geometry segment count ({expected_segments}).'
            )

        return attrs


class MapboxWaypointSerializer(serializers.Serializer):
    """Serializer for snapped waypoint locations [lng, lat]."""

    location = serializers.ListField(
        child=serializers.FloatField(),
        min_length=2,
        max_length=2,
    )


class MapboxDirectionsResponseSerializer(serializers.Serializer):
    """Validator ensuring proper typing and structure for Mapbox Directions responses."""

    code = serializers.CharField()
    message = serializers.CharField(required=False, allow_null=True, allow_blank=True)
    routes = serializers.ListField(
        child=MapboxRouteSerializer(), required=False, default=list
    )
    waypoints = serializers.ListField(
        child=MapboxWaypointSerializer(), required=False, default=list
    )


# Open-Meteo serializers
class OpenMeteoHourlyDataSerializer(serializers.Serializer):
    """Serializer for hourly weather metric arrays."""

    time = serializers.ListField(child=serializers.CharField())
    temperature_2m = serializers.ListField(
        child=serializers.FloatField(allow_null=True),
        required=False,
        default=list,
    )
    wind_speed_10m = serializers.ListField(
        child=serializers.FloatField(allow_null=True)
    )
    rain = serializers.ListField(child=serializers.FloatField(allow_null=True))
    snowfall = serializers.ListField(child=serializers.FloatField(allow_null=True))


class OpenMeteoLocationForecastSerializer(serializers.Serializer):
    """Serializer for a single location forecast from Open-Meteo."""

    latitude = serializers.FloatField()
    longitude = serializers.FloatField()
    hourly = OpenMeteoHourlyDataSerializer()
