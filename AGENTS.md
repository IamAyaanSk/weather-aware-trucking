# AGENTS.md — Weather-Aware Truck Routing

> Root context for AI agents and contributors. Read §2 before assuming anything is implemented.
> **Last verified:** 2026-11-04
> **Assignment:** Full Stack Developer — Weather-Aware Truck Routing
> **Repo:** `https://github.com/IamAyaanSk/weather-aware-trucking`

## Agent quick start

1. §5 (API) and §6 (risk/route math) are normative.
2. Never call Mapbox or Open-Meteo from unit tests. Use fixtures/mocks.
3. Run backend `ruff`/tests and frontend `oxlint`/`oxfmt`/`typecheck` before committing.
4. Update this file when contracts, architecture, or domain rules change.
5. Keep the implementation simple and non-repetitive. Prefer one clear code path over abstractions for hypothetical needs.

---

## 1. Product

The user enters origin, destination, departure time, and load weight (lbs). The sampling interval is automatically adjusted based on route distance (<=20 mi -> dist/2, 20-100 mi -> 10 mi, 100-200 mi -> 25 mi, >200 mi -> 50 mi). The app:

1. Resolves origin and destination coordinates via a 2-step search in UI (user searches and presses Enter -> gets recommendations -> selects to retrieve coordinates), then sends coordinates to backend to get up to 3 truck routes from the Mapbox Directions API.
2. Samples each route every _N_ miles.
3. Gets hourly weather for every checkpoint from Open-Meteo.
4. Scores each checkpoint with the given wind/rain/snow/load rules.
5. Aggregates route risk, recommends a safe route, and displays all routes.
6. Shows a 0–48+ hour corridor heatmap, forecast slider, and moving truck marker.
7. Reuses an analysis for the same request made within the last hour.

### Deliverables

- GitHub repository
- Hosted application
- 5–10 minute Loom walkthrough

### Evaluation

| Area                                    | Weight |
| --------------------------------------- | -----: |
| Routes, weather, risk, recommendation   |    40% |
| UI, map, heatmap smoothness/performance |    40% |
| Code quality                            |    15% |
| Documentation and walkthrough           |     5% |

Correctness and clarity over extra features.

---

## 2. Current repository state (verified)

### Repo

- Monorepo: `backend/` and `frontend/`.
- Git remote: `origin` → GitHub.
- Branch: `master`; base commit `95661bc chores: initital project setup`.
- No root `README.md`, CI, Docker, or deployment config yet.
- `backend/README.md` and `backend/.env.example` exist (M0).

### Backend

- Django **6.1.3**, DRF **3.18.3**, `django-cors-headers`, `python-dotenv`, `httpx`, `polyline` installed.
- Python **3.15**, uv, Ruff, SQLite. Automated tests and deployment are pending for future passes.
- Scaffold complete: `apps/__init__.py` exists, `ApiConfig.name = "apps.api"`, DRF + CORS + `apps.api` are registered, settings are env-driven, and `/api/v1/health/` is served.
- `config/urls.py` mounts `apps.api.urls` at `/api/v1/`; `/admin/` keeps CSRF.
- The public views use `authentication_classes = []` and `AllowAny`; anonymous throttling defaults to `120/min`; CORS allows the `x-client-id` header.
- Complete domain layer implemented: `types.py`, `geo.py`, `risk.py`, `checkpoints.py`, `aggregation.py`, `ranking.py`, `heatmap.py`.
- Complete services layer implemented: `mapbox.py` (Directions API with truck parameters), `open_meteo.py` (batch weather requests), `http.py` (retries/backoff), `analysis_cache.py` (1-hour cache hit/miss).
- Endpoints: `GET /api/v1/health/` and `POST /api/v1/routes/plan/` (all data delivered via plan endpoint, returning cached analyses on cache hits).

### Frontend

- Vite **8.3.5**, React **19.3.1**, TypeScript **~7.0.2**, React Compiler.
- pnpm **11.18.0**; oxlint/oxfmt.
- `src/App.tsx` is a placeholder (`<h1>Hello</h1>`).
- Leaflet and UI integration pending (M5–M7).

---

## 3. Architecture

```text
React + Vite + Leaflet
  │  1. Search location (press Enter) -> get recommendations (Mapbox Search Box API via public token)
  │  2. Select recommendation -> retrieve coords (Mapbox Search Box API via public token)
  │  3. POST /api/v1/routes/plan/ (with origin & destination coordinates)
  ▼
Django + DRF
  ├── thin view + serializer (validates coordinates, weight, departure)
  ├── services/: Mapbox Directions, Open-Meteo, Analysis Cache
  ├── domain/: geo, risk, checkpoint, aggregation, ranking, heatmap
  └── SQLite/Postgres: RouteAnalysis 1h cache reuse
         │
         ├──► Mapbox Directions API (driving-traffic + vehicle limits using coordinates)
         └──► Open-Meteo API
```

### Rules

