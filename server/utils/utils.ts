import type { ParsedQs } from 'qs'
import { differenceInCalendarDays, format, isValid, parse, parseISO, startOfDay } from 'date-fns'
import { type CsraArrivalType, type CsraHistoryQuery } from '../data/csraApiTypes'

const properCase = (word: string): string =>
  word.length >= 1 ? word[0].toUpperCase() + word.toLowerCase().slice(1) : word

const isBlank = (str: string): boolean => !str || /^\s*$/.test(str)

/**
 * Converts a name (first name, last name, middle name, etc.) to proper case equivalent, handling double-barreled names
 * correctly (i.e. each part in a double-barreled is converted to proper case).
 * @param name name to be converted.
 * @returns name converted to proper case.
 */
const properCaseName = (name: string): string => (isBlank(name) ? '' : name.split('-').map(properCase).join('-'))

export const convertToTitleCase = (sentence: string): string =>
  isBlank(sentence) ? '' : sentence.split(' ').map(properCaseName).join(' ')

export const initialiseName = (fullName?: string): string | null => {
  // this check is for the authError page
  if (!fullName) return null

  const array = fullName.split(' ')
  return `${array[0][0]}. ${array.reverse()[0]}`
}

/**
 * Format an ISO date or date-time string as e.g. "1 July 2026". Formats in UTC so a date-only value
 * (e.g. "2026-07-01") is never shifted across a day boundary by the local timezone. Returns '' for a
 * missing/invalid value so views can render a placeholder.
 */
export const formatDate = (isoDate?: string | null): string => {
  if (!isoDate) return ''
  const date = new Date(isoDate)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
}

/**
 * Format an ISO date-time as e.g. "1 July 2026 at 09:30".
 *
 * Deliberately not formatDate: the API's audit stamps are zoneless LocalDateTimes, which `new Date()`
 * reads as local time. Formatting those in UTC as formatDate does would shift anything before 01:00
 * back a day during British Summer Time. parseISO keeps the components exactly as written.
 */
export const formatDateTime = (isoDateTime?: string | null): string => {
  if (!isoDateTime) return ''
  const dateTime = parseISO(isoDateTime)
  if (!isValid(dateTime)) return ''
  return format(dateTime, "d MMMM yyyy 'at' HH:mm")
}

/**
 * Format an ISO date as a month and year, e.g. "June 2011". Used for the history summary date range.
 * Formats in UTC and returns '' for a missing/invalid value.
 */
export const formatMonthYear = (isoDate?: string | null): string => {
  if (!isoDate) return ''
  const date = new Date(isoDate)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' })
}

/**
 * Format an ISO date as a day of the week, day of the month and month, e.g. "Monday 1 June". Used for
 * the recent arrivals list. Formats in UTC and returns '' for a missing/invalid value.
 */
export const formatDayMonth = (isoDate?: string | null): string => {
  if (!isoDate) return ''
  const date = new Date(isoDate)
  if (!isValid(date)) return ''
  return format(date, 'EEEE d MMMM')
}

/**
 * Format an ISO date-time as a time, e.g. "09:30". Returns '' for a missing/invalid value.
 */
export const formatTime = (isoDateTime?: string | null): string => {
  if (!isoDateTime) return ''
  const dateTime = parseISO(isoDateTime)
  if (!isValid(dateTime)) return ''
  return format(dateTime, 'HH:mm')
}

/**
 * Number of calendar days an ISO date is overdue relative to today.
 * Returns 0 when the date is today/in the future or invalid.
 */
export const daysOverdue = (isoDate?: string | null, now: Date = new Date()): number => {
  if (!isoDate) return 0
  const dueDate = parseISO(isoDate)
  if (!isValid(dueDate)) return 0

  const overdueDays = differenceInCalendarDays(startOfDay(now), startOfDay(dueDate))
  return overdueDays > 0 ? overdueDays : 0
}

/** Human-readable label for a CSRA result (mirrors the API's CsraResult enum). */
export const csraRatingLabel = (rating?: string | null): string => {
  switch (rating) {
    case 'HIGH':
      return 'High'
    case 'HIGH_GENERAL':
      return 'High risk – general'
    case 'HIGH_SPECIFIC':
      return 'High risk – specific'
    case 'STANDARD':
      return 'Standard'
    case 'NO_RATING':
      return 'No rating'
    default:
      return ''
  }
}

/**
 * Human-readable label for a raw NOMIS supervision level (mirrors the API's CsraLevel enum).
 *
 * Separate from csraRatingLabel because the legacy fields are CsraLevel, not CsraResult — passing
 * 'LOW' or 'HI' to csraRatingLabel returns an empty string.
 */
export const csraLevelLabel = (level?: string | null): string => {
  switch (level) {
    case 'HI':
      return 'High'
    case 'MED':
      return 'Medium'
    case 'LOW':
      return 'Low'
    case 'STANDARD':
      return 'Standard'
    case 'PEND':
      return 'Pending'
    default:
      return ''
  }
}

