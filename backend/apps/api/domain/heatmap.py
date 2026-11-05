"""Pure Python domain logic for constructing the corridor heatmap.
"""

import math
from datetime import UTC, datetime, timedelta
from typing import Any

from apps.api.domain.risk import grade_rain, grade_snow, grade_wind
from apps.api.domain.types import Checkpoint, CorridorHeatmap

DEFAULT_FORECAST_HOURS = 48


def build_corridor_heatmap(
    routes_checkpoints: list[list[Checkpoint]],
    point_forecasts: dict[tuple[float, float], dict[str, Any]],
    departure_time: datetime,
    load_weight_lbs: int,
    forecast_hours: int | None = None,
) -> CorridorHeatmap:
    """Build a corridor heatmap from route checkpoints and Open-Meteo hourly forecasts.
    """
    dep_utc = (
        departure_time.astimezone(UTC)
        if departure_time.tzinfo
        else departure_time.replace(tzinfo=UTC)
    )

    if forecast_hours is None:
        max_offset = 0
        for cps in routes_checkpoints:
            for cp in cps:
                if cp.arrival_hour_offset > max_offset:
                    max_offset = cp.arrival_hour_offset
        forecast_hours = max(DEFAULT_FORECAST_HOURS, max_offset)

    # 1. Deduplicate checkpoint coordinates across all routes rounded to 5 decimals
    seen: set[tuple[float, float]] = set()
    unique_coords: list[tuple[float, float]] = []
    for cps in routes_checkpoints:
        for cp in cps:
            coord = (round(cp.lat, 5), round(cp.lng, 5))
            if coord not in seen:
                seen.add(coord)
                unique_coords.append(coord)

    points: list[list[float]] = [[lat, lng] for lat, lng in unique_coords]

    # Precompute target hour strings for offsets 0..forecast_hours anchored to departure time
    target_hour_strs = [
        (dep_utc + timedelta(hours=h)).strftime('%Y-%m-%dT%H:00')
        for h in range(forecast_hours + 1)
    ]

    # Initialize hourly_intensity with 0.0 for all points across all frames
    hourly_intensity: dict[str, list[float]] = {
        str(h): [0.0] * len(unique_coords) for h in range(forecast_hours + 1)
    }

    # 2. For each unique point, calculate risk score and intensity across all offsets
    for pt_idx, coord in enumerate(unique_coords):
        hourly = point_forecasts.get(coord)
        if not hourly:
            continue

        time_list = hourly.get('time', [])
        time_to_idx = {t: idx for idx, t in enumerate(time_list)}
        wind_list = hourly.get('wind_speed_10m', [])
        rain_list = hourly.get('rain', [])
        snow_list = hourly.get('snowfall', [])

        for h, target_hour_str in enumerate(target_hour_strs):
            hour_idx = time_to_idx.get(target_hour_str)
            if hour_idx is None:
                continue

            wind_raw = wind_list[hour_idx] if hour_idx < len(wind_list) else None
            rain_raw = rain_list[hour_idx] if hour_idx < len(rain_list) else None
            snow_raw = snow_list[hour_idx] if hour_idx < len(snow_list) else None

            if (
                wind_raw is None
                or math.isnan(wind_raw)
                or math.isinf(wind_raw)
                or rain_raw is None
                or math.isnan(rain_raw)
                or math.isinf(rain_raw)
                or snow_raw is None
                or math.isnan(snow_raw)
                or math.isinf(snow_raw)
            ):
                continue

            _, wind_adjusted = grade_wind(float(wind_raw), load_weight_lbs)
            rain_score = grade_rain(float(rain_raw))
            snow_score = grade_snow(float(snow_raw))
            score = max(wind_adjusted, rain_score, snow_score)

            hourly_intensity[str(h)][pt_idx] = score / 4.0

    return CorridorHeatmap(
        intensity_max=1.0,
        points=points,
        hourly_intensity=hourly_intensity,
    )