- The calculation is request-scoped; persistence in `RouteAnalysis` is used for 1-hour cache reuse.
- All routing and weather analyses are delivered via `POST /api/v1/routes/plan/`. Cache hits within 1 hour return stored analyses immediately with `reused: true`.
- Location search is handled directly in frontend using a public Mapbox token (`VITE_MAPBOX_PUBLIC_TOKEN`), resolving coordinates before calling the backend.
- Coordinates are passed directly to `POST /api/v1/routes/plan/`. Backend does not run geocoding inside the routing pipeline; it sends coordinates straight to Mapbox Directions.
- Secret keys stay server-side: the backend `MAPBOX_ACCESS_TOKEN` is used exclusively for Directions and is never exposed to Vite.
- Views validate and delegate. No risk math or upstream calls in `views.py`.
- `domain/` is pure Python: no Django, DRF, `httpx`, or settings imports.
- Fail closed if required weather is missing. Never assume calm weather.
- Mapbox has no dedicated truck profile. Truck limits ride on the `driving-traffic` profile via
  `max_height`/`max_width`/`max_weight`; that is a documented v1 approximation, not true truck
  routing. Surface it with a `truck_restrictions_unsupported` warning rather than pretending.

---

## 4. Target layout

```text
backend/
├── apps/
│   ├── __init__.py
│   └── api/
│       ├── apps.py                  # name = "apps.api"
│       ├── urls.py
│       ├── views.py                 # plan + health endpoints
│       ├── serializers.py
│       ├── models.py                # RouteAnalysis
│       ├── exceptions.py
│       ├── domain/
│       │   ├── types.py
│       │   ├── geo.py               # polyline decoding + annotation odometer + interpolation
│       │   ├── risk.py
│       │   ├── checkpoints.py
│       │   ├── aggregation.py
│       │   ├── ranking.py
│       │   └── heatmap.py
│       ├── services/
│       │   ├── mapbox.py            # Directions API
│       │   ├── open_meteo.py        # batch weather API
│       │   ├── analysis_cache.py    # 1h hash cache
│       │   └── http.py
│       ├── migrations/
│       └── tests/
├── config/
├── manage.py
├── pyproject.toml
└── uv.lock

frontend/src/
├── api/
│   ├── client.ts
│   └── types.ts
├── components/
│   ├── RouteForm.tsx
│   ├── RouteMap.tsx
│   ├── HeatmapLayer.tsx
│   ├── ForecastSlider.tsx
│   ├── RouteSummary.tsx
│   ├── CheckpointPanel.tsx
│   ├── CheckpointCard.tsx
│   ├── TruckMarker.tsx
│   ├── HistoryPanel.tsx
│   └── RiskLegend.tsx
├── hooks/
│   ├── useRoutePlan.ts
│   └── useForecastFrame.ts
├── lib/
│   ├── polyline.ts                  # @mapbox/polyline wrapper
│   ├── risk.ts
│   └── format.ts
├── types/leaflet-heat.d.ts
├── App.tsx
└── main.tsx
```

---

## 5. API contract (v1)

### Endpoints

| Method | Path                   | Purpose                     |
| ------ | ---------------------- | --------------------------- |
| `GET`  | `/api/v1/routes/plan/` | Create or reuse an analysis |
| `GET`  | `/api/v1/health/`      | Hosting health check        |

No authentication. Cache reuse is scoped by an anonymous `X-Client-Id` header (UUID generated in `localStorage`). If the header is absent, use `"anonymous"`. Add DRF anonymous throttling. `X-Client-Id` only scopes 1-hour cache reuse; it is **not** authentication or a security boundary. Set `authentication_classes = []` and `permission_classes = [AllowAny]` on these public views.

### Request (GET Query Parameters)

```text
GET /api/v1/routes/plan/?origin_lat=41.8781&origin_lng=-87.6298&origin_name=Chicago,%20IL&dest_lat=39.7392&dest_lng=-104.9903&dest_name=Denver,%20CO&departure_time=2026-11-04T14:00:00Z&load_weight_lbs=35000
```

- `origin_lat`, `origin_lng`: float, -90..90 and -180..180 (required).
- `origin_name`: optional string for display (defaults to `f"{origin_lat},{origin_lng}"`).
- `dest_lat`, `dest_lng`: float, -90..90 and -180..180 (required).
- `dest_name`: optional string for display (defaults to `f"{dest_lat},{dest_lng}"`).
- `departure_time`: ISO 8601 with offset (required). Normalize to UTC internally.
- `load_weight_lbs`: integer, `>= 0` (optional, default 0).
- `sampling_interval`: automatically determined by backend based on route distance (`<=20` mi -> dist/2, `20–100` mi -> 10 mi, `100–200` mi -> 25 mi, `>200` mi -> 50 mi); not passed by user.
- Reject origin == destination (within 0.001°), naive datetimes, past departures, and departures beyond Open-Meteo's 16-day forecast range.

### Response