/** GOV.UK tag colour modifier class for a CSRA result: high ratings red, standard blue, unknown grey. */
export const csraRatingTagClass = (rating?: string | null): string => {
  switch (rating) {
    case 'HIGH':
    case 'HIGH_GENERAL':
      return 'govuk-tag--dark-red'
    case 'HIGH_SPECIFIC':
      return 'govuk-tag--red'
    case 'STANDARD':
      return 'govuk-tag--green'
    default:
      return 'govuk-tag--grey'
  }
}

/** Human-readable label for a CSRA rating status (mirrors the API's CsraRatingStatus enum). */
export const csraStatusLabel = (status?: string | null): string => {
  switch (status) {
    case 'NO_RATING':
      return 'No CSRA'
    case 'IN_PROGRESS':
      return 'Assessment in progress'
    case 'PROVISIONAL':
      return 'Provisional'
    case 'COMPLETE':
      return 'Complete'
    default:
      return ''
  }
}

/** Human-readable label for an arrival type (mirrors the API's CsraArrivalType enum). */
export const arrivalTypeLabel = (arrivalType?: CsraArrivalType | null): string => {
  switch (arrivalType) {
    case 'NEW_ADMISSION':
      return 'New admission'
    case 'TRANSFER_IN':
      return 'Transfer in'
    case 'COURT_RETURN':
      return 'Court return'
    case 'TEMPORARY_ABSENCE_RETURN':
      return 'Temporary absence return'
    default:
      return ''
  }
}

/**
 * Turn a SCREAMING_SNAKE_CASE enum value (e.g. a risk-to or vulnerability category) into a readable
 * sentence-case label, e.g. "DIFFERENT_ETHNICITY" -> "Different ethnicity".
 */
export const enumLabel = (value?: string | null): string => {
  if (!value) return ''
  const sentence = value.replace(/_/g, ' ').toLowerCase()
  return sentence.charAt(0).toUpperCase() + sentence.slice(1)
}

/**
 * Human-readable label for a CSRA record type (mirrors the API's CsraType enum). The new-model values
 * need spelling out; enumLabel alone would render them "Csra initial review".
 */
export const csraTypeLabel = (type?: string | null): string => {
  switch (type) {
    case 'CSRA_INITIAL_REVIEW':
      return 'CSRA initial review'
    case 'CSRA_REVIEW':
      return 'CSRA review'
    default:
      return enumLabel(type)
  }
}

/**
 * Human-readable label for a location. The API returns the raw NOMIS location name, which is often a code (e.g. "RECP" for reception).
 */
export const formatLocation = (locationName: string): string => {
  if (!locationName) return ''
  if (locationName.includes('RECP')) return 'Reception'
  if (locationName.includes('CSWAP')) return 'No cell allocated'
  if (locationName.includes('COURT')) return 'Court'
  return locationName
}

const PRISON_NUMBER_PATTERN = /^[A-Za-z]\d{4}[A-Za-z]{2}$/

/** Whether a value is a valid prisoner (NOMS) number, e.g. "A1234BC". */
export const isPrisonerNumber = (value: string): boolean => PRISON_NUMBER_PATTERN.test(value)

/** The coarse CSRA rating buckets the history endpoint filters on. */
export const ALL_RATING_BUCKETS = ['HIGH', 'STANDARD'] as const
export type RatingBucket = (typeof ALL_RATING_BUCKETS)[number]

/** Default page size for the CSRA history list (matches the API default). */
export const HISTORY_PAGE_SIZE = 20

const firstValue = (value: ParsedQs[string]): string | undefined =>
  (Array.isArray(value) ? value[0] : value)?.toString().trim() || undefined

const toArray = (value: ParsedQs[string]): string[] =>
  (Array.isArray(value) ? value : [value])
    .map(item => item?.toString().trim())
    .filter((item): item is string => Boolean(item))

/** Error types returned by {@link validateUkDate}. */
export type UkDateValidationError = 'WRONG_FORMAT' | 'INCOMPLETE' | 'NON_EXISTENT'

/**
 * Format string used by date-fns to parse UK date inputs (d/m/yyyy with slash separators only).
 */
const UK_DATE_FORMAT = 'd/M/yyyy'

/**
 * Validate a UK-format date string and return the specific error type, or null if valid/empty.
 * Only slash separators are accepted (e.g. "17/5/2024"); dashes and dots are treated as wrong format.
 * - 'WRONG_FORMAT': no slash separators, or non-numeric parts where digits are expected
 * - 'INCOMPLETE': slashes present but fewer than three parts, or an empty part
 * - 'NON_EXISTENT': well-formed d/m/yyyy but the calendar date does not exist (e.g. 31/4/2026)
 */
