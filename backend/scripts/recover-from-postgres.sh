#!/usr/bin/env bash
# One-shot recovery: re-import Season 1 data from the preserved postgres_data
# volume into the live SQLite database, using the same migrate()+auto-import
# path the app runs at startup. Safe to re-run. Never touches the PG volume.
#
# Run from the compose directory (where docker-compose.yml lives):
#   bash backend/scripts/recover-from-postgres.sh
# Override autodetected volumes with PG_VOL=... SQ_VOL=...; FORCE=1 to import
# even if the current SQLite already has games (they are backed up first).
set -euo pipefail

[ -f docker-compose.yml ] || { echo "ERROR: run from the directory containing docker-compose.yml"; exit 1; }

PG_VOL="${PG_VOL:-$(docker volume ls --format '{{.Name}}' | grep -E '_postgres_data$' || true)}"
SQ_VOL="${SQ_VOL:-$(docker volume ls --format '{{.Name}}' | grep -E '_sqlite_data$' || true)}"
[ "$(printf '%s' "$PG_VOL" | grep -c .)" = "1" ] || { echo "ERROR: could not uniquely find the postgres volume (got: '$PG_VOL'). Set PG_VOL=..."; exit 1; }
[ "$(printf '%s' "$SQ_VOL" | grep -c .)" = "1" ] || { echo "ERROR: could not uniquely find the sqlite volume (got: '$SQ_VOL'). Set SQ_VOL=..."; exit 1; }

PW="changeme"
[ -f .env ] && PW="$(grep -E '^DB_PASSWORD=' .env | cut -d= -f2- || true)"
PW="${PW:-changeme}"
IMAGE="$(awk '/image:.*dominion-tracker/{print $2; exit}' docker-compose.yml)"
IMAGE="${IMAGE:-wwelsh/dominion-tracker:latest}"

echo "==> PG volume:    $PG_VOL"
echo "==> SQLite volume: $SQ_VOL"
echo "==> Image:        $IMAGE"

cleanup() {
  docker rm -f dt-recover  >/dev/null 2>&1 || true
  docker rm -f pg-recover  >/dev/null 2>&1 || true
  docker network rm recover-net >/dev/null 2>&1 || true
}
trap cleanup EXIT

echo "==> Stopping backend so nothing writes to SQLite during recovery"
docker compose stop backend >/dev/null 2>&1 || true

echo "==> Starting temporary Postgres on the preserved volume"
docker network create recover-net >/dev/null 2>&1 || true
docker rm -f pg-recover >/dev/null 2>&1 || true
docker run -d --name pg-recover --network recover-net \
  -v "$PG_VOL":/var/lib/postgresql/data postgres:16-alpine >/dev/null

printf "==> Waiting for Postgres"
for _ in $(seq 1 30); do
  docker exec pg-recover pg_isready -U postgres >/dev/null 2>&1 && { echo " ready"; break; }
  printf "."; sleep 1
done

PG_GAMES="$(docker exec pg-recover psql -U postgres -d dominion_tracker -tAc 'SELECT count(*) FROM games' 2>/dev/null | tr -d '[:space:]' || echo 0)"
PG_PLAYERS="$(docker exec pg-recover psql -U postgres -d dominion_tracker -tAc 'SELECT count(*) FROM players' 2>/dev/null | tr -d '[:space:]' || echo 0)"
echo "==> Postgres contains: players=$PG_PLAYERS games=$PG_GAMES"
if [ "${PG_GAMES:-0}" -lt 1 ]; then
  echo "ERROR: no games found in Postgres — nothing to recover. No changes made."
  exit 1
fi

SQ_GAMES="$(docker run --rm -v "$SQ_VOL":/data "$IMAGE" node -e "try{const D=require('better-sqlite3');const d=new D('/data/dominion.db',{readonly:true});process.stdout.write(String(d.prepare('SELECT count(*) c FROM games').get().c))}catch(e){process.stdout.write('0')}" 2>/dev/null || echo 0)"
echo "==> Current SQLite contains: games=$SQ_GAMES"
if [ "${SQ_GAMES:-0}" -gt 0 ] && [ "${FORCE:-0}" != "1" ]; then
  echo "ABORT: the live SQLite already has $SQ_GAMES game(s) created after the deploy."
  echo "       Re-importing would replace them (a backup is taken regardless)."
  echo "       Re-run with FORCE=1 to proceed."
  exit 1
fi

echo "==> Backing up the current SQLite file"
docker run --rm -v "$SQ_VOL":/data "$IMAGE" \
  sh -c 'test -f /data/dominion.db && cp -v /data/dominion.db "/data/dominion.db.prerecover.$(date +%s).bak" || echo "(no existing db file)"'

import_once() {
  docker rm -f dt-recover >/dev/null 2>&1 || true
  docker run -d --name dt-recover --network recover-net -v "$SQ_VOL":/data \
    -e SQLITE_PATH=/data/dominion.db \
    -e DB_HOST=pg-recover -e DB_PORT=5432 -e DB_NAME=dominion_tracker \
    -e DB_USER=postgres -e DB_PASSWORD="$1" \
    "$IMAGE" >/dev/null
  printf "==> Importing (migrate + auto-import)"
  for _ in $(seq 1 60); do
    local logs; logs="$(docker logs dt-recover 2>&1 || true)"
    echo "$logs" | grep -q 'Import complete'  && { echo " done"; echo "$logs" | grep 'Import complete'; docker rm -f dt-recover >/dev/null 2>&1; return 0; }
    echo "$logs" | grep -q 'Auto-import failed' && { echo " failed"; docker rm -f dt-recover >/dev/null 2>&1; return 1; }
    printf "."; sleep 1
  done
  echo " timed out"; docker logs dt-recover 2>&1 | tail -20; docker rm -f dt-recover >/dev/null 2>&1; return 1
}

if ! import_once "$PW"; then
  echo "==> Retry: resetting the postgres password via local socket, then re-importing"
  docker exec pg-recover psql -U postgres -c "ALTER USER postgres PASSWORD 'changeme';" >/dev/null
  import_once "changeme"
fi

echo "==> Starting backend"
docker compose up -d backend >/dev/null
sleep 3
echo "==> Backend logs:"
docker compose logs --tail=15 backend || true
echo "==> RECOVERY COMPLETE — load the site and verify Season 1 data is present."
