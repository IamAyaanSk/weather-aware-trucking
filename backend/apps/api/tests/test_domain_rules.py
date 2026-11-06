"""Unit tests for core route and checkpoint eval logic."""

from django.test import TestCase

from apps.api.domain.aggregation import compute_route_metrics
from apps.api.domain.ranking import rank_routes
from apps.api.domain.risk import (
    calculate_checkpoint_risk,
    grade_rain,
    grade_snow,
    grade_wind,
)
from apps.api.domain.types import RiskLevel, RiskRule


class WeatherThresholdTests(TestCase):
    def test_wind_thresholds(self):
        # Low: < 25 mph
        self.assertEqual(grade_wind(0.0, 0)[0], 0)
        self.assertEqual(grade_wind(24.9, 0)[0], 0)

        # Moderate: 25–34 mph
        self.assertEqual(grade_wind(25.0, 0)[0], 1)
        self.assertEqual(grade_wind(34.9, 0)[0], 1)

        # High: 35–44 mph
        self.assertEqual(grade_wind(35.0, 0)[0], 2)
        self.assertEqual(grade_wind(44.9, 0)[0], 2)

        # Severe: 45–54 mph
        self.assertEqual(grade_wind(45.0, 0)[0], 3)
        self.assertEqual(grade_wind(54.9, 0)[0], 3)

        # No Travel: >= 55 mph
        self.assertEqual(grade_wind(55.0, 0)[0], 4)
        self.assertEqual(grade_wind(75.0, 0)[0], 4)

    def test_rain_thresholds(self):
        # Low: < 0.10 in/hr
        self.assertEqual(grade_rain(0.0), 0)
        self.assertEqual(grade_rain(0.09), 0)

        # Moderate: 0.10–0.25 in/hr
        self.assertEqual(grade_rain(0.10), 1)
        self.assertEqual(grade_rain(0.24), 1)

        # High: 0.25–0.50 in/hr
        self.assertEqual(grade_rain(0.25), 2)
        self.assertEqual(grade_rain(0.49), 2)

        # Severe: 0.50–1.00 in/hr
        self.assertEqual(grade_rain(0.50), 3)
        self.assertEqual(grade_rain(1.00), 3)

        # No Travel: > 1.00 in/hr
        self.assertEqual(grade_rain(1.01), 4)
        self.assertEqual(grade_rain(2.50), 4)

    def test_snow_thresholds(self):
        # Low: < 0.5 in/hr
        self.assertEqual(grade_snow(0.0), 0)
        self.assertEqual(grade_snow(0.49), 0)

        # Moderate: 0.5–1.0 in/hr
        self.assertEqual(grade_snow(0.5), 1)
        self.assertEqual(grade_snow(0.99), 1)

        # High: 1.0–2.0 in/hr
        self.assertEqual(grade_snow(1.0), 2)
        self.assertEqual(grade_snow(1.99), 2)

        # Severe: 2.0–3.0 in/hr
        self.assertEqual(grade_snow(2.0), 3)
        self.assertEqual(grade_snow(3.0), 3)

        # No Travel: > 3.0 in/hr
        self.assertEqual(grade_snow(3.01), 4)
        self.assertEqual(grade_snow(5.0), 4)

    def test_load_rules_for_wind(self):
        # Rule 1: >= 55 mph -> No Travel for any load
        _, adjusted_empty = grade_wind(55.0, load_weight_lbs=0)
        _, adjusted_heavy = grade_wind(55.0, load_weight_lbs=45_000)
        self.assertEqual(adjusted_empty, 4)
        self.assertEqual(adjusted_heavy, 4)

        # Rule 2: 45–54 mph + > 30,000 lb -> No Travel
        # At exactly 30,000 lb, does NOT trigger (strict inequality > 30,000)
        _, adjusted_boundary = grade_wind(50.0, load_weight_lbs=30_000)
        self.assertEqual(adjusted_boundary, 3)

        # At 30,001 lb, triggers No Travel (4)
        _, adjusted_triggered = grade_wind(50.0, load_weight_lbs=30_001)
        self.assertEqual(adjusted_triggered, 4)

        # Rule 3: 35–44 mph + > 40,000 lb -> Severe (3)
        # At exactly 40,000 lb, stays High (2)
        _, adjusted_boundary_35 = grade_wind(40.0, load_weight_lbs=40_000)
        self.assertEqual(adjusted_boundary_35, 2)

        # At 40,001 lb, elevates to Severe (3)
        _, adjusted_triggered_35 = grade_wind(40.0, load_weight_lbs=40_001)
        self.assertEqual(adjusted_triggered_35, 3)

    def test_rule_triggered_precedence(self):
        # Load rule override sets rule_triggered to WIND_LOAD
        weather = calculate_checkpoint_risk(
            wind_mph=50.0,
            rain_in_hr=0.0,
            snow_in_hr=0.0,
            load_weight_lbs=35_000,
        )
        self.assertEqual(weather.risk_level, RiskLevel.NO_TRAVEL)
        self.assertEqual(weather.rule_triggered, RiskRule.WIND_LOAD)