export const validateUkDate = (value?: string): UkDateValidationError | null => {
  if (!value?.trim()) return null

  const trimmed = value.trim()

  if (!trimmed.includes('/')) return 'WRONG_FORMAT'

  const parts = trimmed.split('/')
  if (parts.length !== 3 || parts.some(p => !p)) return 'INCOMPLETE'

  const match = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (!match) return 'WRONG_FORMAT'

  const [, d, m, y] = match
  const day = Number(d)
  const month = Number(m)
  const year = Number(y)

  // Use date-fns to parse and validate the calendar date. Overflow (e.g. 31/4/2026 → May 1)
  // is detected by comparing the parsed date's components back to the original values.
  const parsed = parse(`${day}/${month}/${year}`, UK_DATE_FORMAT, new Date(0))
  if (
    !isValid(parsed) ||
    parsed.getDate() !== day ||
    parsed.getMonth() !== month - 1 ||
    parsed.getFullYear() !== year
  ) {
    return 'NON_EXISTENT'
  }
  return null
}

/**
 * Parse a UK-format date ("17/5/2024", also accepting "-" or ".") into an ISO date ("2024-05-17"),
 * or undefined if it is missing or not a real calendar date. Used to translate the MOJ date-picker
 * inputs into the API's `fromDate`/`toDate` query params.
 */
export const parseUkDate = (value?: string): string | undefined => {
  if (!value) return undefined
  const match = value.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (!match) return undefined
  const [, d, m, y] = match
  const day = Number(d)
  const month = Number(m)
  const year = Number(y)
  const parsed = parse(`${day}/${month}/${year}`, UK_DATE_FORMAT, new Date(0))
  if (
    !isValid(parsed) ||
    parsed.getDate() !== day ||
    parsed.getMonth() !== month - 1 ||
    parsed.getFullYear() !== year
  ) {
    return undefined
  }
  return format(parsed, 'yyyy-MM-dd')
}

export interface ParsedCsraHistoryQuery {
  ratings: RatingBucket[]
  establishments: string[]
  fromDateRaw?: string
  toDateRaw?: string
  fromDate?: string
  toDate?: string
  page: number
  apiQuery: CsraHistoryQuery
}

/** Parse and whitelist the CSRA history request query into filter + paging values for the API. */
export const parseCsraHistoryQuery = (reqQuery: ParsedQs, size = HISTORY_PAGE_SIZE): ParsedCsraHistoryQuery => {
  const ratings = toArray(reqQuery.ratings).filter((rating): rating is RatingBucket =>
    (ALL_RATING_BUCKETS as readonly string[]).includes(rating),
  )
  // Establishments are prison ids (e.g. "LEI"); there is no fixed set, so normalise and pass through.
  const establishments = toArray(reqQuery.establishments).map(prisonId => prisonId.toUpperCase())
  const fromDateRaw = firstValue(reqQuery.fromDate)
  const toDateRaw = firstValue(reqQuery.toDate)
  const fromDate = parseUkDate(fromDateRaw)
  const toDate = parseUkDate(toDateRaw)
  const parsedPage = Number.parseInt(firstValue(reqQuery.page) ?? '1', 10)
  const page = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1

  const apiQuery: CsraHistoryQuery = {
    page: String(page - 1), // API pages are zero-based
    size: String(size),
    ratings: ratings.length ? ratings : undefined,
    establishments: establishments.length ? establishments : undefined,
    fromDate,
    toDate,
  }

  return { ratings, establishments, fromDateRaw, toDateRaw, fromDate, toDate, page, apiQuery }
}

export interface PaginationItem {
  text?: number
  href?: string
  selected?: boolean
  type?: 'dots'
}

export interface Pagination {
  results: { from: number; to: number; count: number }
  previous?: { href: string }
  next?: { href: string }
  items: PaginationItem[]
}

/**
 * Build a pagination view model for the history list. `page` is 1-based; `baseQuery` is the current
 * query string without the page param (each item appends its own page). Mirrors the shape used by the
 * MOJ pagination component, with a condensed window of page links around the current page.
 */
export const buildPagination = (
  page: number,
  totalPages: number,
  totalElements: number,
  size: number,
  baseQuery: string,
): Pagination => {
  const href = (targetPage: number): string => {
    const params = new URLSearchParams(baseQuery)
    params.set('page', targetPage.toString())
    return `?${params.toString()}`
  }

  const items: PaginationItem[] = []
  let previousWasGap = false
  for (let candidate = 1; candidate <= totalPages; candidate += 1) {
    const nearEnds = candidate === 1 || candidate === totalPages
    const nearCurrent = Math.abs(candidate - page) <= 1
    if (nearEnds || nearCurrent) {
      items.push({ text: candidate, href: href(candidate), selected: candidate === page })
      previousWasGap = false
    } else if (!previousWasGap) {
      items.push({ type: 'dots' })
      previousWasGap = true
    }
  }

  const from = totalElements === 0 ? 0 : (page - 1) * size + 1
  const to = Math.min(page * size, totalElements)

  return {
    results: { from, to, count: totalElements },
    previous: page > 1 ? { href: href(page - 1) } : undefined,
    next: page < totalPages ? { href: href(page + 1) } : undefined,
    items,
  }
}
