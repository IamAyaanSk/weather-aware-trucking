# Weather-Aware Truck Routing — Backend

Django + DRF API that plans truck routes, samples weather along each corridor, scores risk, and
stores analyses for history and 1-hour reuse.

The full product contract lives in [`../AGENTS.md`](../AGENTS.md). Agent task tracking lives in
[`TODOS.md`](TODOS.md).

## Requirements

- Python **3.15**
- [uv](https://docs.astral.sh/uv/)
- SQLite for local development

## Quick start

```bash
cd backend
uv sync
cp .env.example .env
uv run python manage.py migrate
uv run python manage.py runserver
```

Check the API:

```bash
curl http://127.0.0.1:8000/api/v1/health/
# {"status": "ok"}
```

## Environment

Settings are loaded from `.env` via `python-dotenv` and read with `os.getenv`. Never commit `.env`
or real keys.

| Variable | Default | Purpose |
|---|---|---|
| `DJANGO_SECRET_KEY` | `dev-only-insecure-secret-key` | Django secret; set a real value in production. |
| `DJANGO_DEBUG` | `true` | Enables debug mode. |
| `DJANGO_ALLOWED_HOSTS` | `localhost,127.0.0.1` | Comma-separated allowed hosts. |
| `CORS_ALLOWED_ORIGINS` | `http://localhost:5173` | Comma-separated browser origins; `X-Client-Id` is allowed. |

The Mapbox Directions, truck-profile, Open-Meteo, and cache variables in `.env.example` are consumed
by later milestones. `MAPBOX_ACCESS_TOKEN` is a server-side secret used strictly for Mapbox Directions:
it must never be exposed to Vite and must never carry a `VITE_` prefix. Location search is performed
directly by the frontend using its own public token (`VITE_MAPBOX_PUBLIC_TOKEN`), so the backend handles
no geocoding.

## API

| Method | Path | Status |
|---|---|---|
| `GET` | `/api/v1/health/` | Implemented |
| `POST` | `/api/v1/routes/plan/` | Pending (M4) |
| `GET` | `/api/v1/analyses/` | Pending (M4) |
| `GET` | `/api/v1/analyses/{id}/` | Pending (M4) |

`RouteAnalysis` and its initial migration are implemented. Serializers, services, domain logic, and
plan/history endpoints are still pending.

## Commands

```bash
uv run python manage.py check
uv run python manage.py makemigrations --check --dry-run
uv run python manage.py migrate
uv run ruff check .
uv run ruff format --check .
```

Tests are intentionally deferred for now; see `TODOS.md` for the planned testing pass.
