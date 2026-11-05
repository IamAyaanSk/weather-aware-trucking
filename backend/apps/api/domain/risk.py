"""Pure Python domain logic for weather risk scoring and grading.
"""

from apps.api.domain.types import CheckpointWeather, RiskLevel, RiskRule

SCORE_TO_RISK_LEVEL = {
    0: RiskLevel.LOW,
    1: RiskLevel.MODERATE,
    2: RiskLevel.HIGH,
    3: RiskLevel.SEVERE,
    4: RiskLevel.NO_TRAVEL,
}


def grade_wind(wind_mph: float, load_weight_lbs: int) -> tuple[int, int]:
    """Calculate base and load-adjusted wind risk scores (0..4)."""
    if wind_mph < 25.0:
        wind_base = 0
    elif wind_mph < 35.0:
        wind_base = 1
    elif wind_mph < 45.0:
        wind_base = 2
    elif wind_mph < 55.0:
        wind_base = 3
    else:
        wind_base = 4

    if wind_mph >= 55.0:
        wind_adjusted = 4
    elif 45.0 <= wind_mph < 55.0 and load_weight_lbs > 30_000:
        wind_adjusted = 4
    elif 35.0 <= wind_mph < 45.0 and load_weight_lbs > 40_000:
        wind_adjusted = max(wind_base, 3)
    else:
        wind_adjusted = wind_base

    return wind_base, wind_adjusted


def grade_rain(rain_in_hr: float) -> int:
    """Calculate rain risk score (0..4)."""
    if rain_in_hr < 0.10:
        return 0
    if rain_in_hr < 0.25:
        return 1
    if rain_in_hr < 0.50:
        return 2
    if rain_in_hr <= 1.00:
        return 3
    return 4


def grade_snow(snow_in_hr: float) -> int:
    """Calculate snow risk score (0..4)."""
    if snow_in_hr < 0.5:
        return 0
    if snow_in_hr < 1.0:
        return 1
    if snow_in_hr < 2.0:
        return 2
    if snow_in_hr <= 3.0:
        return 3
    return 4


def calculate_checkpoint_risk(
    wind_mph: float,
    rain_in_hr: float,
    snow_in_hr: float,
    load_weight_lbs: int,
    temperature_f: float = 0.0,
) -> CheckpointWeather:
    """Grade checkpoint weather and determine the composite risk score and rule triggered.

    Ties resolve in strict precedence: WIND_LOAD, WIND, RAIN, SNOW.
    rule_triggered is null for Low (score 0).
    """
    wind_base, wind_adjusted = grade_wind(wind_mph, load_weight_lbs)
    rain_score = grade_rain(rain_in_hr)
    snow_score = grade_snow(snow_in_hr)

    risk_score = max(wind_adjusted, rain_score, snow_score)
    risk_level = SCORE_TO_RISK_LEVEL[risk_score]

    if risk_score == 0:
        rule_triggered: RiskRule | None = None
    elif wind_adjusted == risk_score and wind_adjusted > wind_base:
        rule_triggered = RiskRule.WIND_LOAD
    elif wind_base == risk_score:
        rule_triggered = RiskRule.WIND
    elif rain_score == risk_score:
        rule_triggered = RiskRule.RAIN
    elif snow_score == risk_score:
        rule_triggered = RiskRule.SNOW
    else:
        rule_triggered = RiskRule.WIND

    return CheckpointWeather(
        temperature_f=round(temperature_f, 1),
        wind_mph=round(wind_mph, 1),
        rain_in_hr=round(rain_in_hr, 2),
        snow_in_hr=round(snow_in_hr, 2),
        risk_level=risk_level,
        risk_score=risk_score,
        rule_triggered=rule_triggered,
    )
