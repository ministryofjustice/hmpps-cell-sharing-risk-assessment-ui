#!/usr/bin/env node
/**
 * MAPA-349 / MAPA-361 spike: how often does hmpps-court-data-ingestion-api actually
 * match a prisoner, for the cohort we care about — people who have just arrived at a
 * busy local prison and whose CSRA is being done on day one?
 *
 * Read-only. Makes no writes to any API. Samples recent receptions from
 * hmpps-prisoner-search, then asks the court API what it holds for each of them.
 *
 * The headline number is NOT one match rate. The court API re-runs matching when it
 * sees a `prisoner-offender-search.prisoner.created/updated` domain event, so a warrant
 * that arrived before the person existed in NOMIS gets picked up retrospectively. That
 * means match rate is a function of time since reception, and reporting a single
 * average would hide exactly the effect the spike is meant to measure.
 *
 * Usage:
 *   node scripts/warrant-match-rate.mjs                  # default prisons, 30-day window
 *   node scripts/warrant-match-rate.mjs --days 14        # narrower reception window
 *   node scripts/warrant-match-rate.mjs --prisons LEI,DNI
 *   node scripts/warrant-match-rate.mjs --limit 50       # cap prisoners per prison (dry run)
 *   node scripts/warrant-match-rate.mjs --no-cache       # ignore the on-disk cache
 *
 * Credentials (client_credentials, prod) — put in .env, which is gitignored:
 *   WARRANT_SPIKE_CLIENT_ID=...
 *   WARRANT_SPIKE_CLIENT_SECRET=...
 *
 * The client needs, on top of whatever it already has:
 *   ROLE_COURT_DATA_INGESTION__COURT_DATA_RO   (court API)
 *   ROLE_PRISONER_SEARCH or ROLE_GLOBAL_SEARCH (attribute search)
 *
 * Output goes to scripts/.warrant-match-rate/ (gitignored): a per-prisoner CSV and the
 * summary tables below. That directory holds real prison numbers — it must not be
 * committed, pasted into Jira/Slack, or copied anywhere shared. Report the aggregates.
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'

const AUTH_URL = 'https://sign-in.hmpps.service.justice.gov.uk/auth'
const PRISONER_SEARCH_URL = 'https://prisoner-search.prison.service.justice.gov.uk'
const COURT_API_URL = 'https://court-data-ingestion-api.hmpps.service.justice.gov.uk'

// Busy locals/remand prisons spread across regions, per the story's "sample across a few
// different local prisons and courts in different regions".
const DEFAULT_PRISONS = {
  LEI: 'Leeds (Yorkshire)',
  DNI: 'Doncaster (Yorkshire)',
  BMI: 'Birmingham (Midlands)',
  BLI: 'Bristol (South West)',
  WWI: 'Wandsworth (London)',
}

const WARRANT_TYPES = new Set(['SENTENCING_WARRANT', 'REMAND_WARRANT'])
const CONCURRENCY = 5
const CACHE_DIR = path.join(import.meta.dirname, '.warrant-match-rate')

// ---------------------------------------------------------------- args

function parseArgs(argv) {
  const args = { days: 30, prisons: Object.keys(DEFAULT_PRISONS), limit: null, cache: true }
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--days') args.days = Number(argv[(i += 1)])
    else if (arg === '--prisons') args.prisons = argv[(i += 1)].split(',').map(p => p.trim().toUpperCase())
    else if (arg === '--limit') args.limit = Number(argv[(i += 1)])
    else if (arg === '--no-cache') args.cache = false
    else if (arg === '--help' || arg === '-h') {
      console.log(readHelp())
      process.exit(0)
    } else throw new Error(`Unknown argument: ${arg}`)
  }
  if (!Number.isFinite(args.days) || args.days < 1) throw new Error('--days must be a positive number')
  if (args.limit !== null && (!Number.isFinite(args.limit) || args.limit < 1)) {
    throw new Error('--limit must be a positive number')
  }
  return args
}

const readHelp = () => 'See the comment block at the top of this file.'

// ---------------------------------------------------------------- plumbing

async function getToken() {
  const clientId = process.env.WARRANT_SPIKE_CLIENT_ID
  const clientSecret = process.env.WARRANT_SPIKE_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    throw new Error('Set WARRANT_SPIKE_CLIENT_ID and WARRANT_SPIKE_CLIENT_SECRET (see .env, which is gitignored)')
  }
  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')
  const response = await fetch(`${AUTH_URL}/oauth/token?grant_type=client_credentials`, {
    method: 'POST',
    headers: { Authorization: `Basic ${credentials}`, 'Content-Type': 'application/x-www-form-urlencoded' },
  })
  if (!response.ok) throw new Error(`Auth failed: ${response.status} ${await response.text()}`)
  return (await response.json()).access_token
}

/** Small concurrency-capped map, so we never have more than `limit` requests in flight. */
async function mapWithLimit(items, limit, fn) {
  const results = new Array(items.length)
  let next = 0
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next
      next += 1
      results[index] = await fn(items[index], index)
    }
  })
  await Promise.all(workers)
  return results
}

