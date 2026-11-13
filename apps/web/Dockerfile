FROM --platform=$BUILDPLATFORM node:24-alpine@sha256:06d7adf3e0ef61a13f1d28682726366f97a15aa1888c934d3ecec86c33918b53 AS build

WORKDIR /app

# Copy the project requirements into the image
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Install the project dependencies
RUN corepack enable &&\
    pnpm install --frozen-lockfile

COPY . .

RUN pnpm run build 

FROM nginx:1.31-alpine@sha256:713fc2ebfd92e8217db451477182ee91944b123d2b1ee9fd5a8c6e91ca6c3a11 AS production

COPY nginx.conf /etc/nginx/conf.d/default.conf

COPY --from=build /app/dist /usr/share/nginx/html