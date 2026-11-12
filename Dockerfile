# syntax=docker/dockerfile:1.7
# The production image: `next build`, then `next start` on port 3000 as a non-root user.
# In production the reverse proxy sends /api/v1 and /actuator/health to the API; the rewrites in next.config.mjs
# (to API_PROXY_TARGET) are only a fallback.

# ---- Build -------------------------------------------------------------------
FROM node:20-alpine AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
# NEXT_PUBLIC_* values are fixed into the bundle at build time.
ARG NEXT_PUBLIC_API_BASE_URL=/api/v1
ARG NEXT_PUBLIC_APP_ENV=production
ARG NEXT_PUBLIC_IDLE_TIMEOUT_MINUTES=
ARG NEXT_PUBLIC_SUPPORT_EMAIL=
ARG NEXT_PUBLIC_SUPPORT_PHONE=
ARG API_PROXY_TARGET=http://chama-api:8080
ENV NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL \
    NEXT_PUBLIC_APP_ENV=$NEXT_PUBLIC_APP_ENV \
    NEXT_PUBLIC_IDLE_TIMEOUT_MINUTES=$NEXT_PUBLIC_IDLE_TIMEOUT_MINUTES \
    NEXT_PUBLIC_SUPPORT_EMAIL=$NEXT_PUBLIC_SUPPORT_EMAIL \
    NEXT_PUBLIC_SUPPORT_PHONE=$NEXT_PUBLIC_SUPPORT_PHONE \
    API_PROXY_TARGET=$API_PROXY_TARGET \
    NODE_OPTIONS=--max-old-space-size=1536
RUN npm run build && npm prune --omit=dev

# ---- Runtime -----------------------------------------------------------------
FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1

# next.config.mjs reads package.json at start-up (the version in the sign-in footer).
COPY --from=build /app/package.json /app/next.config.mjs ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/public ./public
COPY --from=build /app/.next ./.next

USER node
EXPOSE 3000
CMD ["node_modules/.bin/next", "start", "-p", "3000", "-H", "0.0.0.0"]
