# syntax=docker/dockerfile:1

FROM node:24-alpine AS base

WORKDIR /app
RUN npm install -g pnpm@11.0.9

FROM base AS deps

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY server/package.json ./server/package.json
RUN pnpm install --frozen-lockfile

FROM deps AS build

COPY . .
RUN pnpm run build

FROM base AS prod-deps

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY server/package.json ./server/package.json
RUN pnpm install --frozen-lockfile --prod

FROM node:24-alpine AS runtime-base

ARG APP_VERSION=local
ARG COMMIT_SHA=unknown

RUN apk upgrade --no-cache \
  && rm -rf \
    /opt/yarn-v* \
    /usr/local/bin/corepack \
    /usr/local/bin/npm \
    /usr/local/bin/npx \
    /usr/local/bin/yarn \
    /usr/local/bin/yarnpkg \
    /usr/local/lib/node_modules/corepack \
    /usr/local/lib/node_modules/npm

ENV NODE_ENV=production
ENV PORT=3001
ENV APP_VERSION=$APP_VERSION
ENV COMMIT_SHA=$COMMIT_SHA

WORKDIR /app

COPY --from=prod-deps --chown=node:node /app/node_modules ./node_modules
COPY --chown=node:node package.json ./

USER node
EXPOSE 3001

CMD ["node", "dist/server/index.js"]

FROM runtime-base AS standalone

COPY --from=build --chown=node:node /app/dist ./dist

FROM runtime-base AS azure-backend

COPY --from=build --chown=node:node /app/dist/server ./dist/server
COPY --from=build --chown=node:node /app/dist/src ./dist/src
