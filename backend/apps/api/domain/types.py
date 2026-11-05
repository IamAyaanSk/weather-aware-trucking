from dataclasses import dataclass
from datetime import datetime
from enum import StrEnum
from typing import Any


class RiskLevel(StrEnum):
    LOW = 'LOW'
    MODERATE = 'MODERATE'
    HIGH = 'HIGH'
    SEVERE = 'SEVERE'
    NO_TRAVEL = 'NO_TRAVEL'


class RiskRule(StrEnum):
    WIND_LOAD = 'WIND_LOAD'
    WIND = 'WIND'
    RAIN = 'RAIN'
    SNOW = 'SNOW'


@dataclass(frozen=True)
class Coordinate:
    lat: float
    lng: float

    def to_dict(self) -> dict[str, float]:
        return {'lat': self.lat, 'lng': self.lng}


@dataclass
class CheckpointWeather:
    wind_mph: float
    rain_in_hr: float
    snow_in_hr: float
    risk_level: RiskLevel
    risk_score: int
    temperature_f: float = 0.0
    rule_triggered: RiskRule | None = None

    def to_dict(self) -> dict[str, Any]:
        return {
            'temperature_f': self.temperature_f,
            'wind_mph': self.wind_mph,
            'rain_in_hr': self.rain_in_hr,
            'snow_in_hr': self.snow_in_hr,
            'risk_level': self.risk_level.value,
            'risk_score': self.risk_score,
            'rule_triggered': self.rule_triggered.value
            if self.rule_triggered
            else None,
        }


@dataclass
class Checkpoint:
    index: int
    mile_marker: float
    lat: float
    lng: float
    segment_miles: float
    eta: datetime
    eta_iso: str
    arrival_hour_offset: int
    arrival_weather: CheckpointWeather | None = None

    def to_dict(self) -> dict[str, Any]:
        return {
            'index': self.index,
            'mile_marker': self.mile_marker,
            'lat': self.lat,
            'lng': self.lng,
            'segment_miles': self.segment_miles,
            'eta_iso': self.eta_iso,
            'arrival_hour_offset': self.arrival_hour_offset,
            'arrival_weather': (
                self.arrival_weather.to_dict() if self.arrival_weather else None
            ),
        }


@dataclass
class RouteMetrics:
    no_travel_miles: float
    severe_miles: float
    high_miles: float
    moderate_miles: float
    low_miles: float
    avg_risk_score: float

    def to_dict(self) -> dict[str, float]:
        return {
            'no_travel_miles': self.no_travel_miles,
            'severe_miles': self.severe_miles,
            'high_miles': self.high_miles,
            'moderate_miles': self.moderate_miles,
            'low_miles': self.low_miles,
            'avg_risk_score': self.avg_risk_score,
        }


@dataclass(frozen=True)
class DomainWarning:
    code: str
    message: str

    def to_dict(self) -> dict[str, str]:
        return {'code': self.code, 'message': self.message}


@dataclass
class CorridorHeatmap:
    intensity_max: float
    points: list[list[float]]
    hourly_intensity: dict[str, list[float]]

    def to_dict(self) -> dict[str, Any]:
        return {
            'intensity_max': self.intensity_max,
            'points': self.points,
            'hourly_intensity': self.hourly_intensity,
        }
