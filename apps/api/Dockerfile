FROM ghcr.io/astral-sh/uv:python3.14-bookworm-slim AS build

WORKDIR /app

COPY apps/api/pyproject.toml apps/api/uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project

COPY apps/api/src ./src

ARG HALLIGALLI_RELEASE_VERSION=local
ARG HALLIGALLI_RELEASE_COMMIT=development
RUN python -c 'import json, sys; print(json.dumps({"version": sys.argv[1], "commit": sys.argv[2]}, separators=(",", ":")))' "$HALLIGALLI_RELEASE_VERSION" "$HALLIGALLI_RELEASE_COMMIT" > /app/src/halligalli_api/release-identity.json

FROM python:3.14-slim-bookworm

WORKDIR /app

ENV PATH=/app/.venv/bin:$PATH \
    PYTHONPATH=/app/src \
    PYTHONDONTWRITEBYTECODE=1

COPY --from=build /app/.venv /app/.venv
COPY --from=build /app/src /app/src

RUN groupadd --gid 10001 halligalli \
  && useradd --uid 10001 --gid 10001 --no-create-home --shell /usr/sbin/nologin halligalli

USER 10001:10001
EXPOSE 8000
CMD ["uvicorn", "halligalli_api.app:app", "--host", "0.0.0.0", "--port", "8000"]
