# Build stage: native modules (better-sqlite3) compile from source, which
# needs python3/make/g++. Kept out of the runtime image to stay slim.
FROM node:24-bookworm-slim AS build

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY backend/package*.json ./
RUN npm ci --omit=dev

# Runtime stage: slim image with the compiled node_modules copied in.
FROM node:24-bookworm-slim

RUN apt-get update && apt-get upgrade -y && rm -rf /var/lib/apt/lists/*

# Drop the bundled package managers from the runtime image. Dependencies are
# installed in the build stage, and CMD is plain `node`, so nothing here needs
# npm/yarn. Removing them also drops their vendored deps (tar, minimatch, ...)
# which Trivy's node-pkg scanner reports as image CVEs even though they are
# never executed — e.g. CVE-2026-59873 in npm's bundled tar 7.5.15.
# If you ever need to run a script in the container, use `node scripts/<x>.js`.
RUN rm -rf /usr/local/lib/node_modules/npm \
           /usr/local/lib/node_modules/corepack \
           /opt/yarn-v* \
           /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack \
           /usr/local/bin/yarn /usr/local/bin/yarnpkg

WORKDIR /app

COPY --from=build /app/node_modules ./node_modules
COPY backend/ .
COPY frontend/ /frontend

# Ensure the data directory exists for the SQLite volume mount
RUN mkdir -p /data && chown node:node /data

USER node

EXPOSE 3000

CMD ["node", "server.js"]
