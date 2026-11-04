# AGENTS.md — Weather-Aware Truck Routing

> Root context for AI agents and contributors. Read §2 before assuming anything is implemented.
> **Last verified:** 2026-11-04
> **Assignment:** Full Stack Developer — Weather-Aware Truck Routing
> **Repo:** `https://github.com/IamAyaanSk/weather-aware-trucking`

## Agent quick start

1. §5 (API) and §6 (risk/route math) are normative.
2. Never call Google or Open-Meteo from unit tests. Use fixtures/mocks.
3. Run backend `ruff`/tests and frontend `oxlint`/`oxfmt`/`typecheck` before committing.
4. Update this file when contracts, architecture, or domain rules change.
5. Keep the implementation simple and non-repetitive. Prefer one clear code path over abstractions for hypothetical needs.

---

## 1. Product

The user enters origin, destination, departure time, load weight (lbs), and a sampling interval (10, 25, or 50 miles). The app:

1. Gets up to 3 truck routes from Google Routes API.
2. Samples each route every _N_ miles.
3. Gets hourly weather for every checkpoint from Open-Meteo.
4. Scores each checkpoint with the given wind/rain/snow/load rules.
5. Aggregates route risk, recommends a safe route, and displays all routes.
6. Shows a 0–48 hour corridor heatmap, forecast slider, and moving truck marker.
7. Stores each analysis so it can be revisited from a history list.
8. Reuses an analysis for the same request made within the last hour.

### Deliverables

- GitHub repository
- Hosted application
- 5–10 minute Loom walkthrough

### Evaluation

| Area | Weight |
|---|---:|
| Routes, weather, risk, recommendation | 40% |
| UI, map, heatmap smoothness/performance | 40% |
| Code quality | 15% |
| Documentation and walkthrough | 5% |

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

- Django **6.1.3**, DRF **3.18.3**, `django-cors-headers`, `httpx`, `geopy`, `polyline`, `python-dotenv`.
- Python **3.15**, uv, Ruff, pytest + pytest-django, SQLite.
- M0 wired: `apps/__init__.py` exists, `ApiConfig.name = "apps.api"`, DRF + CORS + `apps.api` are registered, settings are env-driven, and `/api/v1/health/` is served.
- `config/urls.py` mounts `apps.api.urls` at `/api/v1/`; `/admin/` keeps CSRF.
- Public API views use `authentication_classes = []` and `AllowAny`; anonymous throttling defaults to `120/min`.
- `apps/api/tests/` is a package (health + CORS preflight tests); no serializers, services, domain layer, `RouteAnalysis` model, or plan endpoints yet. `views.py`/`models.py` are still scaffolds.

### Frontend

- Vite **8.3.5**, React **19.3.1**, TypeScript **~7.0.2**, React Compiler.
- pnpm **11.18.0**; oxlint/oxfmt.
- `src/App.tsx` is a placeholder (`<h1>Hello</h1>`).
- No Leaflet, heatmap, polyline, form, data-fetching, or test dependencies.

**Everything below is the target design, not implemented yet. Current milestone: M1.**

---

## 3. Architecture

```text
React + Vite + Leaflet
  │  POST /api/v1/routes/plan/
  │  GET  /api/v1/analyses/
  │  GET  /api/v1/analyses/{id}/
  ▼
Django + DRF
  ├── thin view + serializer
  ├── services/: Google Routes, Open-Meteo
  ├── domain/: geo, risk, checkpoint, ranking, heatmap
  └── SQLite/Postgres: RouteAnalysis history + 1h reuse
         │
         ├──► Google Routes API (TRUCK, traffic-aware)
         └──► Open-Meteo API
```

### Rules

- The calculation is request-scoped; the only persistence is the `RouteAnalysis` record.
- Keys stay server-side. Never expose `GOOGLE_MAPS_API_KEY` to Vite.
- Views validate and delegate. No risk math or upstream calls in `views.py`.
- `domain/` is pure Python: no Django, DRF, `httpx`, or settings imports.
- Fail closed if required weather is missing. Never assume calm weather.
- No silent fallback from truck routing to car routing. Fallback must be explicit config.

---

## 4. Target layout

