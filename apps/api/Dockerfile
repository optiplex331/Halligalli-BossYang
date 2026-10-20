FROM astral/uv:python3.14-alpine

# Copy the project into the image
COPY ./uv.lock /app

# Disable development dependencies
ENV UV_NO_DEV=1

WORKDIR /app
RUN uv sync --locked

COPY ./src/halligalli_api /app/halligalli_api

CMD ["uvicorn", "halligalli_api.app:app", "--reload", "--port", "8000", "--host", "0.0.0.0"]
