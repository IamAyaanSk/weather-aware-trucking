import concurrent.futures
import logging
import math
from datetime import UTC, datetime, timedelta
from typing import Any

from django.conf import settings

from apps.api.domain.risk import calculate_checkpoint_risk
from apps.api.domain.types import Checkpoint
from apps.api.exceptions import UpstreamServiceError
from apps.api.serializers import OpenMeteoLocationForecastSerializer
from apps.api.services.http import request_with_retry
from apps.api.types import OpenMeteoLocationForecastData

logger = logging.getLogger(__name__)


def validate_open_meteo_response(
    raw_data: Any,
) -> list[OpenMeteoLocationForecastData]:
    """Validate and type check Open-Meteo API response.

    Handles both single-location dictionary responses and multi-location lists.
    Raises UpstreamServiceError if response structure is malformed.
    """
    if isinstance(raw_data, dict):
        items = [raw_data]
    elif isinstance(raw_data, list):
        items = raw_data
    else:
        raise UpstreamServiceError(
            'Malformed response structure received from Open-Meteo API.'
        )

    validated_forecasts: list[OpenMeteoLocationForecastData] = []
    for idx, item in enumerate(items):
        serializer = OpenMeteoLocationForecastSerializer(data=item)
        if not serializer.is_valid():
            logger.error(
                'Open-Meteo response validation failed for index %d: %s',
                idx,
                serializer.errors,
            )
            raise UpstreamServiceError(
                'Invalid response structure received from Open-Meteo API.'
            )
        validated_forecasts.append(serializer.validated_data)

    return validated_forecasts


def fetch_weather_for_route_checkpoints(
    checkpoints: list[Checkpoint],
    departure_time: datetime,
    load_weight_lbs: int,
) -> None:
    """Fetch Open-Meteo weather for all checkpoints of a route in a single batch request."""
    if not checkpoints:
        return

    dep_utc = (
        departure_time.astimezone(UTC)
        if departure_time.tzinfo
        else departure_time.replace(tzinfo=UTC)
    )

    start_hour_str = dep_utc.strftime('%Y-%m-%dT%H:00')

    # Check if trip is greater than 48 hrs --> We need to account the extra time too for accurate results and forecast
    max_arrival_offset = max(cp.arrival_hour_offset for cp in checkpoints)
    forecast_hours = max(48, max_arrival_offset)

    end_time = dep_utc + timedelta(hours=forecast_hours)
    end_hour_str = end_time.strftime('%Y-%m-%dT%H:00')

    base_url = getattr(
        settings, 'OPEN_METEO_BASE_URL', 'https://api.open-meteo.com/v1/forecast'
    )

    latitude_param = ','.join(f'{cp.lat:.5f}' for cp in checkpoints)
    longitude_param = ','.join(f'{cp.lng:.5f}' for cp in checkpoints)

    params: dict[str, Any] = {
        'latitude': latitude_param,
        'longitude': longitude_param,
        'hourly': 'temperature_2m,wind_speed_10m,rain,snowfall',
        'temperature_unit': 'fahrenheit',
        'wind_speed_unit': 'mph',
        'precipitation_unit': 'inch',
        'timezone': 'GMT',
        'start_hour': start_hour_str,
        'end_hour': end_hour_str,
    }

    response = request_with_retry('GET', base_url, params=params)

    if response.status_code == 422:
        logger.error('Open-Meteo returned 422 InvalidInput')
        raise UpstreamServiceError('Invalid request parameters sent to Open-Meteo API.')

    if response.status_code != 200:
        raise UpstreamServiceError(
            f'Open-Meteo API failed with status {response.status_code}.'
        )

    forecasts = validate_open_meteo_response(response.json())

    if len(forecasts) != len(checkpoints):
        logger.error(
            'Open-Meteo returned %d locations, expected %d',
            len(forecasts),
            len(checkpoints),
        )
        raise UpstreamServiceError(
            'Incomplete weather response received from weather provider.'
        )

    for cp, forecast in zip(checkpoints, forecasts, strict=True):
        hourly = forecast['hourly']
        time_to_idx = {t: idx for idx, t in enumerate(hourly['time'])}

        # Validate timestamp by value
        eta_hour_str = cp.eta.astimezone(UTC).strftime('%Y-%m-%dT%H:00')
        hour_idx = time_to_idx.get(eta_hour_str)

        if hour_idx is None:
            logger.warning(
                'Missing timestamp %s in Open-Meteo forecast for checkpoint %d; skipping weather.',
                eta_hour_str,
                cp.index,
            )
            continue

        temp_list = hourly.get('temperature_2m')
        temp_raw = (
            temp_list[hour_idx] if temp_list and hour_idx < len(temp_list) else None
        )
        wind_raw = hourly['wind_speed_10m'][hour_idx]
        rain_raw = hourly['rain'][hour_idx]
        snow_raw = hourly['snowfall'][hour_idx]

        # Skip checkpoint gracefully if required values are missing or non-finite
        if (
            temp_raw is None
            or math.isnan(temp_raw)
            or math.isinf(temp_raw)
            or wind_raw is None
            or math.isnan(wind_raw)
            or math.isinf(wind_raw)
            or rain_raw is None
            or math.isnan(rain_raw)
            or math.isinf(rain_raw)
            or snow_raw is None
            or math.isnan(snow_raw)
            or math.isinf(snow_raw)
        ):
            logger.warning(
                'Checkpoint %d has null or non-finite weather (temp=%s, wind=%s, rain=%s, snow=%s); skipping weather.',
                cp.index,
                temp_raw,
                wind_raw,
                rain_raw,
                snow_raw,
            )
            continue

        cp.arrival_weather = calculate_checkpoint_risk(
            wind_mph=float(wind_raw),
            rain_in_hr=float(rain_raw),
            snow_in_hr=float(snow_raw),
            load_weight_lbs=load_weight_lbs,
            temperature_f=float(temp_raw),
        )


def fetch_weather_for_routes(
    routes_checkpoints: list[list[Checkpoint]],
    departure_time: datetime,
    load_weight_lbs: int,
) -> None:
    """Fetch weather for multiple routes concurrently, batching each route's checkpoints into 1 request.

    3 routes -> 3 requests executed with bounded concurrency.
    """
    if not routes_checkpoints:
        return

    workers = min(len(routes_checkpoints), 4)
    with concurrent.futures.ThreadPoolExecutor(max_workers=workers) as executor:
        futures = [
            executor.submit(
                fetch_weather_for_route_checkpoints,
                cps,
                departure_time,
                load_weight_lbs,
            )
            for cps in routes_checkpoints
        ]
        for future in concurrent.futures.as_completed(futures):
            future.result()
