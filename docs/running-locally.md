# Running locally with docker-compose

This is a quick guide to running the CSRA UI against the dockerised backing services, and
**self-seeding some example CSRA assessments and reviews** so the dashboard and prisoner pages show real data
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

## Seeding example CSRA data

The CSRA database starts empty, so every prisoner shows as **No rating** until you create some
assessments. The quickest way is the bundled script, which runs the curl commands below for you —
four assessments, a completed review on top of one of them, and one review left in progress so the
worklist has a row:

```bash
./scripts/seed-csra-reviews.sh
```

You can also create assessments and reviews through the API's Swagger UI at
http://localhost:8090/swagger-ui/index.html, or run the curl commands by hand as described below
to understand what the script does.

**Assessments and reviews are separate journeys with separate endpoints.** An initial assessment
is a prisoner's first CSRA; a CSR review revisits the rating an assessment (or an earlier review)
produced. Either is created in two calls: **start** — which takes the prison, and is what puts the
draft on that prison's worklist — then submit the **final** rating.

A prisoner may only have **one CSRA in progress at a time**, assessment or review, so a review can
only be started once their assessment is complete. That is why the script seeds all the assessments
before any of the reviews.

All calls use a client-credentials token from the UI's system client
(`hmpps-cell-sharing-risk-assessment-ui-system`), which is seeded with `ROLE_CSRA_REVIEW__RW`.

### 1. Get a token

```bash
TOKEN=$(curl -s -u "hmpps-cell-sharing-risk-assessment-ui-system:clientsecret" \
  -X POST "http://localhost:8080/auth/oauth/token?grant_type=client_credentials" \
  | jq -r .access_token)
```

### 2. Seed a few assessments

Copy-paste this whole block. It seeds **two standard** and **two high-risk** prisoners on `MDI`.
The `start` call takes the prison the assessment is being started at and returns an `assessmentId`;
the `final` call sets the rating.

```bash
API=http://localhost:8090

seed() {                       # seed <prisoner> <rating> <comment-json-body>
  local prisoner=$1 body=$2
  local id
  id=$(curl -s -X POST "$API/csra-review/prisoner/$prisoner/assessment" \
        -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
        -d '{"prisonId":"MDI"}' | jq -r .assessmentId)
  curl -s -X PUT "$API/csra-review/prisoner/$prisoner/assessment/$id/final" \
    -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
    -d "$body" | jq -c '{prisonerNumber, status, rating, nextReviewDate}'
}

# Standard risk (can share a cell)
seed A1234BC '{"rating":"STANDARD","prisonId":"MDI","assessmentComment":"PNC and PER checked. No concerns about sharing a cell."}'
seed A2345CD '{"rating":"STANDARD","prisonId":"MDI","assessmentComment":"Seen by healthcare, no increased risk identified."}'

# High risk – general (cannot share with anyone). A high rating sets a next review date 12 months on.
seed A3456DE '{"rating":"HIGH_GENERAL","prisonId":"MDI","assessmentComment":"Evidence of repeated violence in custody. Cannot share.","offenceRepeatedViolence":true}'

# High risk – specific (can share only with certain prisoners). riskTo lists who they are a risk to
# and vulnerabilities who they are at risk from. Both are required for this rating and rejected for
# any other; send the NONE category rather than an empty list if there is nothing to record.
seed A4567EF '{"rating":"HIGH_SPECIFIC","prisonId":"MDI","assessmentComment":"Risk to specific groups only.","riskTo":[{"category":"GANG_MEMBERS","details":"Rival gang affiliation."}],"vulnerabilities":[{"category":"NONE"}]}'
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
or `offenceSexualAssault` set to `true`) forces the rating to `HIGH_GENERAL` on an **assessment** —
any other rating returns 400. On a **review** the same trigger is advisory and any rating is
accepted, because a review revisits an existing rating with more context.

`HIGH_SPECIFIC` requires both `riskTo` and `vulnerabilities`, and every other rating rejects them.
Where there is nothing to record, send the exclusive `NONE` category — `[{"category":"NONE"}]` —
rather than an empty list, so "no identified risk" is distinguishable from "not answered". `NONE`
cannot be combined with any other category.

### Two-stage assessment (optional)

The example above goes straight to a final rating. To mimic the real Day 1 / Day 2 journey,
submit a **provisional** rating first (same body shape) before the final one:

```bash
curl -s -X PUT "$API/csra-review/prisoner/A5678FG/assessment/$id/provisional" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"rating":"STANDARD","prisonId":"MDI","assessmentComment":"Day 1: PNC not yet checked."}'
```

The prisoner's current rating then shows as `PROVISIONAL` until the final stage is submitted.

## Seeding CSR reviews

> **Needs a recent API image.** `docker-compose.yml` pulls
> `ghcr.io/ministryofjustice/hmpps-cell-sharing-risk-assessment-api:latest`, so the `/review`
> endpoints only exist once MAPA-233 has merged and a new image has been published. Against an older
> image these calls return 404 — run `docker compose pull` first, and if they still 404, the image
> predates the review journey.

A review revisits an existing rating, so seed the assessments above first. The endpoints mirror the
assessment ones under `/review` instead of `/assessment`, and the first stage is called **interim**
rather than provisional.

A review body carries more than an assessment's: a **reason**, the **evidence sources** consulted, the
name of the **multidisciplinary meeting chair**, and free-text **details on every question answered
yes**. Unlike an assessment, a review also carries the **next review date the reviewer chose** — it is
not computed as twelve months on — and that date must be in the future.

```bash
# A completed review confirming an existing high-risk rating
REVIEW=$(curl -s -X POST "$API/csra-review/prisoner/A3456DE/review" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"prisonId":"MDI"}' | jq -r .reviewId)

