# Weather-Aware Commercial Truck Routing

A full-stack logistics and route optimization platform that empowers commercial truck drivers and dispatchers to evaluate route safety based on live atmospheric hazards, cargo payload weight, and vehicle clearance restrictions.

The application evaluates up to 3 viable commercial corridors, dynamically samples checkpoints along the road network, fetches precision weather forecasts corresponding to the truck's exact estimated time of arrival (ETA), and recommends the safest route using strict safety rules.

---

## Live Links & Deliverables

- **Hosted Web Application**: [https://weather-aware-trucking.vercel.app](https://weather-aware-trucking.vercel.app)
- **Production API**: `https://3-7-112-167.sslip.io/api/v1/health/`
- **Demo Access Passcode**: `spotter2026`
- **Walkthrough Video**: [Watch Loom Walkthrough](#) *(Replace with your Loom link)*

---

## Key Features

- **Commercial Truck Routing**: Integrates TomTom Truck Routing API with vehicle dimensions (height: 4.11 m, width: 2.59 m, length: 21.9 m, tare weight: 30,000 lbs, 5 axles) and commercial transport regulations, backed by Mapbox Directions fallback.
- **Dynamic Checkpoint Sampling**: Automatically calculates the optimal sampling interval based on total route distance:
  - `Distance <= 20 mi`: Checkpoints at Origin, Midpoint, and Destination (`dist / 2`).
  - `20 mi < Distance <= 100 mi`: Checkpoint every **10 miles**.
  - `100 mi < Distance <= 200 mi`: Checkpoint every **25 miles**.
  - `Distance > 200 mi`: Checkpoint every **50 miles**.
- **Precision Checkpoint ETA Weather**: Samples hourly weather forecasts from Open-Meteo corresponding to each checkpoint's estimated arrival time (`ETA = departure_time + checkpoint_distance / avg_speed`).
- **Load-Aware Risk Assessment**: Evaluates wind, rain, and snow severity while dynamically applying heavy cargo load adjustments to crosswind exposure.
- **Strict No-Travel Safety Policy**: Any corridor containing a single "No Travel" segment is strictly disqualified from recommendation (`is_recommended = false`).
- **Deterministic Route Ranking**: Sorts safe corridors using multi-criteria ranking: lowest Severe miles, lowest High miles, lowest distance-weighted average risk, and shortest travel duration.
- **Interactive 48+ Hour Corridor Heatmap**: Smooth WebGL heatmap overlay (via MapLibre GL) visualizing atmospheric risk along the corridor, scrubbable hour-by-hour with continuous truck position interpolation.
- **1-Hour Analysis Caching**: In-memory and SQLite-backed SHA-256 analysis caching scoped by anonymous client sessions to eliminate redundant third-party API calls.

---

## Domain Risk & Safety Rules

### 1. Weather Hazard Thresholds

| Risk Level | Score | Sustained Wind (mph) | Rain (in/hr) | Snow (in/hr) | Action |
| :--- | :---: | :---: | :---: | :---: | :--- |
| **LOW** | `0` | `< 25` | `< 0.10` | `< 0.5` | Normal safe transit |
| **MODERATE** | `1` | `25 – 34` | `0.10 – 0.25` | `0.5 – 1.0` | Caution advised |
| **HIGH** | `2` | `35 – 44` | `0.25 – 0.50` | `1.0 – 2.0` | Hazardous conditions |
| **SEVERE** | `3` | `45 – 54` | `0.50 – 1.00` | `2.0 – 3.0` | Dangerous conditions |
| **NO TRAVEL** | `4` | `≥ 55` | `> 1.00` | `> 3.0` | Transit prohibited |

### 2. Commercial Load Overrides (Wind Only)

Heavier loads elevate wind vulnerability due to rollover and jackknife dynamics:

- **Wind ≥ 55 mph**: Adjusted to **NO TRAVEL** (Score 4) regardless of cargo weight.
- **45 ≤ Wind < 55 mph AND Load > 30,000 lbs**: Adjusted to **NO TRAVEL** (Score 4).
- **35 ≤ Wind < 45 mph AND Load > 40,000 lbs**: Adjusted to at least **SEVERE** (Score 3).

Final checkpoint risk score:
```text
risk_score = max(wind_adjusted, rain_score, snow_score)
```
*(Ties break deterministically in order: `WIND_LOAD` -> `WIND` -> `RAIN` -> `SNOW`)*.

### 3. Route Recommendation & Ranking

Routes are sorted ascending by the following criteria:
1. `no_travel_miles` (Ascending — must be `0.0` to be eligible for recommendation)
2. `severe_miles` (Ascending)
3. `high_miles` (Ascending)
4. `avg_risk_score` (Ascending, distance-weighted `0..4`)
5. `total_duration_hours` (Ascending)
6. `total_distance_miles` (Ascending)

If all available corridors contain "No Travel" segments, `recommended_route_id` is set to `null` and a `no_safe_route` warning is returned.

---

## System Architecture

```text
┌────────────────────────────────────────────────────────┐
│                   React 19 Frontend                    │
│    (MapLibre GL, Tailwind CSS, TanStack Query, Vite)   │
└───────────────────────────┬────────────────────────────┘
                            │ HTTPS (TLS via Caddy)
                            ▼
┌────────────────────────────────────────────────────────┐
│               Caddy Reverse Proxy (Alpine)             │
│        (Automated Let's Encrypt / ZeroSSL TLS)         │
└───────────────────────────┬────────────────────────────┘
                            │ HTTP (Internal Docker Network)
                            ▼
┌────────────────────────────────────────────────────────┐
│               Django 6 REST API (Gunicorn)             │
│  ├── apps.api.views (Request validation & throttling)  │
│  ├── apps.api.services                                 │
│  │   ├── routing.py (TomTom Truck API / Mapbox fallback)│
│  │   ├── open_meteo.py (Batch weather forecasts)       │
│  │   └── analysis_cache.py (1-hour SHA-256 reuse)      │
│  └── apps.api.domain (Pure Python domain mathematics)  │
│      ├── geo.py (Polyline odometer & interpolation)    │
│      ├── risk.py (Weather & cargo load overrides)      │
│      ├── checkpoints.py (ETA & interval generation)    │
│      ├── aggregation.py (Segment mileage aggregation)  │
│      ├── ranking.py (Multi-factor safety ranking)      │
│      └── heatmap.py (0–48h intensity coordinate matrix)│
└────────────────────────────────────────────────────────┘
```

---

## Algorithmic Pipeline

1. **Route Acquisition**: Commercial truck routing queries TomTom (enforcing vehicle dimensions, axle count, and weight ratings) with fallback to Mapbox Directions `driving-traffic`. Returns up to 3 viable alternative corridors.
2. **Cumulative Odometer Computation**: Decodes polyline coordinates and builds a monotonic cumulative distance odometer array from upstream segment distance annotations (avoiding geodesic approximations).
3. **Adaptive Checkpoint Generation**: Selects sampling frequency based on total corridor mileage (`<=20 mi` -> `dist/2`, `20-100 mi` -> `10 mi`, `100-200 mi` -> `25 mi`, `>200 mi` -> `50 mi`).
4. **Coordinate Interpolation**: Locates target distance segments via binary search and linearly interpolates exact WGS84 coordinates along the highway geometry.
5. **Checkpoint ETA Calculation**: Calculates arrival time relative to departure:
   `travel_hours = checkpoint_distance / avg_speed_mph`
   `ETA = departure_time + travel_hours`
   `arrival_hour_offset = round_half_up(travel_hours)`
6. **Batch Weather Fetching**: Batches coordinates and queries Open-Meteo's hourly API for temperature, wind speed, rain, and snow at the arrival hour.
7. **Risk Scoring & Metric Aggregation**: Applies threshold rules and load overrides to calculate distance-weighted risk and aggregate miles by severity tier.
8. **Heatmap Matrix Construction**: Deduplicates checkpoint coordinates and generates an intensity matrix (`intensity = risk_score / 4.0`) for hours `0` through `max(48, longest_eta)`.

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

### Infrastructure & Deployment
- **Containerization**: Docker, Docker Compose
- **Web Server / Edge**: Caddy 2 (automated HTTPS certificate management via `sslip.io`)
- **Cloud Provider**: AWS EC2 (Ubuntu 24.04 LTS with Elastic Static IP)

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
# Open .env and add your TOMTOM_API_KEY or MAPBOX_ACCESS_TOKEN

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

## Docker & Production Deployment (AWS EC2)

The application includes production-ready Docker Compose and Caddy configuration with automated SSL termination.

### 1. Launch AWS EC2 Instance
- **OS**: Ubuntu 24.04 LTS (x86_64).
- **Security Group Inbound Rules**:
  - Port `22` (SSH)
  - Port `80` (HTTP - required for ACME certificate challenge)
  - Port `443` (HTTPS)
- Attach an **Elastic IP** (Static IP) to the instance.

### 2. Deploy with Docker Compose

SSH into your server and run:

```bash
# Clone the repository
git clone https://github.com/IamAyaanSk/weather-aware-trucking.git
cd weather-aware-trucking

# Configure environment variables
cp backend/.env.example backend/.env
nano backend/.env
```

Set your production variables in `backend/.env`:
```ini
DOMAIN_NAME=YOUR_STATIC_IP.sslip.io
DJANGO_SECRET_KEY=generate-a-strong-secret-key-here
DJANGO_DEBUG=false
DJANGO_ALLOWED_HOSTS=*
CSRF_TRUSTED_ORIGINS=https://YOUR_STATIC_IP.sslip.io
CORS_ALLOWED_ORIGINS=https://weather-aware-trucking.vercel.app

TOMTOM_API_KEY=your_tomtom_key
MAPBOX_ACCESS_TOKEN=your_mapbox_token
SITE_ACCESS_PASSWORD=spotter2026
```

Build and run containers:
```bash
docker compose up -d --build
```

Caddy will automatically contact Let's Encrypt / ZeroSSL, provision trusted TLS certificates for your domain, and reverse-proxy traffic to Gunicorn.

---

## API Reference

### 1. Plan Route Analysis

```http
GET /api/v1/routes/plan/?origin_lat=41.8781&origin_lng=-87.6298&origin_name=Chicago,%20IL&dest_lat=39.7392&dest_lng=-104.9903&dest_name=Denver,%20CO&departure_time=2026-11-06T14:00:00Z&load_weight_lbs=35000
```

#### Query Parameters

| Parameter | Type | Required | Description |
| :--- | :---: | :---: | :--- |
| `origin_lat`, `origin_lng` | Float | Yes | WGS84 latitude and longitude of route origin. |
| `origin_name` | String | No | Human-readable label for origin. |
| `dest_lat`, `dest_lng` | Float | Yes | WGS84 latitude and longitude of route destination. |
| `dest_name` | String | No | Human-readable label for destination. |
| `departure_time` | String | Yes | ISO 8601 departure timestamp with offset (e.g. `2026-11-06T14:00:00Z`). |
| `load_weight_lbs` | Integer | No | Cargo payload in pounds (default `0`). |

#### Response Structure (Truncated Example)

```json
{
  "analysis_id": "c1f7a4d2-...",
  "created_at": "2026-11-06T04:12:00Z",
  "reused": false,
  "request_meta": {
    "origin": { "name": "Chicago, IL", "lat": 41.8781, "lng": -87.6298 },
    "destination": { "name": "Denver, CO", "lat": 39.7392, "lng": -104.9903 },
    "departure_time": "2026-11-06T14:00:00Z",
    "load_weight_lbs": 35000,
    "sample_interval_miles": 50,
    "max_forecast_hours": 48
  },
  "recommended_route_id": "route_1",
  "routes": [
    {
      "id": "route_1",
      "name": "I-80 W",
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
      "overview_polyline": "u{~vFvyys@...",
      "checkpoints": [
        {
          "index": 0,
          "mile_marker": 0.0,
          "lat": 41.8781,
          "lng": -87.6298,
          "eta_iso": "2026-11-06T14:00:00Z",
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

### 2. Verify Access Passcode

```http
POST /api/v1/auth/verify/
Content-Type: application/json

{ "password": "spotter2026" }
```

### 3. Health Check

```http
GET /api/v1/health/
```
Returns `{"status": "ok"}` for container orchestration and uptime monitors.

---

## Verification & Testing

Run all unit tests and static linters:

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

## License

This project is licensed under the MIT License.
