FROM node:25-bookworm-slim@sha256:81db02c4b671288a03915da9534dbd54f96d0e7c24d80ccc54f5b36b2e684370 AS build

WORKDIR /workspace

ARG HALLIGALLI_RELEASE_VERSION=local
ARG HALLIGALLI_RELEASE_COMMIT=development

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json apps/web/package.json
RUN corepack enable && pnpm install --frozen-lockfile

COPY apps/web apps/web
RUN pnpm --dir apps/web run build \
  && printf '{"version":"%s","commit":"%s"}\n' "$HALLIGALLI_RELEASE_VERSION" "$HALLIGALLI_RELEASE_COMMIT" \
  > apps/web/dist/internal-identity.json

FROM nginxinc/nginx-unprivileged:1.30-alpine@sha256:4714e0b1b2577eaa1a6131d07c958b67f0eb68e6d0521e90c6e5287db8cf0bc5

# Alpine fixes often land before a new base digest; the Trivy gate relies on
# this upgrade, and the published image is still pinned by its own digest.
USER root
RUN apk upgrade --no-cache
USER 101

COPY apps/web/nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /workspace/apps/web/dist /usr/share/nginx/html

EXPOSE 8080
