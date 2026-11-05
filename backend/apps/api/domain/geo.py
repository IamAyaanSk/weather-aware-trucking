import bisect
from dataclasses import dataclass, field

import polyline

METERS_TO_MILES = 1609.344


def decode_polyline(geometry: str) -> list[tuple[float, float]]:
    """Decode a precision-5 encoded polyline into a list of (lat, lng) coordinates."""
    if not geometry or not isinstance(geometry, str):
        return []

    try:
        decoded: list[tuple[float, float]] = polyline.decode(geometry)
        return decoded
    except Exception:
        return []


def build_cumulative_distances(
    segment_distances_meters: list[float],
    target_total_distance_miles: float | None = None,
) -> list[float]:
    """Build cumulative distances in miles from Mapbox segment distance annotations.

    Starting at 0.0, each segment distance (meters) is converted to miles and accumulated.
    If target_total_distance_miles is specified, the final point is pinned to it to avoid
    floating-point rounding drift.
    """
    cumulative: list[float] = [0.0]
    accumulated_miles = 0.0

    for seg_m in segment_distances_meters:
        accumulated_miles += float(seg_m) / METERS_TO_MILES
        cumulative.append(accumulated_miles)

    if target_total_distance_miles is not None and len(cumulative) > 1:
        cumulative[-1] = target_total_distance_miles

    return cumulative


@dataclass
class RouteOdometer:
    """Odometer tracking cumulative distances along a route's polyline vertices.

    Directly builds the cumulative distance array from Mapbox distance annotations
    (in meters, converted to miles). Binary search provides O(log N) coordinate
    interpolation along segments with no geodesic calculation or scaling required.
    """

    points: list[tuple[float, float]] = field(default_factory=list)
    cumulative_distances_miles: list[float] = field(default_factory=list)
    total_distance_miles: float = 0.0

    @classmethod
    def from_polyline(
        cls,
        geometry: str,
        segment_distances_meters: list[float] | None = None,
        total_distance_miles: float | None = None,
    ) -> 'RouteOdometer':
        """Build a RouteOdometer from an encoded polyline and Mapbox distance annotations."""
        points = decode_polyline(geometry)

        if not points:
            return cls(
                points=[],
                cumulative_distances_miles=[0.0],
                total_distance_miles=0.0,
            )

        if len(points) == 1:
            total_target = total_distance_miles or 0.0
            return cls(
                points=points,
                cumulative_distances_miles=[total_target],
                total_distance_miles=total_target,
            )

        distances = segment_distances_meters or []
        expected_segments = len(points) - 1
        if len(distances) != expected_segments:
            raise ValueError(
                f'Expected {expected_segments} segment distances for {len(points)} vertices, got {len(distances)}'
            )

        cumulative = build_cumulative_distances(
            distances,
            target_total_distance_miles=total_distance_miles,
        )

        final_total = (
            total_distance_miles if total_distance_miles is not None else cumulative[-1]
        )

        return cls(
            points=points,
            cumulative_distances_miles=cumulative,
            total_distance_miles=final_total,
        )

    def interpolate_coordinate(
        self,
        target_distance_miles: float,
    ) -> tuple[float, float]:
        """Interpolate a (lat, lng) coordinate along the route at target_distance_miles."""
        if not self.points:
            return (0.0, 0.0)

        if len(self.points) == 1 or target_distance_miles <= 0.0:
            p = self.points[0]
            return (round(p[0], 5), round(p[1], 5))

        if target_distance_miles >= self.total_distance_miles:
            p = self.points[-1]
            return (round(p[0], 5), round(p[1], 5))

        # Binary search for segment [idx-1, idx] containing target_distance_miles
        idx = bisect.bisect_right(
            self.cumulative_distances_miles, target_distance_miles
        )

        if idx <= 0:
            p = self.points[0]
            return (round(p[0], 5), round(p[1], 5))

        if idx >= len(self.points):
            p = self.points[-1]
            return (round(p[0], 5), round(p[1], 5))

        p_prev = self.points[idx - 1]
        p_next = self.points[idx]
        d_prev = self.cumulative_distances_miles[idx - 1]
        d_next = self.cumulative_distances_miles[idx]
        seg_len = d_next - d_prev

        if seg_len <= 1e-9:
            t = 0.0
        else:
            t = (target_distance_miles - d_prev) / seg_len
            t = max(0.0, min(1.0, t))

        lat = p_prev[0] + t * (p_next[0] - p_prev[0])
        lng = p_prev[1] + t * (p_next[1] - p_prev[1])

        return (round(lat, 5), round(lng, 5))
