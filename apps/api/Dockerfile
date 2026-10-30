FROM astral/uv:python3.14-alpine@sha256:a069b57ec30ef94da43700a7332b162a13adb0b8a1cfba4e0b62c1a9727153c4 AS build

WORKDIR /app

COPY uv.lock pyproject.toml ./

RUN uv sync --locked --no-install-project --no-dev

FROM python:3.14-alpine@sha256:01ddf82b43479870a7ea87037b7d68472bef12cc244941843c26bb75bf9a9b04 AS runtime

WORKDIR /app

COPY --from=build /app/.venv .venv

RUN python -m pip uninstall -y pip

COPY ./src/halligalli_api halligalli_api

RUN addgroup -S api && adduser -S -G api api_user

USER api_user

ENV PATH="/app/.venv/bin:$PATH"

CMD ["uvicorn", "halligalli_api.app:app", "--ws-max-size", "4096", "--port", "8000", "--host", "0.0.0.0"]

