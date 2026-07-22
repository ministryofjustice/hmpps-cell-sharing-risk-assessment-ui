#!/usr/bin/env bash
#
# Self-seed a few example CSRA reviews into the locally running (docker-compose) stack, so the
# dashboard tiles and prisoner pages show real data. The CSRA database starts empty.
#
# Seeds two standard and two high-risk prisoners on the stubbed MDI roll. Each review is created
# in two calls: start an initial assessment, then submit its final rating. See
# docs/running-locally.md for the full walkthrough.
#
# Usage:
#   docker compose up          # wait until the API is healthy
#   ./scripts/seed-csra-reviews.sh
#
# Requires: curl, jq. Override any of these if your ports/prison differ:
#   AUTH_URL   (default http://localhost:8080/auth)
#   API_URL    (default http://localhost:8090)
#   CLIENT_ID  (default hmpps-cell-sharing-risk-assessment-ui-system)
#   SECRET     (default clientsecret)
#   PRISON     (default MDI)

set -euo pipefail

AUTH_URL=${AUTH_URL:-http://localhost:8080/auth}
API_URL=${API_URL:-http://localhost:8090}
CLIENT_ID=${CLIENT_ID:-hmpps-cell-sharing-risk-assessment-ui-system}
SECRET=${SECRET:-clientsecret}
PRISON=${PRISON:-MDI}

command -v jq >/dev/null 2>&1 || { echo "This script needs 'jq' installed." >&2; exit 1; }

echo "Requesting a client-credentials token from $AUTH_URL ..."
TOKEN=$(curl -s -u "${CLIENT_ID}:${SECRET}" \
  -X POST "${AUTH_URL}/oauth/token?grant_type=client_credentials" | jq -r '.access_token // empty')
if [ -z "$TOKEN" ]; then
  echo "Failed to get a token. Is the stack up (docker compose up) and auth seeded?" >&2
  exit 1
fi

# seed <prisoner> <final-stage-json-body>
seed() {
  local prisoner=$1 body=$2 id
  id=$(curl -s -X POST "${API_URL}/csra-review/prisoner/${prisoner}/assessment" \
        -H "Authorization: Bearer ${TOKEN}" | jq -r '.reviewId // empty')
  if [ -z "$id" ]; then
    echo "  ${prisoner}: could not start an assessment (already in progress?)" >&2
    return 1
  fi
  curl -s -X PUT "${API_URL}/csra-review/prisoner/${prisoner}/assessment/${id}/final" \
    -H "Authorization: Bearer ${TOKEN}" -H "Content-Type: application/json" \
    -d "$body" | jq -c '{prisonerNumber, status, rating, nextReviewDate}'
}

echo "Seeding example CSRA reviews on ${PRISON} ..."

# Standard risk (can share a cell)
seed A1234BC "{\"rating\":\"STANDARD\",\"prisonId\":\"${PRISON}\",\"assessmentComment\":\"PNC and PER checked. No concerns about sharing a cell.\"}"
seed A2345CD "{\"rating\":\"STANDARD\",\"prisonId\":\"${PRISON}\",\"assessmentComment\":\"Seen by healthcare, no increased risk identified.\"}"

# High risk – general (cannot share with anyone). A high rating sets a next review date 12 months on.
seed A3456DE "{\"rating\":\"HIGH_GENERAL\",\"prisonId\":\"${PRISON}\",\"assessmentComment\":\"Evidence of repeated violence in custody. Cannot share.\",\"offenceRepeatedViolence\":true}"

# High risk – specific (can share only with certain prisoners). riskTo lists who they are a risk to.
seed A4567EF "{\"rating\":\"HIGH_SPECIFIC\",\"prisonId\":\"${PRISON}\",\"assessmentComment\":\"Risk to specific groups only.\",\"riskTo\":[{\"category\":\"GANG_MEMBERS\",\"details\":\"Rival gang affiliation.\"}]}"

echo "Rating summary for ${PRISON}:"
curl -s "${API_URL}/csra-review/prison/${PRISON}/rating-summary" \
  -H "Authorization: Bearer ${TOKEN}" | jq .
