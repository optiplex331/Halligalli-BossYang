FROM node:24-bookworm-slim@sha256:6f7b03f7c2c8e2e784dcf9295400527b9b1270fd37b7e9a7285cf83b6951452d AS build

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

FROM nginxinc/nginx-unprivileged:1.31-alpine@sha256:6a23acdfca2b9cfbcec61419e3f1426bcbedb91362f2f19306a8567423bb4612

# Alpine fixes often land before a new base digest; the Trivy gate relies on
# this upgrade, and the published image is still pinned by its own digest.
USER root
RUN apk upgrade --no-cache
USER 101

COPY apps/web/nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /workspace/apps/web/dist /usr/share/nginx/html

EXPOSE 8080
