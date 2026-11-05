from typing import Any, NotRequired, TypedDict


# Checkpoint types
class CheckpointDict(TypedDict):
    index: int
    mile_marker: float
    lat: float
    lng: float
    segment_miles: float
    eta_iso: str
    arrival_hour_offset: int
    arrival_weather: dict[str, Any] | None


# Mapbox types
class MapboxAnnotationData(TypedDict, total=False):
    distance: list[float]


class MapboxLegData(TypedDict, total=False):
    summary: str | None
    annotation: MapboxAnnotationData | None


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
    distance_annotations: NotRequired[list[float]]
    checkpoints: NotRequired[list[CheckpointDict]]


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


# Open-Meteo types
class OpenMeteoHourlyData(TypedDict):
    time: list[str]
    temperature_2m: NotRequired[list[float | None]]
    wind_speed_10m: list[float | None]
    rain: list[float | None]
    snowfall: list[float | None]


class OpenMeteoLocationForecastData(TypedDict):
    latitude: float
    longitude: float
    hourly: OpenMeteoHourlyData
