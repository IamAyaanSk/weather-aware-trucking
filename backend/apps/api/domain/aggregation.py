"""Pure Python domain logic for route risk aggregation."""

from apps.api.domain.types import Checkpoint, RouteMetrics


def compute_route_metrics(
    checkpoints: list[Checkpoint],
    total_distance_miles: float,
) -> RouteMetrics:
    """Aggregate risk miles and compute distance-weighted average risk score."""
    no_travel = 0.0
    severe = 0.0
    high = 0.0
    moderate = 0.0
    low = 0.0
    weighted_risk_sum = 0.0

    for cp in checkpoints:
        risk = cp.arrival_weather.risk_score if cp.arrival_weather else 0
        seg = cp.segment_miles

        if risk == 4:
            no_travel += seg
        elif risk == 3:
            severe += seg
        elif risk == 2:
            high += seg
        elif risk == 1:
            moderate += seg
        else:
            low += seg

        weighted_risk_sum += risk * seg

    # Only divide by non-low risk miles to avoid low-risk denominator dilution
    risk_miles = no_travel + severe + high + moderate
    avg_risk = round(weighted_risk_sum / risk_miles, 2) if risk_miles > 0 else 0.0

    return RouteMetrics(
        no_travel_miles=round(no_travel, 1),
        severe_miles=round(severe, 1),
        high_miles=round(high, 1),
        moderate_miles=round(moderate, 1),
        low_miles=round(low, 1),
        avg_risk_score=avg_risk,
    )
