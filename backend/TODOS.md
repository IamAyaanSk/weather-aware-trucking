# Backend TODOs — Weather-Aware Truck Routing

> Agent-facing backlog for `backend/`. The normative source of truth is [`../AGENTS.md`](../AGENTS.md).
> If this file and `AGENTS.md` disagree, `AGENTS.md` wins; fix both when a contract changes.
>
> Last updated: 2026-11-04

## How to use this file

1. Work top-down through the active milestone. Do not start a later milestone while an earlier
   checkbox is open unless it is explicitly marked as a prerequisite/dependency.
2. Only tick a box after the change is implemented **and** verified with the command listed under
   [Verification](#verification).
3. Append a short `Context` note under a completed task: date, files touched, commands run,
   decisions/assumptions, and follow-ups. Future agents should not have to rediscover this.
4. Never call Mapbox or Open-Meteo from tests. Use fixtures/mocks.
5. Keep `domain/` pure Python: no Django, DRF, `httpx`, or settings imports.
6. Update `AGENTS.md` §2 and this file together when the architecture or API contract changes.
7. **Testing is currently deferred.** Do not add test files until the project owner starts the
   testing pass. Verify changes with `manage.py check`, Ruff, and manual smoke checks for now.

Status legend: `[ ]` pending · `[x]` done · `[~]` partially done / blocked · `[!]` blocked on a decision

## Status snapshot

| Milestone | State | Notes |
|---|---|---|
| M0 — Wire scaffold | `[x]` | Core scaffold complete. Tests are deferred by project direction. |
| M1 — Domain + tests | `[ ]` | Not started. Domain code only; tests are deferred. |
| M2 — Mapbox | `[ ]` | Not started. Geocoding + Directions. Blocked by token scope confirmation. |
| M3 — Open-Meteo | `[ ]` | Not started. |
| M4 — Persistence + API | `[~]` | `RouteAnalysis` model + migration done. Tests and API work remain. |
| M8 — Backend polish | `[ ]` | README, env example, structured logs. |
| M9 — Backend deploy | `[ ]` | Hosting, CORS, smoke test. |

Frontend milestones (M5–M8 UI) are tracked in `AGENTS.md`; this file only covers backend work.

## Reality check — 2026-11-04

`AGENTS.md` §2 described M0 as complete, but at inspection the checked-in backend was still the
default scaffold:

- `apps/` had no `__init__.py`; `ApiConfig.name = "api"`; `apps.api` was not in `INSTALLED_APPS`.
- No `apps/api/urls.py`, no health endpoint, no serializers/services/domain.
- `config/settings.py` was not env-driven; DRF and CORS were not registered.
- No `.env.example`, no `backend/README.md`, no test package.

M0 has since been completed (see below), and `RouteAnalysis` + its initial migration landed early as
M4.1/M4.2. No tests are checked in: testing is deferred until a dedicated pass.

## Plan change — Mapbox replaces Google Routes (2026-11-04)

The routing provider switched from Google Routes (Large Vehicle Routing) to **Mapbox Directions
API v5**. Consequences recorded across `AGENTS.md` §3, §5–§7, §10, §12, and §14:

- Mapbox has **no truck profile**. `mapbox/driving-traffic` plus `max_height`/`max_width`/
  `max_weight` is the approximation. `max_*` default to a 1.6 m × 1.9 m × 2.5 t car, so all three
  must always be sent explicitly.
- Mapbox Directions takes **coordinates only**. The frontend resolves coordinates via a 2-step
  location search (search on Enter -> get recommendations -> select to retrieve coords) and passes
  them directly to the route planning endpoint.
- `alternatives=true` yields the primary route plus at most two alternatives. Fewer than 3 is
  normal and must warn, not fail.
- `NoRoute` / `NoSegment` return **HTTP 200**, so error handling keys off the `code` field.
- Truck length and axle count cannot be sent to Mapbox; those env vars stay documentation-only.
- Geocoding results are temporary by default and must not be cached without `permanent=true`.

No routing code exists yet, so this is a plan/documentation change only. M2 is unblocked from the
old Google LVR provisioning question and is now blocked on Mapbox token scope confirmation instead.

---

## M0 — Wire scaffold

- [x] **M0.1** Create `apps/__init__.py`, fix `ApiConfig.name = "apps.api"`, register `apps.api` in
      `INSTALLED_APPS`.

      **Context (2026-11-04):** Done as a prerequisite for `makemigrations`. Files:
      `backend/apps/__init__.py`, `backend/apps/api/apps.py`, `backend/config/settings.py`.
      `default_auto_field` set to `BigAutoField` on the app config for consistency with Django
      defaults (the `RouteAnalysis` PK is an explicit UUID, so this only affects future models).

- [x] **M0.2** Register DRF + `django-cors-headers`; add the DRF anonymous throttle (`120/min`).

      **Context (2026-11-04):** Added `django-cors-headers>=4.9.0` with `uv add`. Registered
      `corsheaders` and `rest_framework`; added `CorsMiddleware` after `SecurityMiddleware`.
      `REST_FRAMEWORK` now defaults to `AllowAny`, `AnonRateThrottle`, and an `anon` rate of
      `120/min`.

- [x] **M0.3** Make `SECRET_KEY`, `DEBUG`, `ALLOWED_HOSTS`, and `CORS_ALLOWED_ORIGINS` env-driven
      with safe defaults for local development.

      **Context (2026-11-04):** `config/settings.py` loads `backend/.env` with `python-dotenv` and
      reads `DJANGO_SECRET_KEY`, `DJANGO_DEBUG`, `DJANGO_ALLOWED_HOSTS`, and
      `CORS_ALLOWED_ORIGINS`. Small `env_bool`/`env_list` helpers keep parsing explicit. Defaults
      are local-only (`localhost,127.0.0.1`, `http://localhost:5173`).

- [x] **M0.4** Add `apps/api/urls.py` with `GET /health/`; mount `apps.api.urls` at `/api/v1/` and
      keep `/admin/` on CSRF.

      **Context (2026-11-04):** `apps/api/views.py` exposes a DRF `health` view with
      `authentication_classes = []`, `AllowAny`, and a `{"status": "ok"}` response.
      `config/urls.py` mounts the API at `/api/v1/`; `/admin/` is unchanged and keeps CSRF.

- [x] **M0.5** Add `.env.example` and `backend/README.md` (setup, commands, env vars).

      **Context (2026-11-04):** Added both files. `.env.example` mirrors `AGENTS.md` §10, including
      placeholders for future Mapbox/Open-Meteo/truck/cache settings. `README.md` documents setup,
      the health endpoint, current/pending endpoints, commands, and the deferred testing pass.
      `CORS_ALLOW_HEADERS` extends Django CORS defaults with `x-client-id`.

- [~] **M0.6** Add backend test tooling (`pytest`, `pytest-django`). **Deferred by user direction.**
      The `tests/` package exists but is empty.

- [~] **M0.7** Add health + CORS preflight tests, including the `x-client-id` allowed header.
      **Deferred by user direction**; verification was done manually (see M0.8). Add these in the
      dedicated testing pass.

- [x] **M0.8** Run `uv run python manage.py check`, Ruff, and a health/CORS smoke check; record the
      result.

      **Context (2026-11-04):** `manage.py check` passes, `makemigrations --check --dry-run` reports
      no changes, and `ruff check .` / `ruff format --check .` pass. Manual smoke check:
      `GET /api/v1/health/` → `200 {"status": "ok"}`; CORS preflight from
      `http://localhost:5173` → `200` with `access-control-allow-origin` and `x-client-id` in
      `access-control-allow-headers`. Test suite is intentionally deferred.

## M1 — Domain + tests

- [ ] **M1.1** `domain/types.py`: enums/dataclasses for risk level, checkpoint, route, metrics,
      heatmap, and warnings.
- [ ] **M1.2** `domain/geo.py`: decode with `polyline`, cumulative `geopy.distance.geodesic`,
      scale to the provider's route distance, interpolate a coordinate at a target distance.
- [ ] **M1.3** `domain/risk.py`: wind/rain/snow thresholds (`AGENTS.md` §6.2) with inclusive
      boundaries, load overrides, `max()` combination, and deterministic `rule_triggered` ties.
- [ ] **M1.4** `domain/checkpoints.py`: 10/25/50-mile sampling, no duplicate destination, half-up
      hour offsets, segment miles summing to the route distance.
- [ ] **M1.5** `domain/aggregation.py`: §6.5 metrics and distance-weighted `avg_risk_score`.
- [ ] **M1.6** `domain/ranking.py`: §6.7 sort key, No Travel never recommended, all-No-Travel →
      `recommended_route_id = null` + `no_safe_route` warning.
- [ ] **M1.7** `domain/heatmap.py`: 5-decimal dedupe, stable indices, 49 hourly arrays aligned to
      points, load-aware intensity.
- [ ] **M1.8** Boundary tests for every risk threshold (just below / at / just above), load
      overrides at exactly 30,000 and 40,000 lb, and every `rule_triggered` tie.
- [ ] **M1.9** Checkpoint tests for intervals 10/25/50, exact multiples, one-checkpoint routes, and
      segment sums.
- [ ] **M1.10** Ranking tests for each tie-break field and for all-No-Travel routes.

## M2 — Mapbox Directions

- [ ] **M2.0** Confirm the Mapbox token has Directions scope and is not URL-restricted for server use.
- [ ] **M2.1** `services/http.py`: `httpx` client with timeouts, bounded retry on 429/5xx/timeouts,
      no retry on 401/403.
- [ ] **M2.2** `services/mapbox.py`: `mapbox/driving-traffic` Directions request accepting direct
      coordinates with `alternatives=true`, `geometries=polyline`, `overview=full`, `steps=false`,
      `depart_at`, and explicit `max_height`/`max_width`/`max_weight` in metric units.
- [ ] **M2.3** Fail fast on a missing/invalid token; `MAPBOX_TRUCK_RESTRICTIONS_ENABLED=false` is an
      explicit, logged escape hatch that still emits `truck_restrictions_unsupported`.
- [ ] **M2.4** Parse 1–3 routes: `distance`, `duration` (+`duration_typical` fallback), `geometry`,
      `legs[0].summary` as the route name, and snapped `waypoints[]` for the first/last checkpoint.
- [ ] **M2.5** Treat `NoRoute`/`NoSegment` as 422 even though Mapbox returns HTTP 200; map `401/403`,
      `InvalidInput`, 429, and 5xx to safe errors without leaking the token or response body.
- [ ] **M2.6** Mocked tests for 1/2/3 routes, `NoRoute` with HTTP 200, retry bounds, and
      truck parameter conversion. No live network calls in unit tests.
- [ ] **M2.7** Mocked tests for 1/2/3 routes, `NoRoute` with HTTP 200, geocode miss, retry bounds, and
      the distance/duration guards.

## M3 — Open-Meteo

- [ ] **M3.1** `services/open_meteo.py`: comma-separated coordinates, `timezone=GMT`, inclusive
      `start_hour`/`end_hour`, configurable batch size and concurrency.
- [ ] **M3.2** Validate timestamps by value (do not assume row 0 is departure) and normalize units
      from `hourly_units` to mph and in/hr.
- [ ] **M3.3** Fail closed on null/non-finite required values (`502 weather_unavailable`) or missing
      samples (`502 weather_incomplete`).
- [ ] **M3.4** Extend checkpoint weather past 48 h for long trips; add
      `forecast_extended_for_checkpoints`; 422 beyond Open-Meteo's 16-day range.
- [ ] **M3.5** Mocked tests for multi-location responses, unit variants, missing hours, short
      arrays, batching concurrency, and long trips.

## M4 — Persistence + API

- [x] **M4.1** Implement `RouteAnalysis` (`AGENTS.md` §8) with UUID PK, client/request scoping,
      request summary, stored payload, recommendation snapshot, and timestamps.

      **Context (2026-11-04):** Implemented in `apps/api/models.py`.
      - UUID primary key (`default=uuid.uuid4`, not editable).
      - `client_id` (64, indexed), `request_hash` (64, indexed), `origin`/`destination` (255),
        UTC `departure_time`, `load_weight_lbs`, `sample_interval_miles` (10/25/50 choices).
      - `request_meta` and `response_payload` are required JSON objects (fail fast if a planner
        tries to persist an incomplete analysis).
      - `recommended_route_id` / `recommended_route_name` are nullable for the all-No-Travel case.
      - `total_distance_miles` / `total_duration_hours` are nullable floats.
      - `created_at = timezone.now`, indexed; `Meta.ordering = ["-created_at"]` for history.
      - Composite indexes `(client_id, request_hash, created_at)` (`ra_client_hash_created`) and
        `(client_id, created_at)` (`ra_client_created`) support the 1-hour reuse lookup and history
        list. Index names are explicit and ≤ 30 characters for cross-database compatibility.
      - Assumption: `client_id` is always supplied by the caller; the view layer applies the
        `"anonymous"` fallback per §5. The model does not hide that behavior.
      - Registered with `admin.site.register(RouteAnalysis)` for local inspection; no custom admin.

- [x] **M4.2** Create and apply the initial migration; run `manage.py check`.

      **Context (2026-11-04):** `apps/api/migrations/0001_initial.py` generated with
      `uv run python manage.py makemigrations api`; `uv run python manage.py migrate` and
      `uv run python manage.py check` pass. No hand edits to the generated migration.
      Added a minimal `[tool.ruff]` config (Python 3.15 target, isort, Django migrations excluded,
      single quotes to match the scaffold) and normalized the generated scaffold formatting so
      `ruff check .` and `ruff format --check .` pass. `manage.py` and `config/urls.py` changed only
      because of that one-time formatting.

- [~] **M4.3** Add model tests (UUID PK, nullable recommendation, ordering, JSON round-trip, index
      shape) in `apps/api/tests/test_models.py`. **Deferred by user direction.**

      **Context (2026-11-04):** Tests were drafted and removed at the user's request; no tests are
      checked in. The `apps/api/tests/` package remains empty for the later testing pass. Do not
      recreate these tests until that pass begins.

- [ ] **M4.4** Add `services/analysis_cache.py` (or equivalent): canonical normalization,
      `sha256` hash including `PLAN_CACHE_VERSION` and truck profile version, 1-hour lookup scoped
      by `client_id`, `reused` flag.
- [ ] **M4.5** Add request/response serializers matching §5 exactly; validate UTC ISO timestamps,
      past departures, 16-day limit, origin != destination, interval whitelist, load bounds.
- [ ] **M4.6** Add `POST /api/v1/routes/plan/` (thin view; delegate to planner), `GET
      /api/v1/analyses/` (newest first, limit 50), `GET /api/v1/analyses/{id}/` (client-scoped).
- [ ] **M4.7** Add the §5 error envelope and status mapping; never leak keys, raw bodies, or stack
      traces. Failed computation must not create a row.
- [ ] **M4.8** Set `authentication_classes = []`, `AllowAny` on public views; keep CSRF for admin;
      apply anonymous throttling.
- [ ] **M4.9** Tests: reuse within 1 h, new row after 1 h, client scoping, failed computation not
      saved, history ordering/limit, 404 for another client's analysis, validation matrix, 1/2/3
      routes, upstream error mapping.
- [ ] **M4.10** Review whether `client_id` needs the individual `db_index` now that
      `(client_id, ...)` composite indexes exist; keep only if it earns its write cost.

## M8 — Backend polish

- [ ] **M8.1** Write `backend/README.md` (setup, env, commands, architecture links).
- [ ] **M8.2** Add `.env.example` with every setting from `AGENTS.md` §10 (no real keys).
- [ ] **M8.3** Add request-ID middleware/logging; redact secrets and upstream bodies.
- [ ] **M8.4** Verify `ruff check .` and `ruff format --check .` are clean.
- [ ] **M8.5** Confirm no Mapbox access token is referenced from frontend or committed files.

## M9 — Backend deploy

- [ ] **M9.1** Choose hosting and database; confirm Python 3.15 support (§14.5).
- [ ] **M9.2** Add `gunicorn`, production settings, `ALLOWED_HOSTS`, `CORS_ALLOWED_ORIGINS`.
- [ ] **M9.3** Run migrations on the host and smoke-test `/api/v1/health/`, `/plan/`, history.
- [ ] **M9.4** Verify secrets are set through the host, not committed.

## Blockers and open questions

- [!] **Mapbox token scope** (§14.1): needs Directions + Geocoding scopes on a server-side secret
  token. Do not silently fall back to a car route without the restriction parameters and warning.
- [ ] **Truck profile** (§14.2): confirm 4114 × 2590 mm and the 30,000 lb tare. Only height, width,
  and gross weight can be sent to Mapbox; length and axle count cannot.
- [ ] **Reuse identity** (§14.3): confirm identical departure time is part of the cache key.
- [ ] **History privacy** (§14.4): confirm per-browser `X-Client-Id` scoping.
- [ ] **Production DB** (§14.5): SQLite vs Postgres once hosting is chosen.
- [ ] **Alternatives count** (§14.6): confirm fewer-than-3 routes with a warning is acceptable.
- [ ] **Restriction coverage** (§14.7): decide whether to warn on region gaps / heavy gross weight.

## Verification

```bash
cd backend
uv sync
uv run python manage.py check
uv run python manage.py makemigrations --check --dry-run
uv run ruff check .
uv run ruff format --check .
curl http://127.0.0.1:8000/api/v1/health/
```

Tests are deferred for now. When the testing pass starts, add `pytest` + `pytest-django`, restore
the test commands, and cover the M0.7/M4.3 checkboxes.

Acceptance for this phase: M0 health/CORS smoke check passes, `RouteAnalysis` migrates cleanly, and
every completed task above has a dated context note. No tests are required yet.
