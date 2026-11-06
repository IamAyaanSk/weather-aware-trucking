FROM ghcr.io/astral-sh/uv:debian-slim

WORKDIR /app

# Enable bytecode compilation, copy link mode, and allow managed python download
ENV UV_COMPILE_BYTECODE=1
ENV UV_LINK_MODE=copy
ENV UV_PYTHON_DOWNLOADS=true
ENV PYTHONUNBUFFERED=1

# Install project dependencies first (layer caching)
COPY pyproject.toml uv.lock .python-version /app/
RUN uv sync --frozen --no-dev --no-install-project

# Copy project source files
COPY . /app/

# Install application package
RUN uv sync --frozen --no-dev

# Place the virtualenv in PATH
ENV PATH="/app/.venv/bin:$PATH"

EXPOSE 8000

# Run database migrations and start gunicorn
CMD ["sh", "-c", "python manage.py migrate --noinput && gunicorn config.wsgi:application --bind 0.0.0.0:8000 --workers 3 --timeout 60 --access-logfile - --error-logfile -"]

