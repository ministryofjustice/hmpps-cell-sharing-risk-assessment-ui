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
    default:
      return ''
  }
}

/** GOV.UK tag colour modifier class for a CSRA result: high ratings red, standard blue, unknown grey. */
export const csraRatingTagClass = (rating?: string | null): string => {
  switch (rating) {
    case 'HIGH':
    case 'HIGH_GENERAL':
    case 'HIGH_SPECIFIC':
      return 'govuk-tag--red'
    case 'STANDARD':
      return 'govuk-tag--blue'
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

/**
 * Turn a SCREAMING_SNAKE_CASE enum value (e.g. a risk-to or vulnerability category) into a readable
 * sentence-case label, e.g. "DIFFERENT_ETHNICITY" -> "Different ethnicity".
 */
export const enumLabel = (value?: string | null): string => {
  if (!value) return ''
  const sentence = value.replace(/_/g, ' ').toLowerCase()
  return sentence.charAt(0).toUpperCase() + sentence.slice(1)
}
