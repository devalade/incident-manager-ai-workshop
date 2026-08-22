#!/usr/bin/env bash
set -euo pipefail

test_database_name="${TEST_DATABASE_NAME:-incident_manager_workshop_test}"
test_database_url="${TEST_DATABASE_URL:-postgresql://localhost:5432/$test_database_name}"

if ! psql "$test_database_url" -Atc 'select 1' >/dev/null 2>&1; then
  createdb "$test_database_name"
fi

DATABASE_URL="$test_database_url" npm run db:init >/dev/null
DATABASE_URL="$test_database_url" npm run db:reset >/dev/null
DATABASE_URL="$test_database_url" RUN_ENDPOINT_TESTS=1 npm test -- --run test/endpoints.test.ts
