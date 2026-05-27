FROM node:20-bookworm-slim

RUN apt-get update && apt-get upgrade -y && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY backend/package*.json ./
RUN npm ci --omit=dev

COPY backend/ .
COPY frontend/ /frontend

# Ensure the data directory exists for the SQLite volume mount
RUN mkdir -p /data && chown node:node /data

USER node

EXPOSE 3000

CMD ["node", "server.js"]