```text
backend/
├── apps/
│   ├── __init__.py
│   └── api/
│       ├── apps.py                  # name = "apps.api"
│       ├── urls.py
│       ├── views.py                 # plan + history endpoints
│       ├── serializers.py
│       ├── models.py                # RouteAnalysis
│       ├── exceptions.py
│       ├── domain/
│       │   ├── types.py
│       │   ├── geo.py               # geopy geodesic + interpolation
│       │   ├── risk.py
│       │   ├── checkpoints.py
│       │   ├── aggregation.py
│       │   ├── heatmap.py
│       │   └── planner.py
│       ├── services/
│       │   ├── google_routes.py
│       │   ├── open_meteo.py
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

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/v1/routes/plan/` | Create or reuse an analysis |
| `GET` | `/api/v1/analyses/` | List this client's saved analyses |
| `GET` | `/api/v1/analyses/{id}/` | Full stored analysis |
| `GET` | `/api/v1/health/` | Hosting health check |

No authentication. History is scoped by an anonymous `X-Client-Id` header (UUID generated in `localStorage`). If the header is absent, use `"anonymous"`. Add DRF anonymous throttling. `X-Client-Id` only scopes history; it is **not** authentication or a security boundary. Set `authentication_classes = []` and `permission_classes = [AllowAny]` on these public views so DRF session auth does not impose CSRF on the cross-origin POST; keep CSRF for `/admin/`.

### Request

```json
{
  "origin": "Chicago, IL",
  "destination": "Denver, CO",
  "departure_time": "2026-11-04T14:00:00Z",
  "load_weight_lbs": 35000,
  "sample_interval_miles": 25
}
```

- `departure_time`: ISO 8601 with offset. Normalize to UTC internally.
- `sample_interval_miles`: `10`, `25`, or `50`.
- `load_weight_lbs`: integer, `>= 0`; sanity upper bound documented in serializer.
- `origin`/`destination`: non-empty strings. Google Routes handles address waypoints. Photon/autocomplete is deferred to v2.
- Reject origin == destination, naive datetimes, past departures, and departures beyond Open-Meteo's 16-day forecast range.

### Response

```json
{
  "analysis_id": "b0f5c9d4-...",
  "created_at": "2026-11-04T13:42:11Z",
  "reused": false,
  "request_meta": {
    "origin": "Chicago, IL",
    "destination": "Denver, CO",
    "departure_time": "2026-11-04T14:00:00Z",
    "load_weight_lbs": 35000,
    "sample_interval_miles": 25,
    "max_forecast_hours": 48
  },
  "recommended_route_id": "route_1",
  "routes": [
    {
      "id": "route_1",
      "name": "via I-80 W",
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
          "heatmap_point_index": 0,
          "eta_iso": "2026-11-04T14:00:00Z",
          "arrival_hour_offset": 0,
          "arrival_weather": {
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

- `analysis_id`, `created_at`, `reused`, and `warnings` are small additions needed for history and UI state.
- `recommended_route_id` is **null** when every route has any No Travel miles. All `is_recommended` are then false, but every route is still returned and displayed.
- `routes` is ordered best-first by the ranking in §6.7.
- `risk_level` is uppercase: `LOW`, `MODERATE`, `HIGH`, `SEVERE`, `NO_TRAVEL`.
- `rule_triggered` is `null` for Low, otherwise one of `WIND`, `RAIN`, `SNOW`, `WIND_LOAD`. Ties resolve in order: `WIND_LOAD`, `WIND`, `RAIN`, `SNOW`.
- `metrics.avg_risk_score` is the distance-weighted average risk in `0..4`.
- `arrival_hour_offset` is a non-negative integer. It may exceed 48 for long trips; the heatmap remains `0..48`.
- `corridor_heatmap.hourly_intensity` has keys `"0"` through `"48"`; each array aligns by index with `points`. `checkpoints[].heatmap_point_index` points into that array.
- `overview_polyline` is Google's encoded polyline. Frontend decodes with `@mapbox/polyline`; backend decodes with Python `polyline`.
- `warnings` entries use `{ "code": "...", "message": "..." }`, e.g. `fewer_than_three_routes`, `no_safe_route`, `route_restrictions_ignored`, `forecast_extended_for_checkpoints`.

### History list response

```json
{
  "analyses": [
    {
      "analysis_id": "b0f5c9d4-...",
      "created_at": "2026-11-04T13:42:11Z",
      "origin": "Chicago, IL",
      "destination": "Denver, CO",
      "departure_time": "2026-11-04T14:00:00Z",
      "load_weight_lbs": 35000,
      "sample_interval_miles": 25,
      "recommended_route_id": "route_1",
      "recommended_route_name": "via I-80 W",
      "total_distance_miles": 1004.2,
      "total_duration_hours": 15.6
    }
  ]
}
```

Newest first, limit 50. `GET /api/v1/analyses/{id}/` returns the full stored response and is scoped to the same `X-Client-Id`.

### Errors

```json
{ "error": { "code": "weather_unavailable", "message": "Weather data could not be retrieved." } }
```

| Condition | Status |
|---|---:|
| Validation error | 400 |
| Analysis not found | 404 |
| No route / trip beyond forecast range | 422 |
| Upstream rate limit | 429 |
| Upstream error / malformed response | 502 |
| Upstream timeout | 504 |
| Unexpected error | 500 |

Never expose API keys, raw upstream bodies, or stack traces.

---

## 6. Domain rules (normative)

### 6.1 Units and constants

- Miles, mph, inches/hour, pounds, WGS84 coordinates.
- `FORECAST_HOURS = 48`; heatmap offsets `0..48` inclusive (49 samples).
- `MAX_ROUTES = 3`; intervals `(10, 25, 50)`.
- Use `geopy.distance.geodesic` for all geodesic distances.
- Use Python `polyline` to decode `overview_polyline`.

### 6.2 Checkpoint risk

| Condition | Low | Moderate | High | Severe | No Travel |
|---|---:|---:|---:|---:|---:|
| Wind (mph) | `<25` | `25–34` | `35–44` | `45–54` | `>=55` |
| Rain (in/hr) | `<0.10` | `0.10–0.25` | `0.25–0.50` | `0.50–1.00` | `>1.00` |
| Snow (in/hr) | `<0.5` | `0.5–1.0` | `1.0–2.0` | `2.0–3.0` | `>3.0` |

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
distance_miles = distanceMeters / 1609.344
duration_hours = duration_seconds / 3600
avg_speed_mph = distance_miles / duration_hours
```

