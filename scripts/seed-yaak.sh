#!/usr/bin/env bash
set -euo pipefail

workspace_name="Incident Manager Workshop"
workspace_id=$(yaak workspace list | awk -F ' - ' -v name="$workspace_name" '$2 == name { print $1; exit }')

if [ -z "$workspace_id" ]; then
  echo "Run npm run yaak:setup first" >&2
  exit 1
fi

request_exists() {
  yaak request list "$workspace_id" | awk -F ' - ' -v name="$1" '{ sub(/^[A-Z]+ /, "", $2) } $2 == name { found=1 } END { exit !found }'
}

create_json_request() {
  local name="$1"
  local method="$2"
  local url="$3"
  local body="$4"
  if request_exists "$name"; then return; fi
  yaak request create "$workspace_id" --json "$(printf '{\"name\":\"%s\",\"method\":\"%s\",\"url\":\"%s\",\"bodyType\":\"application/json\",\"headers\":[{\"name\":\"Content-Type\",\"value\":\"application/json\",\"enabled\":true}],\"body\":{\"text\":%s}}' "$name" "$method" "$url" "$(printf '%s' "$body" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>process.stdout.write(JSON.stringify(s)))')")" >/dev/null
}

create_json_request "Seed 01 · Checkout SEV1" POST "http://localhost:3000/incidents" '{"title":"Checkout unavailable in Europe","service":"checkout","severity":"SEV1","tags":["customer-impact","eu"]}'
create_json_request "Seed 02 · Payments SEV2" POST "http://localhost:3000/incidents" '{"title":"Payment confirmations delayed","service":"payments","severity":"SEV2","tags":["latency"]}'
create_json_request "Seed 03 · Search SEV3" POST "http://localhost:3000/incidents" '{"title":"Search latency above threshold","service":"search","severity":"SEV3","tags":["latency","possible-duplicate"]}'
create_json_request "Seed 04 · Search duplicate" POST "http://localhost:3000/incidents" '{"title":"Slow search responses for mobile users","service":"search","severity":"SEV3","tags":["mobile","possible-duplicate"]}'
create_json_request "Seed 05 · Catalog SEV4" POST "http://localhost:3000/incidents" '{"title":"Product images intermittently missing","service":"catalog","severity":"SEV4","tags":["cosmetic"]}'
create_json_request "Seed 06 · Identity SEV2" POST "http://localhost:3000/incidents" '{"title":"Elevated login failures","service":"identity","severity":"SEV2","tags":["authentication"]}'
create_json_request "Seed 07 · Unknown service" POST "http://localhost:3000/incidents" '{"title":"Partner webhook delivery failures","service":"partner-webhooks","severity":"SEV2","tags":["external-dependency"]}'
create_json_request "Seed 08 · Maintenance" POST "http://localhost:3000/maintenance" '{"service":"catalog","startsAt":"2026-08-22T22:00:00Z","endsAt":"2026-08-23T01:00:00Z","reason":"Search index migration"}'
create_json_request "Seed 09 · Acknowledge payments" POST "http://localhost:3000/incidents/2/acknowledge" '{"actor":"alice"}'
create_json_request "Seed 10 · Assign identity" POST "http://localhost:3000/incidents/6/assign" '{"owner":"team-platform","actor":"incident-manager"}'
create_json_request "Seed 11 · Resolve catalog" POST "http://localhost:3000/incidents/5/resolve" '{"actor":"dave","resolution":"Image CDN cache refreshed"}'
create_json_request "Seed 12 · Note on checkout" POST "http://localhost:3000/incidents/1/notes" '{"actor":"incident-manager","text":"Customer support confirms impact in three countries"}'

curl --fail --silent --show-error --request POST http://localhost:3000/workshop/reset >/dev/null
echo "Sending seed requests to http://localhost:3000"
while read -r request_id; do
  yaak request send "$request_id" >/dev/null
done < <(yaak request list "$workspace_id" | awk -F ' - ' '$2 ~ /^[A-Z]+ Seed / { sub(/^[A-Z]+ /, "", $2); print $2 "|" $1 }' | sort | awk -F '|' '!seen[$1]++ { print $2 }')

echo "Seed complete: 7 incidents, 1 maintenance window, mixed lifecycle states"
