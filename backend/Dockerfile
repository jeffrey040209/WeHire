# Local development image. Dependencies live outside the source bind mounts.
FROM python:3.12-slim-bookworm
COPY --from=ghcr.io/astral-sh/uv:0.13.8 /uv /uvx /usr/local/bin/

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    UV_PROJECT_ENVIRONMENT=/opt/venv \
    UV_PYTHON_DOWNLOADS=never \
    UV_LINK_MODE=copy \
    PATH="/opt/venv/bin:$PATH"

WORKDIR /workspace/backend
COPY pyproject.toml uv.lock ./
RUN uv sync --locked
COPY . .

EXPOSE 8012
CMD ["uv", "run", "--locked", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8012", "--reload", "--reload-dir", "app", "--no-proxy-headers"]