```json
{
  "analysis_id": "b0f5c9d4-...",
  "created_at": "2026-11-04T13:42:11Z",
  "reused": false,
  "request_meta": {
    "origin": {
      "name": "Chicago, IL",
      "lat": 41.8781,
      "lng": -87.6298
    },
    "destination": {
      "name": "Denver, CO",
      "lat": 39.7392,
      "lng": -104.9903
    },
    "departure_time": "2026-11-04T14:00:00Z",
    "load_weight_lbs": 35000,
    "sample_interval_miles": 25,
    "max_forecast_hours": 48
  },
  "recommended_route_id": "route_1",
  "routes": [
    {
      "id": "route_1",
      "name": "I-80 W, I-76 E",
      "is_recommended": true,
      "total_distance_miles": 1004.2,
      "total_duration_hours": 15.6,
      "avg_speed_mph": 64.4,
      "metrics": {
        "no_travel_miles": 0.0,
        "severe_miles": 25.0,
        "high_miles": 75.0,
        "moderate_miles": 150.0,
        "low_miles": 754.2,
        "avg_risk_score": 0.58
      },
      "overview_polyline": "u{~vFvyys@fG...",
      "checkpoints": [
        {
          "index": 0,
          "mile_marker": 0.0,
          "lat": 41.8781,
          "lng": -87.6298,
          "eta_iso": "2026-11-04T14:00:00Z",
          "arrival_hour_offset": 0,
          "arrival_weather": {
            "temperature_f": 45.2,
            "wind_mph": 18.2,
            "rain_in_hr": 0.02,
            "snow_in_hr": 0.0,
            "risk_level": "LOW",
            "risk_score": 0,
            "rule_triggered": null
          }
        }
      ]
    }
  ],
  "corridor_heatmap": {
    "intensity_max": 1.0,
    "points": [[41.8781, -87.6298]],
    "hourly_intensity": {
      "0": [0.0],
      "1": [0.25],
      "48": [0.5]
    }
  },
  "warnings": []
}
```

Contract notes:

- `analysis_id`, `created_at`, `reused`, and `warnings` support cache reuse, inspection, and UI feedback.
- `recommended_route_id` is **null** when every route has any No Travel miles. All `is_recommended` are then false, but every route is still returned and displayed.
- `routes` is ordered best-first by the ranking in §6.7.
- `risk_level` is uppercase: `LOW`, `MODERATE`, `HIGH`, `SEVERE`, `NO_TRAVEL`.
- `rule_triggered` is `null` for Low, otherwise one of `WIND`, `RAIN`, `SNOW`, `WIND_LOAD`. Ties resolve in order: `WIND_LOAD`, `WIND`, `RAIN`, `SNOW`.
- `arrival_weather` includes `temperature_f`. If weather data for a checkpoint is unavailable or corrupted, it is gracefully skipped (`arrival_weather: null`).
- `metrics.avg_risk_score` is the distance-weighted average risk in `0..4`.
- `arrival_hour_offset` is a non-negative integer. It may exceed 48 for long trips.
- `corridor_heatmap.hourly_intensity` has string keys `"0"` through `str(forecast_hours)` where `forecast_hours = max(48, longest arrival_hour_offset)`; each array aligns by index with `points`.
- `overview_polyline` is Mapbox's encoded polyline from `routes[].geometry`, requested with
  `geometries=polyline` (precision 5, same encoding Google used). Frontend decodes with
  `@mapbox/polyline`; backend decodes with Python `polyline`.
- `routes[].name` is derived from the route's leg summary (`legs[0].summary`, e.g.
  `"I-80 W, I-76 E"`); Mapbox returns no route description. Fall back to `"Route {n}"`.
- `warnings` entries use `{ "code": "...", "message": "..." }`, e.g. `fewer_than_three_routes`,
  `no_safe_route`, `truck_restrictions_unsupported`, `departure_time_approximated`,
  `forecast_extended_for_checkpoints`.

### Errors

```json
{
  "error": {
    "code": "weather_unavailable",
    "message": "Weather data could not be retrieved."
  }
}
```

| Condition                                              | Status |
| ------------------------------------------------------ | -----: |
| Validation error                                       |    400 |
| Analysis not found                                     |    404 |
| Geocode failed / no route / trip beyond forecast range |    422 |
| Upstream rate limit                                    |    429 |
| Upstream error / malformed response                    |    502 |
| Upstream timeout                                       |    504 |
| Unexpected error                                       |    500 |

Never expose API keys, raw upstream bodies, or stack traces.

---

## 6. Domain rules (normative)

### 6.1 Units and constants

- Miles, mph, inches/hour, pounds, WGS84 coordinates.
- `FORECAST_HOURS = 48`; heatmap offsets `0..48` inclusive (49 samples).
- `MAX_ROUTES = 3`; intervals `(10, 25, 50)`. Mapbox can return at most 1 primary + 2 alternatives,
  so 3 is the ceiling, not a guarantee.
- Use Mapbox `annotations=distance` directly for segment distances; no geopy or scaling needed.
- Use Python `polyline` to decode `overview_polyline` (precision 5).
- Truck limits sent to Mapbox: `max_height` and `max_width` in **meters**, `max_weight` in **metric
  tons**. Convert from mm and lb; never send the raw imperial values.

### 6.2 Checkpoint risk

| Condition    |     Low |    Moderate |        High |      Severe | No Travel |
| ------------ | ------: | ----------: | ----------: | ----------: | --------: |
| Wind (mph)   |   `<25` |     `25–34` |     `35–44` |     `45–54` |    `>=55` |
| Rain (in/hr) | `<0.10` | `0.10–0.25` | `0.25–0.50` | `0.50–1.00` |   `>1.00` |
| Snow (in/hr) |  `<0.5` |   `0.5–1.0` |   `1.0–2.0` |   `2.0–3.0` |    `>3.0` |

