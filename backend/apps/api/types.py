from typing import TypedDict


# Mapbox types
class MapboxLegData(TypedDict, total=False):
    summary: str | None


class MapboxRouteData(TypedDict):
    distance: float
    duration: float | None
    duration_typical: float | None
    geometry: str
    legs: list[MapboxLegData]


class MapboxWaypointData(TypedDict):
    location: list[float]


class MapboxResponseData(TypedDict):
    code: str
    message: str | None
    routes: list[MapboxRouteData]
    waypoints: list[MapboxWaypointData]


class ParsedRoute(TypedDict):
    id: str
    source_index: int
    name: str
    distance_meters: float
    duration_seconds: float
    total_distance_miles: float
    total_duration_hours: float
    avg_speed_mph: float
    geometry: str
    legs: list[MapboxLegData]


class SnappedCoordinate(TypedDict):
    lat: float
    lng: float


class RouteWarning(TypedDict):
    code: str
    message: str


class MapboxRoutesResult(TypedDict):
    routes: list[ParsedRoute]
    snapped_origin: SnappedCoordinate
    snapped_destination: SnappedCoordinate
    warnings: list[RouteWarning]

