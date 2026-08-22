#!/usr/bin/env bash
set -euo pipefail

database_url="${DATABASE_URL:-postgresql://localhost:5432/incident_manager_workshop}"
psql "$database_url" -v ON_ERROR_STOP=1 -c 'TRUNCATE TABLE "incidentEvent", notification, incident, "maintenanceWindow", service, "onCall" RESTART IDENTITY CASCADE' >/dev/null

echo "PostgreSQL workshop data reset"
