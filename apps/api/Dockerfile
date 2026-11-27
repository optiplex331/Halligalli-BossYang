FROM astral/uv:python3.14-alpine@sha256:4ce2a2ef69130ffb97688c8446ae771415035406355fbcb7932c59a535f82888 AS build

WORKDIR /app

COPY uv.lock pyproject.toml ./

RUN uv sync --locked --no-install-project --no-dev

FROM python:3.15-alpine@sha256:0f9552bb28711333da16915ec146f5e6bb44a7fdac9ced15dc17c2e0206346dd AS runtime

WORKDIR /app

COPY --from=build /app/.venv .venv

RUN python -m pip uninstall -y pip

COPY ./src/halligalli_api halligalli_api

RUN addgroup -S api && adduser -S -G api api_user

USER api_user

ENV PATH="/app/.venv/bin:$PATH"

CMD ["uvicorn", "halligalli_api.app:app", "--ws-max-size", "4096", "--port", "8000", "--host", "0.0.0.0"]

