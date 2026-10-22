FROM astral/uv:python3.14-alpine AS build

WORKDIR /app

COPY uv.lock pyproject.toml ./

RUN uv sync --locked --no-install-project --no-dev

FROM python:3.14-alpine AS runtime

WORKDIR /app

COPY --from=build /app/.venv .venv

COPY ./src/halligalli_api halligalli_api

RUN addgroup -S api && adduser -S -G api api_user

USER api_user

ENV PATH="/app/.venv/bin:$PATH"

CMD ["uvicorn", "halligalli_api.app:app", "--ws-max-size", "4096", "--port", "8000", "--host", "0.0.0.0"]