/**
 * Cache court API responses to disk. Re-running the analysis is normal while working out
 * how to slice the data, and there is no reason to re-hammer a production API to do it.
 */
async function cached(key, useCache, fn) {
  const file = path.join(CACHE_DIR, `${key}.json`)
  if (useCache) {
    try {
      return JSON.parse(await fs.readFile(file, 'utf8'))
    } catch {
      /* not cached yet */
    }
  }
  const value = await fn()
  await fs.mkdir(path.dirname(file), { recursive: true })
  await fs.writeFile(file, JSON.stringify(value))
  return value
}

// ---------------------------------------------------------------- upstream calls

/** Recent receptions at one prison, via prisoner-search attribute search. */
async function getRecentReceptions(token, prisonId, sinceDate, limit) {
  const pageSize = 500
  const collected = []
  for (let page = 0; ; page += 1) {
    const response = await fetch(
      `${PRISONER_SEARCH_URL}/attribute-search?page=${page}&size=${pageSize}` +
        `&responseFields=prisonerNumber&responseFields=receptionDate&responseFields=prisonId`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          joinType: 'AND',
          queries: [
            {
              joinType: 'AND',
              matchers: [
                { type: 'String', attribute: 'prisonId', condition: 'IS', searchTerm: prisonId },
                { type: 'Date', attribute: 'receptionDate', minValue: sinceDate },
              ],
            },
          ],
        }),
      },
    )
    if (!response.ok)
      throw new Error(`Attribute search failed for ${prisonId}: ${response.status} ${await response.text()}`)
    const body = await response.json()
    collected.push(...(body.content ?? []))
    if (body.last !== false || (limit && collected.length >= limit)) break
  }
  return limit ? collected.slice(0, limit) : collected
}