curl -s -X PUT "$API/csra-review/prisoner/A3456DE/review/$REVIEW/final" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{
    "rating": "HIGH_GENERAL",
    "prisonId": "MDI",
    "reviewComment": "Twelve-month review. Behaviour unchanged, high risk confirmed.",
    "reviewReason": "SCHEDULED_LONG_TERM_HIGH_RISK_REVIEW",
    "mdtChairName": "Sue Carter",
    "evidenceSources": [{"source":"OASYS"},{"source":"SECURITY_FILE"}],
    "offenceRepeatedViolence": true,
    "offenceRepeatedViolenceDetail": "Two adjudications for assault in the last year.",
    "nextReviewDate": "2027-08-14"
  }' | jq -c '{prisonerNumber, status, rating, nextReviewDate}'
```

To put a row on the **Reviews in progress** worklist, start a review and stop there — started but
not yet rated is exactly what that screen shows:

```bash
curl -s -X POST "$API/csra-review/prisoner/A1234BC/review" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"prisonId":"MDI"}' | jq -c '{reviewId}'

curl -s "$API/csra-review/prison/MDI/reviews-in-progress" \
  -H "Authorization: Bearer $TOKEN" | jq '{totalResults, content}'
```

Leaving that review in progress means a **second run of the seed script reports a conflict for
A1234BC** — they now have a CSRA in progress, and only one is allowed. The script continues past it
and seeds everything else.

### Review reasons and evidence sources

`reviewReason` is one of `SCHEDULED_LONG_TERM_HIGH_RISK_REVIEW`, `SHORT_TERM_HIGH_RISK_REVIEW`,
`NEW_OR_ADDITIONAL_INFORMATION`, `RECENT_CHANGE_IN_BEHAVIOUR_OR_THINKING`.

`evidenceSources` is a multi-select of named codes — `OASYS`, `PNC`, `DPS`, `SECURITY_FILE`,
`MAPPA_REVIEW` and others; see `CsraReviewEvidenceSource` for the full list, or the Swagger UI.
`OTHER` must carry `details` naming the source.

### Worklists come back empty?

Both in-progress worklists drop anyone prisoner-search no longer places at the prison, so the
stubbed bulk lookup has to return a `prisonId`. If you add a prisoner to
`local-stack/prisoner-search/mappings/post-prisoner-numbers.json` without one, they will be seeded
fine but never appear on a worklist.

## The rollout admin console

`/admin/prisons` controls which prisons have CSRA switched on in DPS, and the state of the two
NOMIS screens CSRA replaces (`OCDNOQUE` — Offender Assessment Questionnaires, and `OIDCAPPR` —
Classification Approval).

Signing in as `AUTH_USER` gets you there: `local-stack/auth-seed/V901__csra_local_clients.sql`
grants that account the `CSRA__ADMIN` user role, so the **Admin** tile appears on the landing page.
The same seed grants the UI's system client the roles the console's API calls need
(`ROLE_PRISONER_CSRA__ADMIN` on the CSRA API, and the prison-api splash-screen roles).

> **The dockerised API must be new enough.** The console calls `/active-agencies` on the CSRA API,
> added in MAPA-214. `ghcr.io/ministryofjustice/hmpps-cell-sharing-risk-assessment-api:latest` only
> has it once that change is merged and published — until then the page returns a 500 with
> `No static resource active-agencies/all` in the UI log. `docker compose pull` to pick up a newer
> image, or run the API yourself from the sibling repo and point `CSRA_API_URL` at it.

### What the NOMIS column shows locally

prison-api is a WireMock stub (`local-stack/prison-api`), seeded to show every state at once:

| Prison | NOMIS state | Why |
| --- | --- | --- |
| MDI | Blocked | blocked on both screens |
| LEI | Warning | warning on both screens |
| BXI | Normal | no condition on either screen |
| WWI | Mixed | blocked on `OCDNOQUE` only — the two disagree |

The stub is **read-only**, like the other stubs here. The Block / Show warning / Clear buttons
return success and you get the banner, but a re-read still shows the seeded state above. Point
`PRISON_API_URL` at a real prison-api to exercise the writes properly.

The prison list itself comes from the prison-register stub, which marks `XXI` as non-operational so
you can see that closed prisons are left out of the list.

## Resetting

Re-running the seed adds a **new** completed review each time (the latest one wins as the
current rating). To wipe all CSRA data and start clean, recreate the stack — this also re-runs
the auth client seed:

```bash
docker compose down -v
docker compose up
```
