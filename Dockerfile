# syntax=docker/dockerfile:1

FROM node:22.13.0-alpine AS base

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

FROM node:22.13.0-alpine AS runtime

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
COPY --from=prod-deps --chown=node:node /app/server/node_modules ./server/node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --chown=node:node package.json ./
COPY --chown=node:node src/game ./src/game
COPY --chown=node:node server/package.json ./server/package.json
COPY --chown=node:node server/*.js ./server/

USER node
EXPOSE 3001

CMD ["node", "server/index.js"]
