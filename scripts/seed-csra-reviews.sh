#!/usr/bin/env bash
#
# Self-seed a few example CSRA reviews into the locally running (docker-compose) stack, so the
# dashboard tiles and prisoner pages show real data. The CSRA database starts empty.
#
# Seeds two standard and two high-risk prisoners on the stubbed MDI roll, then adds CSR reviews on
# top of those ratings. Everything is created in two calls: start (which needs a prison), then
# submit the final rating. See docs/running-locally.md for the full walkthrough.
#
# Assessments and reviews are separate journeys with separate endpoints. A prisoner may only have
# one CSRA in progress at a time, so a review can only be started once their assessment is complete
# — which is why the reviews are seeded after the assessments below, not alongside them.
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
  local prisoner=$1 body=$2 id started
  # The start call needs a prison: it is what puts the draft on that prison's worklist.
  started=$(curl -s -X POST "${API_URL}/csra-review/prisoner/${prisoner}/assessment" \
        -H "Authorization: Bearer ${TOKEN}" -H "Content-Type: application/json" \
        -d "{\"prisonId\":\"${PRISON}\"}")
  id=$(echo "$started" | jq -r '.assessmentId // empty')
  if [ -z "$id" ]; then
    echo "  ${prisoner}: could not start an assessment. The API said:" >&2
    echo "    ${started}" >&2
    return 1
  fi
  curl -s -X PUT "${API_URL}/csra-review/prisoner/${prisoner}/assessment/${id}/final" \
    -H "Authorization: Bearer ${TOKEN}" -H "Content-Type: application/json" \
    -d "$body" | jq -c '{prisonerNumber, status, rating, nextReviewDate}'
}

echo "Seeding example CSRA assessments on ${PRISON} ..."

# Each seed is allowed to fail without taking the script down: on a re-run the prisoner left with a
# review in progress below will 409, and the rest should still be seeded. The API's response is
# printed either way, so a genuine failure is not swallowed silently.

# Standard risk (can share a cell)
seed A1234BC "{\"rating\":\"STANDARD\",\"prisonId\":\"${PRISON}\",\"assessmentComment\":\"PNC and PER checked. No concerns about sharing a cell.\"}" || true
seed A2345CD "{\"rating\":\"STANDARD\",\"prisonId\":\"${PRISON}\",\"assessmentComment\":\"Seen by healthcare, no increased risk identified.\"}" || true

# High risk – general (cannot share with anyone). A high rating sets a next review date 12 months on.
seed A3456DE "{\"rating\":\"HIGH_GENERAL\",\"prisonId\":\"${PRISON}\",\"assessmentComment\":\"Evidence of repeated violence in custody. Cannot share.\",\"offenceRepeatedViolence\":true}" || true

# High risk – specific (can share only with certain prisoners). riskTo lists who they are a risk to,
# and vulnerabilities who they are at risk from. Both are required for this rating: send NONE
# ("no identified risk to any of these groups") rather than an empty list if there is nothing to record.
seed A4567EF "{\"rating\":\"HIGH_SPECIFIC\",\"prisonId\":\"${PRISON}\",\"assessmentComment\":\"Risk to specific groups only.\",\"riskTo\":[{\"category\":\"GANG_MEMBERS\",\"details\":\"Rival gang affiliation.\"}],\"vulnerabilities\":[{\"category\":\"NONE\"}]}" || true

echo
echo "Seeding CSR reviews on ${PRISON} ..."
echo "  (these need an API image built from MAPA-233 onwards; older images 404 on /review)"

# start_review <prisoner> -> prints the new review id, or fails loudly
start_review() {
  local prisoner=$1 started id
  started=$(curl -s -X POST "${API_URL}/csra-review/prisoner/${prisoner}/review" \
        -H "Authorization: Bearer ${TOKEN}" -H "Content-Type: application/json" \
        -d "{\"prisonId\":\"${PRISON}\"}")
  id=$(echo "$started" | jq -r '.reviewId // empty')
  if [ -z "$id" ]; then
    echo "  ${prisoner}: could not start a review. The API said:" >&2
    echo "    ${started}" >&2
    return 1
  fi
  echo "$id"
}

# seed_review <prisoner> <final-stage-json-body>
seed_review() {
  local prisoner=$1 body=$2 id
  id=$(start_review "$prisoner") || return 1
  curl -s -X PUT "${API_URL}/csra-review/prisoner/${prisoner}/review/${id}/final" \
    -H "Authorization: Bearer ${TOKEN}" -H "Content-Type: application/json" \
    -d "$body" | jq -c '{prisonerNumber, status, rating, nextReviewDate}'
}

# A completed scheduled review confirming the existing high-risk rating. Unlike an assessment, a
# review takes the next review date the reviewer chose rather than computing twelve months on, so
# nextReviewDate is sent explicitly and must be in the future.
NEXT_REVIEW=$(date -v+12m +%Y-%m-%d 2>/dev/null || date -d '+12 months' +%Y-%m-%d)
seed_review A3456DE "{\"rating\":\"HIGH_GENERAL\",\"prisonId\":\"${PRISON}\",\"reviewComment\":\"Twelve-month review. Behaviour unchanged, high risk confirmed.\",\"reviewReason\":\"SCHEDULED_LONG_TERM_HIGH_RISK_REVIEW\",\"mdtChairName\":\"Sue Carter\",\"evidenceSources\":[{\"source\":\"OASYS\"},{\"source\":\"SECURITY_FILE\"}],\"offenceRepeatedViolence\":true,\"offenceRepeatedViolenceDetail\":\"Two adjudications for assault in the last year.\",\"nextReviewDate\":\"${NEXT_REVIEW}\"}" || true

# One review left unrated, so the 'Reviews in progress' worklist has something on it — started but
# not yet rated is exactly what that screen exists to show. This is also why a second run of this
# script reports a conflict for A1234BC: they now have a CSRA in progress, and only one is allowed.
if IN_PROGRESS=$(start_review A1234BC); then
  echo "  A1234BC: review ${IN_PROGRESS} left in progress"
fi

echo
echo "Rating summary for ${PRISON}:"
curl -s "${API_URL}/csra-review/prison/${PRISON}/rating-summary" \
  -H "Authorization: Bearer ${TOKEN}" | jq .

echo "Reviews in progress at ${PRISON}:"
curl -s "${API_URL}/csra-review/prison/${PRISON}/reviews-in-progress" \
  -H "Authorization: Bearer ${TOKEN}" | jq '{totalResults, content: [.content[] | {prisonerNumber, startedBy, startedOn}]}'
