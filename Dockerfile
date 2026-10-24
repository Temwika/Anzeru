# Multi-target build for the monorepo. Build one image per service:
#   docker build --target api -t anzelu-api .
#   docker build --target web -t anzelu-web --build-arg API_URL=http://api:4000 .
# The final stage (app) runs both in one container, for single-service hosts like Render.

FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/contracts/package.json packages/contracts/
COPY packages/finance/package.json packages/finance/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN npm ci

FROM deps AS build
# Next bakes rewrites in at build time, so the API address is a build argument.
ARG API_URL=http://api:4000
# Hosted demos set this to show the one-click demo roles on the sign-in page.
ARG SHOW_DEMO_LOGINS=false
ENV API_URL=$API_URL SHOW_DEMO_LOGINS=$SHOW_DEMO_LOGINS NEXT_TELEMETRY_DISABLED=1
COPY . .
RUN npm run build

FROM node:22-alpine AS api
WORKDIR /app
ENV NODE_ENV=production PORT=4000 DOCUMENT_STORAGE_DIR=/data/storage
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./
COPY --from=build /app/packages ./packages
COPY --from=build /app/apps/api/package.json ./apps/api/
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/apps/api/drizzle ./apps/api/drizzle
RUN mkdir -p /data/storage && chown -R node:node /data
USER node
WORKDIR /app/apps/api
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s CMD wget -qO- http://localhost:4000/health || exit 1
CMD ["node", "dist/main.js"]

FROM node:22-alpine AS web
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./
COPY --from=build /app/packages ./packages
COPY --from=build /app/apps/web ./apps/web
USER node
WORKDIR /app/apps/web
EXPOSE 3000
CMD ["npx", "next", "start", "-p", "3000"]

# API and web in one container: the API listens privately on 4000 and the web
# server takes the platform's $PORT, proxying /api/v1 to it.
# Build with --build-arg API_URL=http://localhost:4000 (render.yaml does this).
FROM node:22-alpine AS app
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 DOCUMENT_STORAGE_DIR=/data/storage
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./
COPY --from=build /app/packages ./packages
COPY --from=build /app/apps/api/package.json ./apps/api/
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/apps/api/drizzle ./apps/api/drizzle
COPY --from=build /app/apps/web ./apps/web
RUN mkdir -p /data/storage && chown -R node:node /data
USER node
EXPOSE 10000
CMD ["sh", "-c", "npx concurrently -k -n api,web \"cd apps/api && PORT=4000 node dist/main.js\" \"cd apps/web && npx next start -p ${PORT:-10000}\""]
