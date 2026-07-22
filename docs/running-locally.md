# Running locally with docker-compose

This is a quick guide to running the CSRA UI against the dockerised backing services, and
**self-seeding some example CSRA reviews** so the dashboard and prisoner pages show real data
(the CSRA database starts empty).

For the full local-dev setup (running the frontend on the host, the stubbed services, OAuth
clients) see the [README](../README.md#running-the-app-via-docker-compose).

## Start the stack

```bash
docker compose pull
docker compose up            # dependencies only (auth, API, Postgres, stubs, redis, localstack)
```

Wait until `cell-sharing-risk-assessment-api` is healthy:

```bash
curl -s http://localhost:8090/health/ping    # -> {"status":"UP"}
```

The dockerised `hmpps-auth` is seeded with the CSRA OAuth clients (see
`local-stack/auth-seed/`), and the API's downstream calls (prisoner-search, prison-api,
prison-register) are served by WireMock stubs. The stubbed prison is **`MDI`** with a roll of
five prisoners: `A1234BC`, `A2345CD`, `A3456DE`, `A4567EF`, `A5678FG`.

## Seeding example CSRA reviews

The CSRA database starts empty, so every prisoner shows as **No rating** until you create some
reviews. You can create them through the API's Swagger UI at
http://localhost:8090/swagger-ui/index.html, or with the curl commands below.

A completed CSRA review is created in two calls: **start** an initial assessment, then submit
its **final** rating. Both calls use a client-credentials token from the UI's system client
(`hmpps-cell-sharing-risk-assessment-ui-system`), which is seeded with `ROLE_CSRA_REVIEW__RW`.

### 1. Get a token

```bash
TOKEN=$(curl -s -u "hmpps-cell-sharing-risk-assessment-ui-system:clientsecret" \
  -X POST "http://localhost:8080/auth/oauth/token?grant_type=client_credentials" \
  | jq -r .access_token)
```

### 2. Seed a few reviews

Copy-paste this whole block. It seeds **two standard** and **two high-risk** prisoners on `MDI`.
The `start` call returns a `reviewId`; the `final` call sets the rating.

```bash
API=http://localhost:8090

seed() {                       # seed <prisoner> <rating> <comment-json-body>
  local prisoner=$1 body=$2
  local id
  id=$(curl -s -X POST "$API/csra-review/prisoner/$prisoner/assessment" \
        -H "Authorization: Bearer $TOKEN" | jq -r .reviewId)
  curl -s -X PUT "$API/csra-review/prisoner/$prisoner/assessment/$id/final" \
    -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
    -d "$body" | jq -c '{prisonerNumber, status, rating, nextReviewDate}'
}

# Standard risk (can share a cell)
seed A1234BC '{"rating":"STANDARD","prisonId":"MDI","assessmentComment":"PNC and PER checked. No concerns about sharing a cell."}'
seed A2345CD '{"rating":"STANDARD","prisonId":"MDI","assessmentComment":"Seen by healthcare, no increased risk identified."}'

# High risk – general (cannot share with anyone). A high rating sets a next review date 12 months on.
seed A3456DE '{"rating":"HIGH_GENERAL","prisonId":"MDI","assessmentComment":"Evidence of repeated violence in custody. Cannot share.","offenceRepeatedViolence":true}'

# High risk – specific (can share only with certain prisoners). riskTo lists who they are a risk to.
seed A4567EF '{"rating":"HIGH_SPECIFIC","prisonId":"MDI","assessmentComment":"Risk to specific groups only.","riskTo":[{"category":"GANG_MEMBERS","details":"Rival gang affiliation."}]}'
```

Expected output (the `nextReviewDate` is 12 months from today for high-risk ratings):

```
{"prisonerNumber":"A1234BC","status":"COMPLETE","rating":"STANDARD","nextReviewDate":null}
{"prisonerNumber":"A2345CD","status":"COMPLETE","rating":"STANDARD","nextReviewDate":null}
{"prisonerNumber":"A3456DE","status":"COMPLETE","rating":"HIGH_GENERAL","nextReviewDate":"..."}
{"prisonerNumber":"A4567EF","status":"COMPLETE","rating":"HIGH_SPECIFIC","nextReviewDate":"..."}
```

### 3. Check it worked

```bash
# Homepage tiles: expect total 5, noRating 1, highRisk 2, standardRisk 2
curl -s "$API/csra-review/prison/MDI/rating-summary" \
  -H "Authorization: Bearer $TOKEN" | jq .

# A single prisoner's current rating
curl -s "$API/csra-review/prisoner/A3456DE/current-rating" \
  -H "Authorization: Bearer $TOKEN" | jq '{status, rating, nextReviewDate, assessmentComment}'

# A prisoner's CSRA history
curl -s "$API/csra-review/prisoner/A4567EF/history" \
  -H "Authorization: Bearer $TOKEN" | jq '{summary, reviews: .content}'
```

In the UI, the dashboard tiles now show 2 high / 2 standard / 1 no-rating, and
`/prisoner/A3456DE` shows a completed high-risk CSRA.

### Ratings you can use

`STANDARD`, `HIGH_GENERAL`, `HIGH_SPECIFIC` (and `HIGH` for legacy NOMIS-style). Note a
"mandatory high-risk trigger" offence (`offenceMurderManslaughter`, `offenceAssistingSuicide`
or `offenceSexualAssault` set to `true`) forces the rating to `HIGH_GENERAL` — any other rating
returns 400.

### Two-stage assessment (optional)

The example above goes straight to a final rating. To mimic the real Day 1 / Day 2 journey,
submit a **provisional** rating first (same body shape) before the final one:

```bash
curl -s -X PUT "$API/csra-review/prisoner/A5678FG/assessment/$id/provisional" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"rating":"STANDARD","prisonId":"MDI","assessmentComment":"Day 1: PNC not yet checked."}'
```

The prisoner's current rating then shows as `PROVISIONAL` until the final stage is submitted.

## Resetting

Re-running the seed adds a **new** completed review each time (the latest one wins as the
current rating). To wipe all CSRA data and start clean, recreate the stack — this also re-runs
the auth client seed:

```bash
docker compose down -v
docker compose up
```
