FROM astral/uv:python3.14-alpine

WORKDIR /app

RUN addgroup -S api && adduser -S -G api api_user

# Copy the project requirements into the image
COPY uv.lock pyproject.toml ./

RUN uv sync --locked --no-install-project --no-dev

COPY ./src/halligalli_api halligalli_api

USER api_user

ENV PATH="/app/.venv/bin:$PATH"

CMD ["uvicorn", "halligalli_api.app:app", "--ws-max-size", "4096", "--port", "8000", "--host", "0.0.0.0"]