Implement ranges with no gaps for fractional values:

- Wind: `<25`, `[25,35)`, `[35,45)`, `[45,55)`, `>=55`.
- Rain: `<0.10`, `[0.10,0.25)`, `[0.25,0.50)`, `[0.50,1.00]`, `>1.00`.
- Snow: `<0.5`, `[0.5,1.0)`, `[1.0,2.0)`, `[2.0,3.0]`, `>3.0`.

Scores: Low=0, Moderate=1, High=2, Severe=3, No Travel=4.

Load overrides apply to wind only:

```text
if wind >= 55:                                   wind_adjusted = 4
elif 45 <= wind < 55 and load > 30000:           wind_adjusted = 4
elif 35 <= wind < 45 and load > 40000:           wind_adjusted = max(wind_base, 3)
else:                                            wind_adjusted = wind_base
```

Strict boundaries: `> 30,000` and `> 40,000` do not trigger at exactly 30,000/40,000.

Final checkpoint risk:

```text
risk_score = max(wind_adjusted, rain_score, snow_score)
risk_level = LOW | MODERATE | HIGH | SEVERE | NO_TRAVEL
heatmap_intensity = risk_score / 4.0
```

### 6.3 Distance and speed

```text
distance_miles = route.distance / 1609.344
duration_hours = route.duration / 3600
avg_speed_mph = distance_miles / duration_hours
```

Guard non-finite/zero values. Require `route.duration`; if it is absent, fall back to
`duration_typical` and warn, and fail with 502 if both are missing.

Decode the polyline. Mapbox Directions API provides `annotations=distance` containing the segment
distances in meters between consecutive vertices. Accumulate these segment distances directly to build
the cumulative distance odometer, with no geodesic calculation or scaling needed. Reuse this cumulative
array for checkpoint interpolation.

### 6.4 Checkpoints

Sampling interval is automatically determined by route distance:
- `dist <= 20`: checkpoint at `total_dist / 2` (checkpoints at 0, dist / 2, destination)
- `20 < dist <= 100`: interval = `10` miles
- `100 < dist <= 200`: interval = `25` miles
- `dist > 200`: interval = `50` miles

Create checkpoints at:

```text
0, interval, 2*interval, ..., destination
```

Do not duplicate the destination when the total is an exact multiple.

For each target distance `D`:

1. Find the polyline segment containing `D`.
2. Interpolate latitude/longitude linearly within that segment.
3. `travel_hours = D / avg_speed_mph`.
4. `eta = departure_utc + travel_hours`.
5. `arrival_hour_offset = floor(travel_hours + 0.5)` (half-up; not Python `round`).
6. `segment_miles[0] = 0`; for `k > 0`, `segment_miles[k] = D_k - D_{k-1}`.

The origin checkpoint has no preceding segment; the destination represents the final segment. Segment miles sum to the route distance.

### 6.5 Route metrics

```text
no_travel_miles = sum(segment_miles where risk == 4)
severe_miles    = sum(segment_miles where risk == 3)
high_miles      = sum(segment_miles where risk == 2)
moderate_miles  = sum(segment_miles where risk == 1)
low_miles       = sum(segment_miles where risk == 0)
avg_risk_score  = sum(risk * segment_miles) / sum(segment_miles where risk > 0) if any else 0.0 (excludes low-risk miles to prevent denominator dilution)
```

### 6.6 No Travel rule

- A route with `no_travel_miles > 0` is **never recommended**.
- It is still returned, ranked, and displayed on the map.
- If every route has `no_travel_miles > 0`, set `recommended_route_id = null`, all `is_recommended = false`, and add a `no_safe_route` warning.

### 6.7 Ranking

Sort all routes ascending by:

```text
(no_travel_miles, severe_miles, high_miles, avg_risk_score, total_duration_hours, source_index)
```

The recommended route is the first route with `no_travel_miles == 0`. This intentionally puts No Travel ahead of Severe, per the product decision. `source_index` preserves Mapbox's original order (routes arrive sorted by ascending `weight`) for exact ties.

### 6.8 Truck position

For slider hour `t` in `[0, 48]`:

```text
distance = min(total_distance_miles, avg_speed_mph * t)
```

Interpolate along checkpoints at that distance. The truck stops at the destination once the trip duration elapses. Precompute positions at a fixed step for O(1) lookup during dragging.

### 6.9 Heatmap

- Deduplicate checkpoint coordinates across all routes, rounded to 5 decimals.
- `corridor_heatmap.points` is the unique coordinate list.
- For each point and each offset `0..forecast_hours` (where `forecast_hours = max(48, longest arrival_hour_offset)`), compute the load-aware risk score and `intensity = score / 4.0`.
- `hourly_intensity["h"]` has keys `"0"` through `str(forecast_hours)`, each array aligned with `points`.
- The heatmap is anchored to departure time, not each route's ETA.
- Slider frames use `Math.round(t)` for O(1) lookup. Marker risk uses the nearest integer hour. Truck position uses continuous `t`.

### 6.10 Long trips