Guard non-finite/zero values. If `duration` is missing, use `staticDuration` and warn; if both are missing, fail.

Decode the polyline. Compute cumulative geodesic distance between consecutive vertices with `geopy`. If the cumulative length differs from Google's `distance_meters`, scale it so the final cumulative distance equals `distance_miles`. Compute distances once per route and reuse them for checkpoint interpolation; do not recompute geodesic distance for every checkpoint.

### 6.4 Checkpoints

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
avg_risk_score  = sum(risk * segment_miles) / total_distance_miles
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

The recommended route is the first route with `no_travel_miles == 0`. This intentionally puts No Travel ahead of Severe, per the product decision. `source_index` preserves Google's original order for exact ties.

### 6.8 Truck position

For slider hour `t` in `[0, 48]`:

```text
distance = min(total_distance_miles, avg_speed_mph * t)
```

Interpolate along checkpoints at that distance. The truck stops at the destination once the trip duration elapses. Precompute positions at a fixed step for O(1) lookup during dragging.

### 6.9 Heatmap

- Deduplicate checkpoint coordinates across all routes, rounded to 5 decimals.
- `corridor_heatmap.points` is the unique coordinate list.
- Each checkpoint stores its `heatmap_point_index`.
- For each point and each offset `0..48`, compute the load-aware risk score and `intensity = score / 4.0`.
- `hourly_intensity["h"]` is an array aligned with `points`.
- The heatmap is anchored to departure time, not each route's ETA.
- Slider frames use `Math.round(t)` for O(1) lookup. Marker risk uses the nearest integer hour. Truck position uses continuous `t`.

### 6.10 Long trips

Checkpoint weather must cover the full trip. If the longest route exceeds 48 hours, fetch weather beyond 48 hours up to Open-Meteo's 16-day limit and set `arrival_hour_offset` beyond 48 as needed. The heatmap and slider remain `0..48`. Add `forecast_extended_for_checkpoints` when this happens. If the trip exceeds 16 days from now, return 422.

---

## 7. Integrations

### 7.1 Google Routes — truck + traffic

Use Large Vehicle Routing:

```json
{
  "origin": { "address": "Chicago, IL" },
  "destination": { "address": "Denver, CO" },
  "travelMode": "TRUCK",
  "routingPreference": "TRAFFIC_AWARE_OPTIMAL",
  "departureTime": "2026-11-04T14:00:00Z",
  "computeAlternativeRoutes": true,
  "polylineQuality": "HIGH_QUALITY",
  "polylineEncoding": "ENCODED_POLYLINE",
  "units": "IMPERIAL",
  "languageCode": "en-US",
  "routeModifiers": {
    "vehicleInfo": {
      "totalHeightMm": "4114",
      "totalWidthMm": "2590",
      "totalLengthMm": "21945",
      "totalWeightKg": "31751",
      "totalAxleCount": 5
    }
  }
}
```

