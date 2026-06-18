# Build stage: native modules (better-sqlite3) compile from source, which
# needs python3/make/g++. Kept out of the runtime image to stay slim.
FROM node:20-bookworm-slim AS build

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY backend/package*.json ./
RUN npm ci --omit=dev

# Runtime stage: slim image with the compiled node_modules copied in.
FROM node:20-bookworm-slim

RUN apt-get update && apt-get upgrade -y && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY --from=build /app/node_modules ./node_modules
COPY backend/ .
COPY frontend/ /frontend

# Ensure the data directory exists for the SQLite volume mount
RUN mkdir -p /data && chown node:node /data

USER node

EXPOSE 3000

CMD ["node", "server.js"]
