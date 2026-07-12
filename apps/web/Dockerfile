FROM node:24-bookworm-slim AS build

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

FROM nginxinc/nginx-unprivileged:1.27-alpine

COPY apps/web/nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /workspace/apps/web/dist /usr/share/nginx/html

EXPOSE 8080
