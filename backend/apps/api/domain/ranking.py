"""Pure Python domain logic for route ranking and recommendation."""

from collections.abc import Sequence
from typing import Any


def rank_routes(
    routes: Sequence[Any],
) -> tuple[list[Any], str | None, bool]:
    """Sort routes ascending by ranking tuple and determine the recommended route."""

    def _sort_key(r: Any) -> tuple[float, float, float, float, float, float, int]:
        metrics = r['metrics']
        return (
            float(metrics['no_travel_miles']),
            float(metrics['severe_miles']),
            float(metrics['high_miles']),
            float(metrics['avg_risk_score']),
            float(r['total_duration_hours']),
            float(r.get('total_distance_miles', 0.0)),
            int(r.get('source_index', 0)),
        )

    ranked: list[Any] = sorted(routes, key=_sort_key)

    recommended_route_id: str | None = None
    for r in ranked:
        if r['metrics']['no_travel_miles'] == 0.0 and recommended_route_id is None:
            recommended_route_id = r['id']
            r['is_recommended'] = True
        else:
            r['is_recommended'] = False

    no_safe_route = len(ranked) > 0 and recommended_route_id is None
    return ranked, recommended_route_id, no_safe_route