Field mask must include:

```text
routes.distanceMeters,
routes.duration,
routes.staticDuration,
routes.polyline.encodedPolyline,
routes.description,
routes.routeLabels,
routes.warnings,
routes.travelAdvisory.routeRestrictionsPartiallyIgnored
```

Critical facts:

- `TRUCK` + `TRAFFIC_AWARE_OPTIMAL` requires **Large Vehicle Routing**, which Google says is limited-access and must be provisioned for the Cloud project. Confirm access before implementation.
- The generic Routes reference restricts `routingPreference` to `DRIVE`/`TWO_WHEELER`, but the Large Vehicle Routing guide explicitly instructs `TRUCK` + `TRAFFIC_AWARE_OPTIMAL`. Follow the LVR guide and verify against the provisioned project. If the API rejects the combination, stop and report the conflict; do not guess.
- `GOOGLE_TRUCK_ROUTING_ENABLED=false` must fail fast with a clear configuration error; it must not silently switch to `DRIVE`.
- LVR is generally available in the contiguous 48 US and experimental in Japan. Outside that, the request fails.
- `vehicleInfo` is required. `totalHeightMm`, `totalLengthMm`, `totalWidthMm`, and `totalWeightKg` are required for trucking to trigger.
- The app only collects **load weight**, not truck dimensions or tare weight. Use a configurable default 5-axle semi profile and `gross_weight_lbs = load_weight_lbs + TRUCK_TARE_WEIGHT_LBS`. This is a v1 assumption that must be confirmed.
- `computeAlternativeRoutes: true` returns up to 3 routes total, not necessarily 3. If fewer, return what exists and warn.
- The example `totalWeightKg` of `31751` assumes a 40,000 lb load plus a 30,000 lb tare = 70,000 lb gross. Compute it from the actual request; do not hard-code that number.
- If `routeRestrictionsPartiallyIgnored` is true, warn `route_restrictions_ignored`; still display the route.
- Do **not** silently fall back to `DRIVE` if LVR is unavailable. A dev-only fallback must be explicit via `GOOGLE_DRIVE_FALLBACK=true` and must be visible in logs/UI.
- Do not send `avoidTolls` with `TRUCK`; truck toll support is not available.

Errors: no retry on 400/403; bounded retry on 429/5xx/timeouts; return 429/502/504 with safe messages.

### 7.2 Open-Meteo

```text
GET https://api.open-meteo.com/v1/forecast
  ?latitude=<comma-separated>
  &longitude=<comma-separated>
  &hourly=wind_speed_10m,rain,snowfall
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

### 7.3 Geocoding

- v1: address waypoints directly to Google Routes. No separate geocoder.
- Photon/autocomplete is **v2**, not now.
- Never expose the Google key to the browser.

### 7.4 Map tiles

Leaflet + OpenStreetMap tiles with attribution. If tile limits become a problem, switch providers and update attribution.

---

## 8. Persistence and 1-hour reuse

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

- Normalize the request: trim and casefold origin/destination for hashing (store the original for display), UTC departure, integer load, interval, plus `PLAN_CACHE_VERSION` and truck profile version.
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

Origin, destination, departure (`datetime-local`), load weight (lbs), interval segmented control. Default load 40,000 and interval 25. Disable submit while loading; show field errors, progress, retry.

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

- Risk thresholds on both sides of every boundary; load overrides; max combination; `rule_triggered`.
- Geopy distance, polyline decode, cumulative scaling, interpolation.
- Checkpoint intervals 10/25/50, exact multiples, destination inclusion, half-up offsets, segment sums.
- Metrics, ranking, No Travel never recommended, all-No-Travel → null recommendation.
- Heatmap dedupe, 49 arrays aligned to points, load applied, offsets.
- Cache reuse within 1 hour, new row after 1 hour, client scoping, failed computation not saved.
- API validation, 1/2/3 routes, upstream errors, no secrets.
- Mock Google/Open-Meteo. No live calls in unit tests.

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

Add `polyline`, `geopy`, `httpx`, `django-cors-headers`, and a test runner to backend dependencies as needed. Add `gunicorn` when deploying. Configure `django-cors-headers` to allow the `x-client-id` header.

### Environment

```dotenv
DJANGO_SECRET_KEY=change-me
DJANGO_DEBUG=true
DJANGO_ALLOWED_HOSTS=localhost,127.0.0.1
CORS_ALLOWED_ORIGINS=http://localhost:5173

GOOGLE_MAPS_API_KEY=
GOOGLE_TRUCK_ROUTING_ENABLED=true
GOOGLE_DRIVE_FALLBACK=false

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

