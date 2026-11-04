from datetime import UTC, datetime, timedelta
from typing import Any

from rest_framework import serializers

SAMPLE_INTERVAL_CHOICES = (10, 25, 50)
MAX_LOAD_WEIGHT_LBS = (
    150_000  
)
COORDINATE_PRECISION_TOLERANCE = (
    0.001  # Minimum coordinate delta required between origin and dest.
)


class LocationSerializer(serializers.Serializer):
    """Origin or destination coordinates and display name."""

    name = serializers.CharField(max_length=255, trim_whitespace=True)
    lat = serializers.FloatField(min_value=-90.0, max_value=90.0)
    lng = serializers.FloatField(min_value=-180.0, max_value=180.0)

    def validate_name(self, value: str) -> str:
        trimmed = value.strip()
        if not trimmed:
            raise serializers.ValidationError('Location name cannot be empty.')
        return trimmed


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


class PlanRequestSerializer(serializers.Serializer):
    """Validates the input payload for POST /api/v1/routes/plan/."""

    origin = LocationSerializer()
    destination = LocationSerializer()
    departure_time = AwareDateTimeField()
    load_weight_lbs = serializers.IntegerField(
        min_value=0,
        max_value=MAX_LOAD_WEIGHT_LBS,
    )
    sample_interval_miles = serializers.IntegerField()

    def validate_departure_time(self, value: datetime) -> datetime:
        now_utc = datetime.now(UTC)
        
        if value < now_utc - timedelta(seconds=60):
            raise serializers.ValidationError('Departure time cannot be in the past.')

        # Open-Meteo supports up to 16 days of hourly forecast so mange accordingly
        max_future = now_utc + timedelta(days=16)
        if value > max_future:
            raise serializers.ValidationError(
                "Departure time cannot be beyond 16 days."
            )

        return value

    def validate_sample_interval_miles(self, value: int) -> int:
        if value not in SAMPLE_INTERVAL_CHOICES:
            raise serializers.ValidationError(
                f'Sample interval must be one of {SAMPLE_INTERVAL_CHOICES} miles.'
            )
        return value

    def validate(self, attrs: dict[str, Any]) -> dict[str, Any]:
        origin = attrs.get('origin')
        destination = attrs.get('destination')

        if origin and destination:
            lat_diff = abs(origin['lat'] - destination['lat'])
            lng_diff = abs(origin['lng'] - destination['lng'])
            if (
                lat_diff < COORDINATE_PRECISION_TOLERANCE
                and lng_diff < COORDINATE_PRECISION_TOLERANCE
            ):
                raise serializers.ValidationError(
                    'Origin and destination cannot be the same location (within 0.001°).'
                )

        return attrs
