export interface LocationCoordinate {
  name: string;
  lat: number;
  lng: number;
}

export type RiskLevel = "LOW" | "MODERATE" | "HIGH" | "SEVERE" | "NO_TRAVEL";

export type RuleTriggered = "WIND_LOAD" | "WIND" | "RAIN" | "SNOW" | null;

export interface ArrivalWeather {
  temperature_f: number;
  wind_mph: number;
  rain_in_hr: number;
  snow_in_hr: number;
  risk_level: RiskLevel;
  risk_score: number;
  rule_triggered: RuleTriggered;
}

export interface Checkpoint {
  index: number;
  mile_marker: number;
  lat: number;
  lng: number;
  eta_iso: string;
  arrival_hour_offset: number;
  arrival_weather: ArrivalWeather | null;
}

export interface RouteMetrics {
  no_travel_miles: number;
  severe_miles: number;
  high_miles: number;
  moderate_miles: number;
  low_miles: number;
  avg_risk_score: number;
}

export interface RouteItem {
  id: string;
  name: string;
  is_recommended: boolean;
  total_distance_miles: number;
  total_duration_hours: number;
  avg_speed_mph: number;
  metrics: RouteMetrics;
  overview_polyline: string;
  checkpoints: Checkpoint[];
}

export interface CorridorHeatmap {
  intensity_max: number;
  points: [number, number][];
  hourly_intensity: Record<string, number[]>;
}

export interface WarningItem {
  code: string;
  message: string;
}

export interface PlanRouteRequest {
  origin: LocationCoordinate;
  destination: LocationCoordinate;
  departure_time: string;
  load_weight_lbs: number;
}

export interface PlanRouteResponse {
  analysis_id: string;
  created_at: string;
  reused: boolean;
  request_meta: {
    origin: LocationCoordinate;
    destination: LocationCoordinate;
    departure_time: string;
    load_weight_lbs: number;
    sample_interval_miles: number;
    max_forecast_hours: number;
  };
  recommended_route_id: string | null;
  routes: RouteItem[];
  corridor_heatmap: CorridorHeatmap;
  warnings: WarningItem[];
}

export interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
  };
}