Checkpoint weather and corridor heatmap must cover the full trip. If the longest route exceeds 48 hours, fetch weather beyond 48 hours up to Open-Meteo's 16-day limit, set `arrival_hour_offset` beyond 48 as needed, and extend the corridor heatmap to `forecast_hours = max(48, longest arrival_hour_offset)`. Add `forecast_extended_for_checkpoints` when this happens. If the trip exceeds 16 days from now, return 422.

---

## 7. Integrations

### 7.0 Routing Providers (TomTom & Mapbox)

The backend routing service (`apps.api.services.routing.fetch_routes`) supports both **TomTom Routing API** (default when `TOMTOM_API_KEY` is set) and **Mapbox Directions API**.

* **TomTom Routing API (`services/tomtom.py`)**:
  * Dedicated `travelMode=truck` with commercial vehicle regulations (`vehicleCommercial=true`).
  * Enforces physical clearances (`vehicleHeight`, `vehicleWidth`, `vehicleLength`) and weight ratings (`vehicleWeight`, `vehicleAxleWeight`, `vehicleNumberOfAxles`).
  * Actively returns up to 3 distinct alternative corridors (`maxAlternatives=3`, `alternativeType=anyRoute`), solving Mapbox's limitation where only 2 routes were returned for most highway corridors.
  * Point coordinates are encoded into polyline precision 5 and segment distances are extracted directly from TomTom's native road-network annotations via `extendedRouteRepresentation=distance` with strict upstream validation.
* **Mapbox Directions API (`services/mapbox.py`)**:
  * Retained as a reliable fallback provider when `ROUTING_PROVIDER=mapbox` or when `TOMTOM_API_KEY` is unset.

### 7.1 Mapbox Directions — truck limits + traffic

```text
GET https://api.mapbox.com/directions/v5/mapbox/driving-traffic/{lng},{lat};{lng},{lat}
  ?alternatives=true
  &geometries=polyline
  &overview=full
  &steps=false
  &annotations=distance
  &notifications=all
  &depart_at=2026-11-04T14:00:00Z
  &max_height=4.114
  &max_width=2.59
  &max_weight=29.48
  &access_token=MAPBOX_ACCESS_TOKEN
```

Critical facts:

- **There is no truck profile.** Mapbox supports `driving-traffic`, `driving`, `walking`, `cycling`.
  Truck behaviour is approximated by `driving-traffic` plus the vehicle limit parameters
  `max_height` (m, 0–10), `max_width` (m, 0–10), and `max_weight` (metric tons, 0–100). Always add a
  `truck_restrictions_unsupported` warning so the UI and reviewer know it is not true truck routing.
- `max_height`, `max_width`, and `max_weight` **default to a 1.6 m × 1.9 m × 2.5 t vehicle** when
  omitted. Always send all three explicitly, computed from the truck profile plus the request load.
  Never rely on the defaults.
- Road height/width/weight restriction coverage varies by region. There is no
  `routeRestrictionsPartiallyIgnored` signal; Mapbox silently routes with the data it has.
- `MAPBOX_TRUCK_RESTRICTIONS_ENABLED=false` is a diagnostic escape hatch only. It must be explicit
  config, logged, and must still emit the warning; never switch profiles silently.
- Mapbox has no length or axle-count inputs. `TRUCK_LENGTH_MM` and `TRUCK_AXLE_COUNT` are recorded
  for documentation only and are **not** sent.
- `alternatives=true` returns the primary route plus **up to two** alternatives. Fewer than 3 is
  normal; return what exists and warn `fewer_than_three_routes`.
- `geometries=polyline` keeps the classic precision-5 encoding, so both `polyline.decode` and
  `@mapbox/polyline` work unchanged. `overview=full` is required for a usable corridor; `steps=false`
  keeps the payload small.
- `max_weight` for the example request above (35,000 lb load + 30,000 lb tare = 65,000 lb) is
  `65000 * 0.45359237 / 1000 ≈ 29.48` metric tons. Compute it per request; never hard-code it.
- `notifications=all` is the closest replacement for Google's `routes.warnings`: it reports closure
  and restriction notifications per leg. Map only notifications you can explain in the UI; ignore the
  rest.
- `depart_at` is a genuine (time-dependent) input for `driving-traffic`: live traffic is mixed in
  only for departures close to now, otherwise historical data is used. Pass the request departure
  time through; do not substitute `now`. When `depart_at` is outside the live-traffic window, add a
  `departure_time_approximated` warning so the UI says "historical traffic" rather than implying
  real-time conditions.
- The origin/destination coordinates are snapped to the road network (`waypoints[].location`). Use
  the snapped coordinates — not the geocoded ones — for checkpoint 0 and the final checkpoint.

Errors (Mapbox semantics, not HTTP-status semantics):

- `code: "NoRoute"` and `code: "NoSegment"` return **HTTP 200**. Check `code == "Ok"` and a non-empty
  `routes` array, otherwise return 422.
- `401` invalid/missing token and `403` account or token-restriction problems are configuration
  errors: fail fast, never retry, never expose the token or response body.
- `422 InvalidInput` is a bug on our side (bad parameter); return 502 with a safe message.
- `429` and `5xx`/timeouts: bounded retry with backoff, then 429/502/504.

Limits: 25 waypoints, 10,000 km total, ~300 requests/minute. `GET` URLs are capped around 8 KB, which
2 coordinates never approaches.

