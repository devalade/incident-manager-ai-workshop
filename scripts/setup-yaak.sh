#!/usr/bin/env bash
set -euo pipefail

if ! command -v yaak >/dev/null 2>&1; then
  echo "Yaak CLI missing. Install: npm install -g @yaakapp/cli" >&2
  exit 1
fi

workspace_name="Incident Manager Workshop"
existing_id=$(yaak workspace list | awk -F ' - ' -v name="$workspace_name" '$2 == name { print $1; exit }')

if [ -n "$existing_id" ]; then
  echo "Workspace already exists: $existing_id"
  exit 0
fi

workspace_output=$(yaak workspace create --name "$workspace_name")
workspace_id=$(printf '%s\n' "$workspace_output" | awk '{ print $3 }')

yaak request create "$workspace_id" --name "Health" --method GET --url "http://localhost:3000/health"
yaak request create "$workspace_id" --name "List incidents" --method GET --url "http://localhost:3000/incidents"
yaak request create "$workspace_id" --json '{
  "name": "Create SEV1 incident",
  "method": "POST",
  "url": "http://localhost:3000/incidents",
  "bodyType": "application/json",
  "headers": [{ "name": "Content-Type", "value": "application/json", "enabled": true }],
  "body": { "text": "{\"title\":\"Checkout unavailable\",\"service\":\"checkout\",\"severity\":\"SEV1\"}" }
}'
yaak request create "$workspace_id" --name "Get incident 1" --method GET --url "http://localhost:3000/incidents/1"
yaak request create "$workspace_id" --name "Manual escalation" --method POST --url "http://localhost:3000/incidents/1/escalate"
yaak request create "$workspace_id" --name "Incident dashboard" --method GET --url "http://localhost:3000/dashboard"

echo "Workspace created: $workspace_id"
echo "Run all requests: yaak send $workspace_id --fail-fast"