Frontend: `VITE_API_BASE_URL=http://localhost:8000`.

Never commit `.env` or keys. The Google key must never use a `VITE_` prefix.

---

## 11. Code quality

- Backend: type hints, dataclasses, pure domain functions, `zoneinfo`/UTC, `httpx` timeouts, narrow exceptions, structured logs with request ID, no keys in logs.
- Use `polyline.decode` and `geopy.distance.geodesic`; do not reimplement either.
- Frontend: strict TypeScript, no `any`, `import type`, stable keys, cleanup effects/rAF, `AbortController`.
- Keep map code imperative and isolated from React render state.
- Small focused commits: `feat:`, `fix:`, `test:`, `docs:`, `chore:`, `refactor:`.
- Update this file when behavior or architecture changes.

---

## 12. Milestones

- **M0 — Wire scaffold:** add `apps/__init__.py`, fix `ApiConfig.name`, add DRF/CORS/API app, health endpoint, settings, `.env.example`, backend README. ✅ Done.
- **M1 — Domain + tests:** types, geopy geo, risk, checkpoints, aggregation, heatmap, ranking.
- **M2 — Google Routes:** TRUCK/traffic client, vehicleInfo, field mask, 1–3 routes, LVR/error handling.
- **M3 — Open-Meteo:** batching, units, UTC alignment, 0–48 + long-trip extension, heatmap matrix.
- **M4 — Persistence + API:** `RouteAnalysis`, migrations, 1h reuse, history endpoints, serializers, errors.
- **M5 — Frontend foundation:** Leaflet, polyline decode, API client/types, form, route lines.
- **M6 — Checkpoints/summaries:** markers, cards, metrics, recommendation/no-safe-route UI, legend.
- **M7 — Heatmap/slider/truck:** external frame store, `leaflet.heat`, marker updates, truck animation, 60 FPS profiling.
- **M8 — History/polish:** history panel, mobile, accessibility, empty/error states, README.
- **M9 — Deploy/Loom:** hosting, secrets, CORS, smoke test, 5–10 minute walkthrough.

Acceptance: `POST /plan` returns the §5 shape; same request within 1h returns `reused: true`; history loads; slider holds 60 FPS; No Travel route is shown but never recommended.

---

## 13. Non-goals

- Photon/autocomplete (v2)
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
2. **Truck + traffic.** Use Google `TRUCK` + `TRAFFIC_AWARE_OPTIMAL` via Large Vehicle Routing.
3. **Geocoding.** Use Google Routes address waypoints in v1. Photon in v2.
4. **Forecast.** 49 inclusive hourly samples (`0..48`) for the heatmap/slider. Extend checkpoint weather beyond 48h for long trips, up to Open-Meteo's 16-day limit.
5. **Hosting.** Deferred; decide later.
6. **Polyline/geodesic.** Python `polyline` and `geopy.distance.geodesic` on the backend; `@mapbox/polyline` on the frontend.
7. **Persistence.** Store analyses, list them, and reuse an identical request within 1 hour.
8. **Response shape.** Follow §5, with the small history/state additions.

### Open / confirm before M2

1. **Google LVR access.** Is the Google Cloud project provisioned for Large Vehicle Routing? Without it, `TRUCK` + `TRAFFIC_AWARE_OPTIMAL` will fail. If not provisioned, do we temporarily use `DRIVE` for the demo, or block on access?
2. **Truck profile.** The app only collects load weight. Confirm the default dimensions, axle count, and tare weight for `vehicleInfo`; the current placeholder is a 5-axle semi (4114 × 2590 × 21945 mm, 5 axles, 30,000 lb tare). `totalWeightKg` will be `(load + tare) * 0.45359237`.
3. **“Similar request” definition.** Current plan: identical normalized origin, destination, departure time, load, interval, cache version, and truck profile within 1 hour. If departure time may differ, cache reuse would return stale ETAs/weather. Confirm this is intended.
4. **History privacy.** Current plan: per-browser anonymous `X-Client-Id`; cache reuse is also scoped to that client. Confirm or switch to global history.
5. **Production database.** SQLite is fine locally; if the host has ephemeral storage, use Postgres. Decide with hosting. The backend also pins Python **3.15**; confirm the host supports it or lower `requires-python`/`.python-version` to a tested version.
6. **LVR alternatives.** Confirm the provisioned LVR project returns up to 3 alternatives with `computeAlternativeRoutes`. If it returns one, the 3-route requirement needs a different routing strategy.