### 7.2 Open-Meteo

```text
GET https://api.open-meteo.com/v1/forecast
  ?latitude=<comma-separated>
  &longitude=<comma-separated>
  &hourly=temperature_2m,wind_speed_10m,rain,snowfall
  &temperature_unit=fahrenheit
  &wind_speed_unit=mph
  &precipitation_unit=inch
  &timezone=GMT
  &start_hour=YYYY-MM-DDTHH:00
  &end_hour=YYYY-MM-DDTHH:00
```

- Multiple coordinates are comma-separated; the JSON response is a list of location objects.
- `timezone=GMT` keeps timestamps in UTC.
- `start_hour`/`end_hour` are inclusive.
- Fetch from the top of the departure hour through `max(48, longest checkpoint offset)` inclusive.
- Validate the returned `time` array by value; do not assume row 0 is departure.
- Read `hourly_units` and normalize rain/snow to inches/hour (`mm/25.4`, `cm/2.54`). Do not trust defaults blindly.
- Batch coordinates conservatively (start with 100/request, configurable) and use bounded concurrency (start with 4).
- Null/non-finite required values → fail closed with 502 `weather_unavailable`.
- Fewer samples than expected → 502 `weather_incomplete`.

### 7.3 Location Search — 2-Step Search & Retrieve (Frontend Direct)

To keep the system simple and avoid server-side geocoding during route planning:

1. **Step 1 (Search recommendations on Enter):**
   When the user enters an origin or destination query and presses Enter, frontend calls the Mapbox Search Box API (`/suggest`) using the public token (`VITE_MAPBOX_PUBLIC_TOKEN`) to get candidate recommendations.
2. **Step 2 (Retrieve coordinates on selection):**
   When the user selects a recommendation from the list, frontend calls Mapbox Search Box API (`/retrieve`) to retrieve its exact coordinates `[lng, lat]` and full display name. That's 2 requests per location.
3. **Route planning receives coordinates directly:**
   The frontend submits `{ name, lat, lng }` for origin and destination to `POST /api/v1/routes/plan/`. The backend does not perform geocoding during route planning; it calls Mapbox Directions directly with `{origin.lng},{origin.lat};{dest.lng},{dest.lat}`.

This completely decouples location search from backend routing, keeping backend code lean, fast, and free of geocoding logic.

### 7.4 Map tiles

Leaflet + OpenStreetMap tiles with attribution for v1. This keeps the Mapbox token server-side. If the
map later moves to Mapbox Styles, it needs a separate **public** (`pk.`) token in the frontend — that
is a different token from `MAPBOX_ACCESS_TOKEN` and must be added to `.env.example` when it happens.

---

## 8. Persistence and 1-hour reuse

**Status:** `RouteAnalysis` and its initial migration are implemented. Reuse logic and the plan/history endpoints are pending (M4).

Model `RouteAnalysis` in `apps/api/models.py`:

```python
id: UUID
client_id: CharField(64, indexed)
request_hash: CharField(64, indexed)
origin: CharField
destination: CharField
departure_time: DateTimeField
load_weight_lbs: PositiveIntegerField
sample_interval_miles: PositiveSmallIntegerField
request_meta: JSONField
response_payload: JSONField
recommended_route_id: CharField(null=True)
recommended_route_name: CharField(null=True)
total_distance_miles: FloatField(null=True)
total_duration_hours: FloatField(null=True)
created_at: DateTimeField(default=timezone.now, indexed)
```

Index `(client_id, request_hash, created_at)` and `(client_id, created_at)`.

Reuse logic:

- Normalize the request: round origin/destination lat & lng to 5 decimals, trim and casefold names for hashing (store original for display), UTC departure, integer load, interval, plus `PLAN_CACHE_VERSION` and truck profile version.
- `request_hash = sha256(canonical_json(normalized_request))`.
- Look up the latest row with the same `client_id` + `request_hash` where `created_at >= now - 1 hour`.
- If found, return a copy of `response_payload` with `reused: true`.
- Otherwise compute, save a new row, and return it with `reused: false`.
- Reuse is scoped by client ID so history is not shared between anonymous users.
- If the same inputs are submitted after 1 hour, create a new analysis.
- A failed computation must not create a row.
- No background jobs, Redis, or Celery.

SQLite is fine for local development. Hosting may need Postgres if the filesystem is ephemeral; decide with hosting.

---

## 9. Frontend

### Layout

- Left sidebar: form, recommended route summary, route comparison, checkpoint list, history.
- Main: Leaflet map.
- Bottom/top: 0–48h forecast slider and legend.
- Mobile: collapsible form/history, map primary, checkpoint drawer.

### Form

Origin and destination search inputs with search-on-Enter (Request 1) and selection to resolve coordinates (Request 2). Departure (`datetime-local`), load weight (lbs), interval segmented control (10, 25, 50). Default load 40,000 and interval 25. Disable submit while loading or until coordinates are selected; show field errors, progress, retry.

### Map

- OSM tiles.
- Route polylines; recommended route thicker.
- Checkpoint markers colored by risk with text labels.
- `leaflet.heat` overlay below routes/markers.
- Truck `DivIcon` on the recommended route.
- Fit bounds after load.

### History

