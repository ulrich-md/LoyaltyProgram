#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
if ! docker container inspect loyalty-postgres >/dev/null 2>&1; then
 docker run -d --name loyalty-postgres -e POSTGRES_USER=loyalty -e POSTGRES_PASSWORD=local-demo-only -e POSTGRES_DB=loyalty -p 127.0.0.1:54322:5432 -v loyalty-data:/var/lib/postgresql/data postgres:17-alpine
else docker start loyalty-postgres >/dev/null; fi
for i in {1..30}; do if docker exec loyalty-postgres pg_isready -h 127.0.0.1 -U loyalty >/dev/null; then break; fi; sleep 1; done
if ! docker exec loyalty-postgres psql -U loyalty -d loyalty -Atc "select to_regclass('public.businesses')" | rg -q businesses; then
 docker exec -i loyalty-postgres psql -v ON_ERROR_STOP=1 -U loyalty -d loyalty < supabase/migrations/001_loyalty.sql
 docker exec -i loyalty-postgres psql -v ON_ERROR_STOP=1 -U loyalty -d loyalty < supabase/seed.sql
fi

if ! docker exec loyalty-postgres psql -U loyalty -d loyalty -Atc "select to_regclass('public.rate_buckets')" | rg -q rate_buckets; then
 docker exec -i loyalty-postgres psql -v ON_ERROR_STOP=1 -U loyalty -d loyalty < supabase/migrations/002_operations.sql
fi
