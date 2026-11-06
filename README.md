# Weather-Aware Commercial Truck Routing

I built this project to solve a real-world problem in freight logistics: helping commercial truck drivers and fleet dispatchers navigate around dangerous weather hazards instead of driving blindly into them.

The core idea is straightforward: a 1,000-mile cross-country haul takes 15+ hours, so looking at static weather at departure time is fundamentally flawed. Instead, this platform evaluates up to 3 viable highway corridors via the Mapbox Directions API, dynamically samples checkpoints along the actual road network, fetches precision weather forecasts corresponding to when the truck will **actually arrive** at each checkpoint (ETA), and recommends the safest route using strict commercial safety rules.

---

## Urls

- **Hosted Web Application**: [https://weather-aware-trucking.vercel.app](https://weather-aware-trucking.vercel.app)
- **Walkthrough Video**: [Watch Loom Walkthrough](https://www.loom.com/share/464d98adf0934a2bb42ecaa02b6b32c2)

---

## Key Features

- **Multi-Route Corridor Planning**: I query the Mapbox Directions API (`driving-traffic` profile) (I also implemented tomtom but it is comparatively slower than Mapbox) with commercial vehicle approximations and live/historical traffic data to evaluate up to 3 viable route options.
- **Dynamic Checkpoint Sampling**: Rather than using a rigid sampling interval everywhere, I adjust checkpoint frequency based on total corridor distance:
  - `Distance <= 20 mi`: Checkpoints at Origin, Midpoint, and Destination (`distance / 2`).
  - `20 mi < Distance <= 100 mi`: Checkpoint every **10 miles**.
  - `100 mi < Distance <= 200 mi`: Checkpoint every **25 miles**.
  - `Distance > 200 mi`: Checkpoint every **50 miles**.
- **Precision Checkpoint ETA Weather**: I sample hourly forecasts from Open-Meteo strictly at each checkpoint's estimated arrival time (`ETA = departure_time + checkpoint_distance / avg_speed`), rather than taking a static departure snapshot.
- **Load-Aware Risk Assessment**: I evaluate wind, rain, and snow severity while dynamically factoring in cargo payload weight (heavy trailers are far more vulnerable to crosswind rollovers).
- **Strict No-Travel Safety Policy**: Safety comes first. Any corridor containing even a single "No Travel" segment is strictly disqualified from being recommended (`is_recommended = false`).
- **Deterministic Route Ranking**: Safe corridors are ranked with a deterministic multi-factor tuple: lowest Severe miles, lowest High miles, lowest distance-weighted average risk, and shortest travel duration.
- **Interactive 48+ Hour Corridor Heatmap**: A WebGL heatmap overlay (built on MapLibre GL) visualizing atmospheric risk along the corridor, scrubbable hour-by-hour with a moving truck marker.
- **1-Hour Analysis Caching**: Request-level SHA-256 analysis caching scoped by anonymous client sessions to eliminate redundant upstream API calls and keep response times fast (<15ms on cache hits).

---

## How It Works (P.S. this has formulaes but u can understand it easily)

Here is how the backend pipeline transforms raw origin/destination coordinates into an actionable, weather-scored route recommendation:

```text
1. Route Generation ──► 2. Cumulative Distance ──► 3. Sampling Logic ──► 4. Linear Interpolation
   (Mapbox API)           (Polyline Odometer)        (Adaptive Miles)       (WGS84 Checkpoints)
                                                                                   │
                                                                                   ▼
8. Corridor Heatmap ◄── 7. Route Ranking      ◄── 6. Risk Scoring    ◄── 5. Weather at ETA
   (0–48h Matrix)          (Strict No-Travel)        (Load Overrides)       (Open-Meteo API)
```

### 1. Route Generation (`services/mapbox.py`)

- The user picks origin and destination coordinates (via address search or by clicking directly on the map).
- I query the Mapbox Directions API using the `driving-traffic` profile with `alternatives=true` to retrieve up to 3 corridors (1 primary + up to 2 alternatives).
- I explicitly request `annotations=distance` alongside `geometries=polyline` (`overview=full`), which gives me exact per-segment road distances directly from Mapbox's highway network graph.

### 2. Cumulative Distance Odometer (`domain/geo.py`)

- I decode the precision-5 polyline into discrete coordinate vertices: `[(lat_0, lng_0), ..., (lat_n, lng_n)]`.
- Rather than computing approximate geodesic distances (like Haversine or Vincenty), which cut corners on highway curves and accumulate miles of drift over long trips, I directly sum Mapbox's native segment distance annotations:
  ```text
  D_0 = 0
  D_k = D_{k-1} + delta_d_k
  ```
- This builds a strictly monotonic cumulative odometer array with zero geometric drift, matching actual highway driving mileage.

### 3. Sampling Distance Logic (`domain/checkpoints.py`)

- I wanted high spatial fidelity on short trips without creating hundreds of redundant API calls on cross-country trips. So I implemented an adaptive interval based on total route distance:
  - **`dist <= 20 mi`**: Sample interval = `dist / 2` (produces 3 checkpoints: 0, midpoint, destination).
  - **`20 mi < dist <= 100 mi`**: Sample interval = **`10 miles`**.
  - **`100 mi < dist <= 200 mi`**: Sample interval = **`25 miles`**.
  - **`dist > 200 mi`**: Sample interval = **`50 miles`**.
- Milestone target distances are generated at:
  ```text
  D_targets = [0, interval, 2 * interval, ..., total_distance]
  ```
  _(The destination checkpoint is deduplicated when the total distance is an exact multiple of the interval)_.

### 4. Linear Interpolation to Determine Checkpoints (`domain/geo.py`)

- I used linear interpolation along the route's decoded polyline for accurate placement of checkpoint coordinates:
  1. I find the exact polyline segment `[D_i, D_{i+1}]` containing target distance `D` using binary search (`bisect_right`).
  2. I calculate the segment progress ratio:
     ```text
     t = (D - D_i) / (D_{i+1} - D_i)
     ```
  3. I linearly interpolate the exact WGS84 coordinates along that road segment:
     ```text
     lat = lat_i + t * (lat_{i+1} - lat_i)
     lng = lng_i + t * (lng_{i+1} - lng_i)
     ```
  4. Checkpoint 0 snaps to the snapped origin, and the terminal checkpoint snaps to the snapped destination.
  5. I calculate estimated arrival time:
     ```text
     travel_hours = D / avg_speed_mph
     ETA = departure_time_utc + travel_hours
     arrival_hour_offset = floor(travel_hours + 0.5)  (half-up rounding)
     ```
  6. Each checkpoint represents the preceding road segment: `segment_miles[k] = D_k - D_{k-1}` (with `segment_miles[0] = 0`).

### 5. Weather at Checkpoint ETA (`services/open_meteo.py`)

- A truck leaving Mumbra for Mumbai won't reach Thane for 1+ hours. Querying weather at departure time would give misleading data.
- I batch all unique checkpoint coordinates and query Open-Meteo's hourly forecast API, extracting temperature (°F), wind speed (mph at 10m), rain (in/hr), and snowfall (in/hr) matching each checkpoint's specific `arrival_hour_offset`.

### 6. Risk Scoring & Cargo Load Overrides (`domain/risk.py`)

- I grade each weather attribute into severity tiers (0=Low, 1=Moderate, 2=High, 3=Severe, 4=No Travel).
- Commercial trucks face high rollover risk under crosswinds when carrying heavy cargo. I apply weight-based wind overrides:
  - If `wind >= 55 mph`: **No Travel** (all loads).
  - If `45 <= wind < 55 mph` and `load > 30,000 lbs`: **No Travel**.
  - If `35 <= wind < 45 mph` and `load > 40,000 lbs`: at least **Severe**.
- The composite checkpoint score is the maximum of all conditions:
  ```text
  risk_score = max(wind_adjusted, rain_score, snow_score)
  ```
  _(Ties resolve deterministically: `WIND_LOAD` -> `WIND` -> `RAIN` -> `SNOW`)_.

### 7. Route Metric Aggregation & Recommendation Ranking (`domain/aggregation.py`, `domain/ranking.py`)

- I sum segment mileage for each risk category (`no_travel_miles`, `severe_miles`, `high_miles`, `moderate_miles`, `low_miles`).
- I compute the distance-weighted average risk score across the trip:
  ```text
  avg_risk_score = sum(risk_score * segment_miles) / total_distance_miles
  ```
- Corridors are ranked using this multi-factor tuple:
  ```text
  (no_travel_miles, severe_miles, high_miles, avg_risk_score, total_duration_hours, total_distance_miles)
  ```
- **Strict Safety Rule**: Any route with `no_travel_miles > 0` is disqualified from recommendation. The recommended route is the top-ranked safe route. If all routes contain No Travel miles, `recommended_route_id` is set to `null` with a `no_safe_route` warning.

### 8. Corridor Heatmap Matrix (`domain/heatmap.py`)

- To make timeline scrubbing instant on the frontend, I precompute risk intensities (`intensity = risk_score / 4.0`) for every unique checkpoint coordinate across hours `0` through `max(48, longest_arrival_hour_offset)`.
- The frontend receives this aligned matrix and can scrub through 48+ hours with zero network requests and silky-smooth 60fps performance.

---

## Domain Risk & Safety Rules

### 1. Weather Hazard Thresholds

| Risk Level    | Score | Sustained Wind (mph) | Rain (in/hr)  | Snow (in/hr) | Action               |
| :------------ | :---: | :------------------: | :-----------: | :----------: | :------------------- |
| **LOW**       |  `0`  |        `< 25`        |   `< 0.10`    |   `< 0.5`    | Normal safe transit  |
| **MODERATE**  |  `1`  |      `25 – 34`       | `0.10 – 0.25` | `0.5 – 1.0`  | Caution advised      |
| **HIGH**      |  `2`  |      `35 – 44`       | `0.25 – 0.50` | `1.0 – 2.0`  | Hazardous conditions |
| **SEVERE**    |  `3`  |      `45 – 54`       | `0.50 – 1.00` | `2.0 – 3.0`  | Dangerous conditions |
| **NO TRAVEL** |  `4`  |        `≥ 55`        |   `> 1.00`    |   `> 3.0`    | Transit prohibited   |

### 2. Commercial Load Overrides (Wind Only)

Heavier loads significantly elevate rollover and jackknife risks under severe crosswinds:

- **Wind ≥ 55 mph**: Adjusted to **NO TRAVEL** (Score 4) regardless of cargo weight.
- **45 ≤ Wind < 55 mph AND Load > 30,000 lbs**: Adjusted to **NO TRAVEL** (Score 4).
- **35 ≤ Wind < 45 mph AND Load > 40,000 lbs**: Adjusted to at least **SEVERE** (Score 3).

---

## Engineering & Architectural Decisions

Here are the key technical decisions I made while building this system and why I made them:

### 1. Why I used Mapbox segment annotations instead of Haversine formulas

(Mapbox provides accurate distance between points as annotations hence used that directly)Calculating straight-line (Haversine) distances between polyline coordinates cuts highway corners, ignores elevation profiles, and accumulates noticeable mileage drift over a 1,000-mile trip. By asking Mapbox for `annotations=distance` directly, I get the exact road-network segment measurements from their underlying routing graph. This ensures the odometer perfectly matches highway driving miles.

### 2. Why I went with adaptive distance-tiered sampling

A fixed 10-mile interval on a 2,000-mile cross-country haul generates 200+ checkpoints per route (600+ across 3 corridors). That causes excessive Open-Meteo payload sizes and hits rate limits, while adding very little macro-weather insight. Conversely, a fixed 50-mile interval on a 30-mile regional trip yields zero intermediate checkpoints. Tiering by route distance (`dist/2`, 10 mi, 25 mi, 50 mi) gives high resolution on short trips while keeping long-haul trips fast and responsive.

### 3. Why weather is sampled at arrival ETA rather than departure

Weather changes dramatically over a 15-hour drive. Taking a snapshot of weather at departure time would tell a driver what Nebraska looks like _right now_, not what it will look like when they actually arrive 8 hours later. Calculating `travel_hours = distance / avg_speed` and querying weather at `arrival_hour_offset` reflects the actual conditions the driver will encounter.

### 4. Why I decoupled the domain logic into pure Python

I kept all core mathematical and business logic in `apps.api.domain` completely isolated from Django, DRF, and HTTP clients. This clean architecture means geo-math, checkpoint interpolation, risk rules, and ranking logic are 100% framework-agnostic. It allowed me to write unit tests that run in under 2ms with zero mocks, fixtures, or database overhead.

### 5. Why I precomputed the heatmap matrix on the backend

If the frontend had to make network requests every time a user dragged the timeline slider, the UI would lag and stutter. By precomputing an aligned 0–48+ hour coordinate-intensity matrix on the backend, the frontend MapLibre GL WebGL layer can perform instant $O(1)$ frame lookups, resulting in silky-smooth 60fps scrubbing.

### 6. Why I added 1-hour deterministic caching

Weather forecast models update on hourly cycles, and road geometries are static. By hashing normalized request parameters (`origin`, `destination`, `departure_hour`, `load_weight`) with SHA-256, identical requests within 1 hour return stored analyses immediately. This drops latency from ~1.5 seconds down to <15ms.

---

## Tech Stack

### Frontend

- **Framework**: React 19, TypeScript
- **Bundler & Tooling**: Vite 8, React Compiler, Oxlint, Oxfmt
- **Map & Visualization**: MapLibre GL (OpenFreeMap vector tiles), WebGL Heatmap layer
- **Styling**: Tailwind CSS v4, Lucide Icons
- **State & Data**: TanStack Query (React Query)

### Backend

- **Framework**: Django 6.1, Django REST Framework
- **Runtime & Package Manager**: Python 3.12+ / 3.15, Astral `uv`
- **Application Server**: Gunicorn WSGI
- **HTTP Client**: HTTPX (connection pooling, retry backoff)
- **Geometry**: `polyline`, `geopy`
- **Quality & Linting**: Ruff

---

## Local Development Setup

### Prerequisites

- Node.js 20+ and `pnpm`
- Python 3.12+ and `uv`

### 1. Backend Setup

```bash
cd backend

# Install dependencies using uv
uv sync

# Configure environment
cp .env.example .env
# Open .env and add your MAPBOX_ACCESS_TOKEN

# Apply database migrations
uv run python manage.py migrate

# Run unit tests
uv run python manage.py test

# Start local server
uv run python manage.py runserver 8000
```

Verify backend health:

```bash
curl http://127.0.0.1:8000/api/v1/health/
# {"status": "ok"}
```

### 2. Frontend Setup

```bash
cd frontend

# Install dependencies
pnpm install

# Configure environment
cp .env.example .env
# Ensure VITE_API_BASE_URL=http://localhost:8000/api/v1

# Start Vite dev server
pnpm dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## Verification & Testing

```bash
# Backend unit tests & Ruff linting
cd backend
uv run python manage.py test
uv run ruff check .

# Frontend typechecking & linter
cd ../frontend
pnpm run typecheck
pnpm run lint
```

---

## Author

Ayaan Shaikh [https://ayaan.dev](https://ayaan.dev)

## License

This project is licensed under the MIT License.