class RouteRecommendationTests(TestCase):
    def test_prefer_fewest_severe_miles(self):
        r1 = {
            'id': 'route_1',
            'total_duration_hours': 10.0,
            'total_distance_miles': 500.0,
            'metrics': {
                'no_travel_miles': 0.0,
                'severe_miles': 20.0,
                'high_miles': 50.0,
                'avg_risk_score': 1.2,
            },
        }
        r2 = {
            'id': 'route_2',
            'total_duration_hours': 12.0,
            'total_distance_miles': 520.0,
            'metrics': {
                'no_travel_miles': 0.0,
                'severe_miles': 0.0,  # Fewest severe miles
                'high_miles': 80.0,
                'avg_risk_score': 1.4,
            },
        }
        ranked, rec_id, _ = rank_routes([r1, r2])
        self.assertEqual(rec_id, 'route_2')
        self.assertEqual(ranked[0]['id'], 'route_2')

    def test_prefer_fewest_high_miles_when_severe_tied(self):
        r1 = {
            'id': 'route_1',
            'total_duration_hours': 10.0,
            'total_distance_miles': 500.0,
            'metrics': {
                'no_travel_miles': 0.0,
                'severe_miles': 10.0,
                'high_miles': 30.0,  # Fewest high miles
                'avg_risk_score': 1.5,
            },
        }
        r2 = {
            'id': 'route_2',
            'total_duration_hours': 8.0,
            'total_distance_miles': 480.0,
            'metrics': {
                'no_travel_miles': 0.0,
                'severe_miles': 10.0,
                'high_miles': 60.0,
                'avg_risk_score': 1.3,
            },
        }
        ranked, rec_id, _ = rank_routes([r1, r2])
        self.assertEqual(rec_id, 'route_1')

    def test_prefer_lowest_avg_risk_when_severe_and_high_tied(self):
        r1 = {
            'id': 'route_1',
            'total_duration_hours': 10.0,
            'total_distance_miles': 500.0,
            'metrics': {
                'no_travel_miles': 0.0,
                'severe_miles': 10.0,
                'high_miles': 30.0,
                'avg_risk_score': 0.95,  # Lower avg risk
            },
        }
        r2 = {
            'id': 'route_2',
            'total_duration_hours': 9.0,
            'total_distance_miles': 490.0,
            'metrics': {
                'no_travel_miles': 0.0,
                'severe_miles': 10.0,
                'high_miles': 30.0,
                'avg_risk_score': 1.15,
            },
        }
        ranked, rec_id, _ = rank_routes([r1, r2])
        self.assertEqual(rec_id, 'route_1')

    def test_prefer_lower_travel_time_when_avg_risk_tied(self):
        r1 = {
            'id': 'route_1',
            'total_duration_hours': 11.5,
            'total_distance_miles': 600.0,
            'metrics': {
                'no_travel_miles': 0.0,
                'severe_miles': 0.0,
                'high_miles': 20.0,
                'avg_risk_score': 0.8,
            },
        }
        r2 = {
            'id': 'route_2',
            'total_duration_hours': 9.2,  # Lower travel time
            'total_distance_miles': 580.0,
            'metrics': {
                'no_travel_miles': 0.0,
                'severe_miles': 0.0,
                'high_miles': 20.0,
                'avg_risk_score': 0.8,
            },
        }
        ranked, rec_id, _ = rank_routes([r1, r2])
        self.assertEqual(rec_id, 'route_2')

    def test_no_travel_route_never_recommended(self):
        r1 = {
            'id': 'route_1',
            'total_duration_hours': 5.0,
            'total_distance_miles': 300.0,
            'metrics': {
                'no_travel_miles': 15.0,  # Has No Travel miles
                'severe_miles': 0.0,
                'high_miles': 0.0,
                'avg_risk_score': 0.5,
            },
        }
        r2 = {
            'id': 'route_2',
            'total_duration_hours': 8.0,
            'total_distance_miles': 400.0,
            'metrics': {
                'no_travel_miles': 0.0,  # Safe route
                'severe_miles': 10.0,
                'high_miles': 25.0,
                'avg_risk_score': 1.1,
            },
        }
        ranked, rec_id, no_safe_route = rank_routes([r1, r2])
        self.assertFalse(no_safe_route)
        self.assertEqual(rec_id, 'route_2')
        self.assertTrue(ranked[0]['is_recommended'])
        self.assertFalse(ranked[1]['is_recommended'])

    def test_average_risk_excludes_low_miles(self): # Since low miles consetitute 0 risk so exclude it
        from datetime import datetime, timezone

        from apps.api.domain.types import Checkpoint, CheckpointWeather

        now = datetime.now(timezone.utc)
        # Route 1: 1060 mi low, 150 mi moderate (score 1), 50 mi high (score 2)
        cp_low = Checkpoint(
            index=0,
            mile_marker=0.0,
            lat=0.0,
            lng=0.0,
            segment_miles=1060.0,
            eta=now,
            eta_iso=now.isoformat(),
            arrival_hour_offset=0,
            arrival_weather=CheckpointWeather(
                temperature_f=60.0,
                wind_mph=10.0,
                rain_in_hr=0.0,
                snow_in_hr=0.0,
                risk_level=RiskLevel.LOW,
                risk_score=0,
                rule_triggered=None,
            ),
        )
        cp_mod = Checkpoint(
            index=1,
            mile_marker=1060.0,
            lat=0.0,
            lng=0.0,
            segment_miles=150.0,
            eta=now,
            eta_iso=now.isoformat(),
            arrival_hour_offset=1,
            arrival_weather=CheckpointWeather(
                temperature_f=60.0,
                wind_mph=30.0,
                rain_in_hr=0.0,
                snow_in_hr=0.0,
                risk_level=RiskLevel.MODERATE,
                risk_score=1,
                rule_triggered=None,
            ),
        )
        cp_high = Checkpoint(
            index=2,
            mile_marker=1210.0,
            lat=0.0,
            lng=0.0,
            segment_miles=50.0,
            eta=now,
            eta_iso=now.isoformat(),
            arrival_hour_offset=2,
            arrival_weather=CheckpointWeather(
                temperature_f=60.0,
                wind_mph=40.0,
                rain_in_hr=0.0,
                snow_in_hr=0.0,
                risk_level=RiskLevel.HIGH,
                risk_score=2,
                rule_triggered=None,
            ),
        )

        m1 = compute_route_metrics(
            [cp_low, cp_mod, cp_high], total_distance_miles=1260.0
        )
        # 150*1 + 50*2 = 250 points over 200 non-low miles = 1.25 (not diluted by 1060 low miles)
        self.assertEqual(m1.avg_risk_score, 1.25)
