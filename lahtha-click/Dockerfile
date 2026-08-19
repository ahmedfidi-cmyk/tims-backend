# Production image for the lahtha-click backend. Multi-stage: install + build
# with full devDependencies, then copy only the compiled output + prod deps
# into a slim runtime image.

FROM node:20-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
COPY --from=build /app/migrations ./migrations
COPY --from=build /app/migrate-mongo-config.cjs ./migrate-mongo-config.cjs

EXPOSE 3000
# Run pending migrations, then start the server. On most hosts (Railway,
# Render, Fly.io) PORT is injected at runtime and read via src/config.
CMD ["sh", "-c", "npm run migrate:up && node dist/server.js"]
