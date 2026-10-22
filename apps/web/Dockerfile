FROM --platform=$BUILDPLATFORM node:24-alpine AS build

WORKDIR /app

# Copy the project requirements into the image
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Install the project dependencies
RUN corepack enable &&\
    pnpm install --frozen-lockfile

COPY . .

RUN pnpm run build 

FROM nginx:alpine AS production

COPY nginx.conf /etc/nginx/conf.d/default.conf

COPY --from=build /app/dist /usr/share/nginx/html