/** Court hearings for one prisoner. A 404 or empty list is a normal "no match", not an error. */
async function getCourtHearings(token, prisonerNumber, useCache) {
  return cached(`hearings/${prisonerNumber}`, useCache, async () => {
    const response = await fetch(`${COURT_API_URL}/court-hearings/prisoner/${prisonerNumber}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    })
    if (response.status === 404) return []
    if (!response.ok) {
      throw new Error(`Court API failed for ${prisonerNumber}: ${response.status} ${await response.text()}`)
    }
    return response.json()
  })
}

// ---------------------------------------------------------------- analysis

const daysBetween = (later, earlier) => (Date.parse(later) - Date.parse(earlier)) / 86_400_000

function summarisePrisoner(prisoner, hearings) {
  const documents = hearings.flatMap(hearing => hearing.documents.map(document => ({ ...document, hearing })))
  const warrants = documents.filter(document => WARRANT_TYPES.has(document.documentType))

  // The design shows warrants from the last 30 days, so measure that window specifically
  // as well as "matched at all" — they are different questions and only one of them is
  // what an officer would actually see on the screen.
  const now = Date.now()
  const warrantsInWindow = warrants.filter(w => (now - Date.parse(w.ingestionAt)) / 86_400_000 <= 30)

  const daysSinceReception = prisoner.receptionDate
    ? Math.floor(daysBetween(new Date().toISOString(), prisoner.receptionDate))
    : null

  return {
    prisonerNumber: prisoner.prisonerNumber,
    prisonId: prisoner.prisonId,
    receptionDate: prisoner.receptionDate ?? '',
    daysSinceReception,
    matched: hearings.length > 0,
    hearingCount: hearings.length,
    documentCount: documents.length,
    warrantCount: warrants.length,
    warrantsInLast30Days: warrantsInWindow.length,
    courtNames: [...new Set(hearings.map(h => h.courtName))],
    missingCourtCode: hearings.filter(h => !h.courtCode).length,
    // Observable court -> available lag: how long after the hearing the document landed.
    ingestionLagDays: documents.map(d => daysBetween(d.ingestionAt, d.hearing.hearingDate)).filter(Number.isFinite),
  }
}

const percent = (numerator, denominator) =>
  denominator === 0 ? 'n/a' : `${((numerator / denominator) * 100).toFixed(1)}%`

function quantiles(values) {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const at = fraction => sorted[Math.min(sorted.length - 1, Math.floor(fraction * sorted.length))]
  return { p50: at(0.5), p90: at(0.9), max: sorted[sorted.length - 1] }
}

function table(title, header, rows) {
  console.log(`\n${title}`)
  console.log('-'.repeat(title.length))
  const widths = header.map((h, i) => Math.max(h.length, ...rows.map(r => String(r[i]).length)))
  const line = cells => cells.map((c, i) => String(c).padEnd(widths[i])).join('  ')
  console.log(line(header))
  console.log(line(widths.map(w => '-'.repeat(w))))
  rows.forEach(row => console.log(line(row)))
}

function report(results, prisons) {
  const total = results.length
  const matched = results.filter(r => r.matched)

  console.log(`\n${'='.repeat(72)}`)
  console.log(`Sampled ${total} recent receptions across ${prisons.length} prisons`)
  console.log(`Matched by the court API: ${matched.length} (${percent(matched.length, total)})`)
  console.log(
    `With at least one warrant in the last 30 days: ` +
      `${results.filter(r => r.warrantsInLast30Days > 0).length} ` +
      `(${percent(results.filter(r => r.warrantsInLast30Days > 0).length, total)})`,
  )
  console.log(`${'='.repeat(72)}`)

  // The headline of the spike: does the match rate hold up on day one?
  const buckets = [
    ['0 (day of reception)', r => r.daysSinceReception === 0],
    ['1', r => r.daysSinceReception === 1],
    ['2', r => r.daysSinceReception === 2],
    ['3-6', r => r.daysSinceReception >= 3 && r.daysSinceReception <= 6],
    ['7-13', r => r.daysSinceReception >= 7 && r.daysSinceReception <= 13],
    ['14-29', r => r.daysSinceReception >= 14 && r.daysSinceReception <= 29],
    ['30+', r => r.daysSinceReception >= 30],
  ]
  table(
    'Match rate by days since reception  (the question the story actually asks)',
    ['Days since reception', 'Sampled', 'Matched', 'Match rate', 'Has 30-day warrant', 'Warrant rate'],
    buckets.map(([label, predicate]) => {
      const cohort = results.filter(r => r.daysSinceReception !== null && predicate(r))
      const cohortMatched = cohort.filter(r => r.matched).length
      const cohortWarrants = cohort.filter(r => r.warrantsInLast30Days > 0).length
      return [
        label,
        cohort.length,
        cohortMatched,
        percent(cohortMatched, cohort.length),
        cohortWarrants,
        percent(cohortWarrants, cohort.length),
      ]
    }),
  )

  table(
    'Match rate by prison',
    ['Prison', 'Sampled', 'Matched', 'Match rate', 'Warrant rate'],
    prisons.map(prisonId => {
      const cohort = results.filter(r => r.prisonId === prisonId)
      const cohortMatched = cohort.filter(r => r.matched).length
      const cohortWarrants = cohort.filter(r => r.warrantsInLast30Days > 0).length
      return [
        `${prisonId} ${DEFAULT_PRISONS[prisonId] ?? ''}`.trim(),
        cohort.length,
        cohortMatched,
        percent(cohortMatched, cohort.length),
        percent(cohortWarrants, cohort.length),
      ]
    }),
  )

  const byCourt = new Map()
  matched.forEach(result => result.courtNames.forEach(court => byCourt.set(court, (byCourt.get(court) ?? 0) + 1)))
  table(
    'Courts seen (matched prisoners only) — regional spread check',
    ['Court', 'Prisoners'],
    [...byCourt.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20),
  )

  const lags = quantiles(results.flatMap(r => r.ingestionLagDays))
  console.log('\nIngestion lag (hearing date -> document ingested), in days')
  console.log('---------------------------------------------------------')
  console.log(
    lags
      ? `p50 ${lags.p50.toFixed(2)}   p90 ${lags.p90.toFixed(2)}   max ${lags.max.toFixed(2)}   (n=${results.flatMap(r => r.ingestionLagDays).length})`
      : 'No documents returned, so no lag to measure.',
  )

  const allHearings = matched.reduce((sum, r) => sum + r.hearingCount, 0)
  const missingCourtCode = matched.reduce((sum, r) => sum + r.missingCourtCode, 0)
  const allDocuments = results.reduce((sum, r) => sum + r.documentCount, 0)
  const allWarrants = results.reduce((sum, r) => sum + r.warrantCount, 0)
  console.log('\nField population and document mix')
  console.log('---------------------------------')
  console.log(
    `Hearings with a null courtCode: ${missingCourtCode}/${allHearings} (${percent(missingCourtCode, allHearings)})`,
  )
  console.log(`Documents that are warrants:    ${allWarrants}/${allDocuments} (${percent(allWarrants, allDocuments)})`)
}

// ---------------------------------------------------------------- main

async function main() {
  const args = parseArgs(process.argv.slice(2))

  const since = new Date(Date.now() - args.days * 86_400_000).toISOString().slice(0, 10)
  console.log(`Sampling receptions since ${since} at: ${args.prisons.join(', ')}`)
  if (args.limit) console.log(`Capped at ${args.limit} prisoners per prison (dry run)`)

  const token = await getToken()

  const prisoners = (
    await mapWithLimit(args.prisons, 2, async prisonId => {
      const found = await getRecentReceptions(token, prisonId, since, args.limit)
      console.log(`  ${prisonId}: ${found.length} recent receptions`)
      return found
    })
  ).flat()

  if (prisoners.length === 0) {
    console.log('\nNo receptions found — widen --days or check the prison codes.')
    return
  }

  console.log(`\nQuerying the court API for ${prisoners.length} prisoners...`)
  let done = 0
  const results = await mapWithLimit(prisoners, CONCURRENCY, async prisoner => {
    const hearings = await getCourtHearings(token, prisoner.prisonerNumber, args.cache)
    done += 1
    if (done % 100 === 0) process.stdout.write(`  ${done}/${prisoners.length}\n`)
    return summarisePrisoner(prisoner, hearings)
  })

  report(results, args.prisons)

  const csvPath = path.join(CACHE_DIR, 'results.csv')
  const columns = [
    'prisonerNumber',
    'prisonId',
    'receptionDate',
    'daysSinceReception',
    'matched',
    'hearingCount',
    'documentCount',
    'warrantCount',
    'warrantsInLast30Days',
  ]
  await fs.mkdir(CACHE_DIR, { recursive: true })
  await fs.writeFile(csvPath, [columns.join(','), ...results.map(r => columns.map(c => r[c]).join(','))].join('\n'))
  console.log(`\nPer-prisoner CSV: ${csvPath}`)
  console.log('This contains real prison numbers. Do not commit or share it — report the aggregates above.')
}

main().catch(error => {
  console.error(`\n${error.message}`)
  process.exit(1)
})