- Fetch `/api/v1/analyses/` on startup and after a successful plan.
- Generate a UUID in `localStorage` and send `X-Client-Id`.
- Clicking an entry loads `/api/v1/analyses/{id}/` into the same view.
- Show "Saved" / "Reused" state from `created_at` and `reused`.

### 60 FPS slider

- Do not put the per-frame value in React state.
- Keep the value in a small external store/ref; update via `requestAnimationFrame`.
- Precompute `frames[h]` as `[lat, lng, intensity]` arrays for `h = 0..48`.
- Update `leaflet.heat` imperatively; update checkpoint marker styles only when the rounded hour changes.
- Precompute truck positions at a fixed time step; `setLatLng` per frame.
- No network calls while dragging. Cancel rAF on unmount.
- Respect `prefers-reduced-motion`.

If `leaflet.heat.setLatLngs` is too slow at realistic point counts, replace only the heat rendering with a custom canvas layer. Do not change the API or risk math.

### Dependencies

```text
leaflet
react-leaflet
leaflet.heat
@types/leaflet
@mapbox/polyline
```

Dev/test: `vitest`, `jsdom`, `@testing-library/react`, `@testing-library/user-event`.

No state library, no Axios, no CSS framework unless explicitly decided.

### Formatting and accessibility

- `Intl.DateTimeFormat`, `Intl.NumberFormat`.
- Units explicit: mi, h/min, mph, in/hr, lb.
- Risk never by color alone; include text/icon.
- Labels, keyboard access, `aria-valuetext` on the slider, accessible map controls.
- Loading, empty, error, and no-safe-route states.

---

## 10. Testing and commands

### Backend tests

**Current state:** no tests are checked in yet; testing is deferred. The list below is the required suite for the later testing pass.

- Risk thresholds on both sides of every boundary; load overrides; max combination; `rule_triggered`.
- Geopy distance, polyline decode, cumulative scaling, interpolation.
- Checkpoint intervals 10/25/50, exact multiples, destination inclusion, half-up offsets, segment sums.
- Metrics, ranking, No Travel never recommended, all-No-Travel → null recommendation.
- Heatmap dedupe, 49 arrays aligned to points, load applied, offsets.
- Cache reuse within 1 hour, new row after 1 hour, client scoping, failed computation not saved.
- API validation, 1/2/3 routes, upstream errors, no secrets.
- Geocoding success/failure, `NoRoute` with HTTP 200, polyline precision, truck limit conversion,
  token never logged.
- Mock Mapbox/Open-Meteo. No live calls in unit tests.

### Frontend tests

- Polyline decoder, risk labels/colors, form validation.
- History load and `X-Client-Id`.
- Slider frame lookup clamps at 0/48, truck distance clamps at destination.
- Loading/error/no-safe-route states.

### Commands

```bash
# backend
cd backend
uv sync
uv run python manage.py makemigrations
uv run python manage.py migrate
uv run python manage.py runserver
uv run ruff check .
uv run ruff format --check .
uv run pytest

# frontend
cd frontend
pnpm install
pnpm dev
pnpm build
pnpm lint
pnpm format:check
pnpm typecheck
```

`django-cors-headers` is installed. Add `polyline`, `geopy`, `httpx`, and a test runner to backend dependencies as needed. Add `gunicorn` when deploying. CORS already allows the `x-client-id` header.

### Environment

```dotenv
DJANGO_SECRET_KEY=change-me
DJANGO_DEBUG=true
DJANGO_ALLOWED_HOSTS=localhost,127.0.0.1
CORS_ALLOWED_ORIGINS=http://localhost:5173

# Mapbox Directions (M2)
MAPBOX_ACCESS_TOKEN=
MAPBOX_DIRECTIONS_BASE_URL=https://api.mapbox.com/directions/v5
MAPBOX_PROFILE=driving-traffic
MAPBOX_TRUCK_RESTRICTIONS_ENABLED=true
MAPBOX_LANGUAGE=en

TRUCK_HEIGHT_MM=4114
TRUCK_WIDTH_MM=2590
TRUCK_LENGTH_MM=21945
TRUCK_AXLE_COUNT=5
TRUCK_TARE_WEIGHT_LBS=30000

OPEN_METEO_BASE_URL=https://api.open-meteo.com/v1/forecast
OPEN_METEO_BATCH_SIZE=100
OPEN_METEO_CONCURRENCY=4
HTTP_TIMEOUT_SECONDS=15
PLAN_CACHE_TTL_SECONDS=3600
PLAN_CACHE_VERSION=v1
```

Frontend (`frontend/.env`):

```dotenv
VITE_API_BASE_URL=http://localhost:8000
VITE_MAPBOX_PUBLIC_TOKEN=pk.eyJ...
```

Never commit `.env` or keys. Backend `MAPBOX_ACCESS_TOKEN` is a server-side secret (used for Directions API). Frontend `VITE_MAPBOX_PUBLIC_TOKEN` is a standard public (`pk.`) token (used for Search Box suggest/retrieve).

---

## 11. Code quality

