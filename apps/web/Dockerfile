FROM --platform=$BUILDPLATFORM node:24-alpine@sha256:06d7adf3e0ef61a13f1d28682726366f97a15aa1888c934d3ecec86c33918b53 AS build

WORKDIR /app

# Copy the project requirements into the image
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Install the project dependencies
RUN corepack enable &&\
    pnpm install --frozen-lockfile

COPY . .

RUN pnpm run build 

FROM nginx:1.30-alpine@sha256:c59d1f8b1e0e42da75be973424cd72e23f7f8adfb54e982f4d1cd0216a5a5576 AS production

COPY nginx.conf /etc/nginx/conf.d/default.conf

COPY --from=build /app/dist /usr/share/nginx/html