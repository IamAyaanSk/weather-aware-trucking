import math
from datetime import datetime, timedelta, timezone

from apps.api.domain.geo import RouteOdometer
from apps.api.domain.types import Checkpoint

FLOATING_POINT_TOLERANCE = 1e-5

def determine_sample_interval_miles(total_distance_miles: float) -> float:
    """Determine the sampling interval in miles automatically based on route distance.

    """
    total = round(total_distance_miles, 2)
    if total <= 20.0:
        return round(total / 2.0, 2) if total > 0 else 0.0
    if total <= 100.0:
        return 10.0
    if total <= 200.0:
        return 25.0
    return 50.0


def calculate_target_distances(
    total_distance_miles: float,
    sample_interval_miles: int | float | None = None,
) -> list[float]:
    """Calculate sampling distances along the route at 0, interval, 2*interval, ..., destination.
    """
    total = round(total_distance_miles, 2)
    if total <= 0:
        raise ValueError('Total route distance cannot be 0.')

    if sample_interval_miles is None:
        if total <= 20.0:
            mid = round(total / 2.0, 2)                    
            return [0.0, mid, total]

        interval = determine_sample_interval_miles(total)
    else:
        if sample_interval_miles <= 0:
            raise ValueError('Sample interval must be positive.')
        interval = float(sample_interval_miles)

    target_distances: list[float] = []
    curr = 0.0

    while curr < total - FLOATING_POINT_TOLERANCE:
        target_distances.append(round(curr, 2))
        curr += interval

    if abs(target_distances[-1] - total) > FLOATING_POINT_TOLERANCE:
        target_distances.append(total)
    else:
        target_distances[-1] = total

    return target_distances


def _extract_coordinate(
    coord: tuple[float, float] | dict[str, float] | None,
) -> tuple[float, float] | None:
    """Normalize coordinate input to (lat, lng) tuple."""
    
    if coord is None:
        return None
    if isinstance(coord, dict):
        return (float(coord['lat']), float(coord['lng']))
    if isinstance(coord, (list, tuple)) and len(coord) >= 2:
        return (float(coord[0]), float(coord[1]))
    return None


def generate_checkpoints(
    odometer: RouteOdometer,
    total_distance_miles: float,
    avg_speed_mph: float,
    departure_time: datetime,
    sample_interval_miles: int | float | None = None,
    snapped_origin: tuple[float, float] | dict[str, float] | None = None,
    snapped_destination: tuple[float, float] | dict[str, float] | None = None,
) -> list[Checkpoint]:
    """Generate route checkpoints per AGENTS.md §6.4.

    Computes:
    - Target distance mile markers (automatically determined if sample_interval_miles is None)
    - Segment miles: segment_miles[0] = 0; for k > 0, segment_miles[k] = D_k - D_{k-1}
      (summing strictly to total route distance)
    - Snapped origin/destination coordinates at endpoints
    - Interpolated coordinates for intermediate checkpoints
    - Travel hours and ETA in UTC
    - Half-up arrival hour offset: floor(travel_hours + 0.5)
    """
    target_distances = calculate_target_distances(
        total_distance_miles, sample_interval_miles
    )

    dep_utc = (
        departure_time.astimezone(timezone.utc)
        if departure_time.tzinfo
        else departure_time.replace(tzinfo=timezone.utc)
    )

    origin_coord = _extract_coordinate(snapped_origin)
    dest_coord = _extract_coordinate(snapped_destination)

    checkpoints: list[Checkpoint] = []
    total_points = len(target_distances)

    for idx, d in enumerate(target_distances):
        # Segment miles calculation: segment_miles[0] = 0, segment_miles[k] = D_k - D_{k-1}
        if idx == 0:
            segment_miles = 0.0
        else:
            segment_miles = round(d - target_distances[idx - 1], 2)

        # Coordinate selection: snapped endpoints for first and last, interpolated for middle
        if idx == 0 and origin_coord is not None:
            lat = round(origin_coord[0], 5)
            lng = round(origin_coord[1], 5)
        elif idx == total_points - 1 and dest_coord is not None:
            lat = round(dest_coord[0], 5)
            lng = round(dest_coord[1], 5)
        else:
            lat, lng = odometer.interpolate_coordinate(d)

        # ETA and travel time calculation
        travel_hours = (d / avg_speed_mph) if avg_speed_mph > 0 else 0.0
        eta = dep_utc + timedelta(hours=travel_hours)
        eta_iso = eta.strftime('%Y-%m-%dT%H:%M:%SZ')

        # Half-up arrival hour offset per §6.4: floor(travel_hours + 0.5)
        arrival_hour_offset = math.floor(travel_hours + 0.5)

        checkpoints.append(
            Checkpoint(
                index=idx,
                mile_marker=d,
                lat=lat,
                lng=lng,
                segment_miles=segment_miles,
                eta=eta,
                eta_iso=eta_iso,
                arrival_hour_offset=arrival_hour_offset,
            )
        )

    return checkpoints


def generate_checkpoints_for_route(
    geometry: str,
    total_distance_miles: float,
    avg_speed_mph: float,
    departure_time: datetime,
    segment_distances_meters: list[float] | None = None,
    sample_interval_miles: int | float | None = None,
    snapped_origin: tuple[float, float] | dict[str, float] | None = None,
    snapped_destination: tuple[float, float] | dict[str, float] | None = None,
) -> list[Checkpoint]:
    """Convenience function to build RouteOdometer from annotations and generate checkpoints for a route."""
    odometer = RouteOdometer.from_polyline(
        geometry=geometry,
        segment_distances_meters=segment_distances_meters or [],
        total_distance_miles=total_distance_miles,
    )
    return generate_checkpoints(
        odometer=odometer,
        total_distance_miles=total_distance_miles,
        avg_speed_mph=avg_speed_mph,
        departure_time=departure_time,
        sample_interval_miles=sample_interval_miles,
        snapped_origin=snapped_origin,
        snapped_destination=snapped_destination,
    )