- Backend: type hints, dataclasses, pure domain functions, `zoneinfo`/UTC, `httpx` timeouts, narrow exceptions, structured logs with request ID, no keys in logs.
- Use `polyline.decode` and Mapbox distance annotations; do not reimplement either.
- Frontend: strict TypeScript, no `any`, `import type`, stable keys, cleanup effects/rAF, `AbortController`.
- Keep map code imperative and isolated from React render state.
- Small focused commits: `feat:`, `fix:`, `test:`, `docs:`, `chore:`, `refactor:`.
- Update this file when behavior or architecture changes.

---

## 12. Milestones

- **M0 — Wire scaffold:** add `apps/__init__.py`, fix `ApiConfig.name`, add DRF/CORS/API app, health endpoint, settings, `.env.example`, backend README. ✅ Done (health/CORS smoke-checked; automated tests deferred).
- **M1 — Domain + tests:** types, geopy geo, risk, checkpoints, aggregation, heatmap, ranking. Tests deferred.
- **M2 — Mapbox Directions:** `driving-traffic` Directions client using direct coordinates, `max_height`/`max_width`/`max_weight`, 1–3 routes, `code`-based error handling. (No server geocoding in plan pipeline).
- **M3 — Open-Meteo:** batching, units, UTC alignment, 0–48 + long-trip extension, heatmap matrix.
- **M4 — Persistence + API:** `RouteAnalysis`, migrations, 1h reuse, history endpoints, serializers, errors. Model + migration already landed; API work remains.
- **M5 — Frontend foundation:** Leaflet, polyline decode, API client/types, form, route lines.
- **M6 — Checkpoints/summaries:** markers, cards, metrics, recommendation/no-safe-route UI, legend.
- **M7 — Heatmap/slider/truck:** external frame store, `leaflet.heat`, marker updates, truck animation, 60 FPS profiling.
- **M8 — History/polish:** history panel, mobile, accessibility, empty/error states, README.
- **M9 — Deploy/Loom:** hosting, secrets, CORS, smoke test, 5–10 minute walkthrough.

Acceptance: `POST /plan` returns the §5 shape; same request within 1h returns `reused: true`; history loads; slider holds 60 FPS; No Travel route is shown but never recommended.

---

## 13. Non-goals

- Keystroke-by-keystroke real-time typeahead (v1 uses simple search on Enter -> pick recommendation to retrieve coords)
- User accounts, payments, saved favorites
- Live traffic updates after the initial plan
- Turn-by-turn navigation
- Hazmat routing
- Weather alerts/radar
- Multi-stop optimization
- Custom routing engine
- Redis/Celery/background workers

---

## 14. Locked decisions and open questions

### Locked

1. **No Travel is highest risk.** A route with any No Travel miles is displayed but never recommended. If all routes have No Travel, `recommended_route_id` is null.
2. **Mapbox, traffic, and truck limits.** Use `mapbox/driving-traffic` with `max_height`, `max_width`, and `max_weight` computed from the truck profile and load. Mapbox has no truck profile, so this is an explicit, surfaced approximation (`truck_restrictions_unsupported` warning), not silent car routing.
3. **Location search & direct coordinates.** Handled client-side using Mapbox Search Box API with a public token (`VITE_MAPBOX_PUBLIC_TOKEN`). User searches on Enter to get suggestions and selects to retrieve coordinates (2 requests per point). The plan endpoint takes coordinates directly and sends them straight to Mapbox Directions without server-side geocoding.
4. **Forecast.** 49 inclusive hourly samples (`0..48`) for the heatmap/slider. Extend checkpoint weather beyond 48h for long trips, up to Open-Meteo's 16-day limit.
5. **Hosting.** Deferred; decide later.
6. **Polyline/distance.** Mapbox distance annotations (`annotations=distance`) and Python `polyline` on the backend; `@mapbox/polyline` on the frontend.
7. **Persistence.** Store analyses, list them, and reuse an identical request within 1 hour.
8. **Response shape.** Follow §5, with the small history/state additions.

### Open / confirm before M2

1. **Truck profile.** The app only collects load weight. Confirm the default dimensions and tare weight: 4114 mm high × 2590 mm wide, 30,000 lb tare. Only height, width, and gross weight reach Mapbox (as 4.114 m, 2.59 m, and `(load + tare) * 0.45359237 / 1000` metric tons); length and axle count cannot be sent. Confirm that approximation is acceptable for the demo.
2. **“Similar request” definition.** Current plan: identical normalized origin, destination, departure time, load, interval, cache version, and truck profile within 1 hour. If departure time may differ, cache reuse would return stale ETAs/weather. Confirm this is intended.
3. **History privacy.** Current plan: per-browser anonymous `X-Client-Id`; cache reuse is also scoped to that client. Confirm or switch to global history.
4. **Production database.** SQLite is fine locally; if the host has ephemeral storage, use Postgres. Decide with hosting. The backend also pins Python **3.15**; confirm the host supports it or lower `requires-python`/`.python-version` to a tested version.
5. **Alternative route count.** Mapbox returns a primary route plus at most two alternatives, and often only one. Confirm that "up to 3, sometimes fewer, with a `fewer_than_three_routes` warning" is acceptable for the 3-route requirement rather than forcing a third route by other means.
6. **Truck restriction coverage.** Mapbox documents that height/width/weight restriction data coverage varies by region and gives no partial-ignore signal. Accept the silence, or additionally warn whenever the gross weight exceeds a configured threshold?
