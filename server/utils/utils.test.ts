import {
  buildPagination,
  convertToTitleCase,
  csraRatingLabel,
  csraRatingTagClass,
  csraStatusLabel,
  enumLabel,
  formatDate,
  formatMonthYear,
  initialiseName,
  isPrisonerNumber,
  parseCsraHistoryQuery,
  parseUkDate,
} from './utils'

describe('convert to title case', () => {
  it.each([
    [null, null, ''],
    ['empty string', '', ''],
    ['Lower case', 'robert', 'Robert'],
    ['Upper case', 'ROBERT', 'Robert'],
    ['Mixed case', 'RoBErT', 'Robert'],
    ['Multiple words', 'RobeRT SMiTH', 'Robert Smith'],
    ['Leading spaces', '  RobeRT', '  Robert'],
    ['Trailing spaces', 'RobeRT  ', 'Robert  '],
    ['Hyphenated', 'Robert-John SmiTH-jONes-WILSON', 'Robert-John Smith-Jones-Wilson'],
  ])('%s convertToTitleCase(%s, %s)', (_: string, a: string, expected: string) => {
    expect(convertToTitleCase(a)).toEqual(expected)
  })
})

describe('initialise name', () => {
  it.each([
    [null, null, null],
    ['Empty string', '', null],
    ['One word', 'robert', 'r. robert'],
    ['Two words', 'Robert James', 'R. James'],
    ['Three words', 'Robert James Smith', 'R. Smith'],
    ['Double barrelled', 'Robert-John Smith-Jones-Wilson', 'R. Smith-Jones-Wilson'],
  ])('%s initialiseName(%s, %s)', (_: string, a: string, expected: string) => {
    expect(initialiseName(a)).toEqual(expected)
  })
})

describe('formatDate', () => {
  it.each([
    ['missing', undefined, ''],
    ['null', null, ''],
    ['invalid', 'not-a-date', ''],
    ['date only', '2026-07-01', '1 July 2026'],
    ['date-time', '2026-06-26T11:20:00', '26 June 2026'],
  ])('%s formatDate(%s) === %s', (_: string, input: string, expected: string) => {
    expect(formatDate(input)).toEqual(expected)
  })
})

describe('csraRatingLabel', () => {
  it.each([
    ['HIGH', 'High'],
    ['HIGH_GENERAL', 'High risk – general'],
    ['HIGH_SPECIFIC', 'High risk – specific'],
    ['STANDARD', 'Standard'],
    [null, ''],
    [undefined, ''],
  ])('csraRatingLabel(%s) === %s', (input: string, expected: string) => {
    expect(csraRatingLabel(input)).toEqual(expected)
  })
})

describe('csraRatingTagClass', () => {
  it.each([
    ['HIGH', 'govuk-tag--red'],
    ['HIGH_GENERAL', 'govuk-tag--red'],
    ['HIGH_SPECIFIC', 'govuk-tag--red'],
    ['STANDARD', 'govuk-tag--blue'],
    [null, 'govuk-tag--grey'],
  ])('csraRatingTagClass(%s) === %s', (input: string, expected: string) => {
    expect(csraRatingTagClass(input)).toEqual(expected)
  })
})

describe('csraStatusLabel', () => {
  it.each([
    ['NO_RATING', 'No CSRA'],
    ['IN_PROGRESS', 'Assessment in progress'],
    ['PROVISIONAL', 'Provisional'],
    ['COMPLETE', 'Complete'],
    [null, ''],
  ])('csraStatusLabel(%s) === %s', (input: string, expected: string) => {
    expect(csraStatusLabel(input)).toEqual(expected)
  })
})

describe('enumLabel', () => {
  it.each([
    ['DIFFERENT_ETHNICITY', 'Different ethnicity'],
    ['GANG_MEMBERS', 'Gang members'],
    ['MENTAL_HEALTH', 'Mental health'],
    ['OTHER', 'Other'],
    [null, ''],
    [undefined, ''],
  ])('enumLabel(%s) === %s', (input: string, expected: string) => {
    expect(enumLabel(input)).toEqual(expected)
  })
})

describe('formatMonthYear', () => {
  it.each([
    ['missing', undefined, ''],
    ['invalid', 'not-a-date', ''],
    ['date only', '2011-06-15', 'June 2011'],
    ['date-time', '2025-10-11T09:00:00', 'October 2025'],
  ])('%s formatMonthYear(%s) === %s', (_: string, input: string, expected: string) => {
    expect(formatMonthYear(input)).toEqual(expected)
  })
})

describe('isPrisonerNumber', () => {
  it.each([
    ['A1234BC', true],
    ['a1234bc', true],
    ['A1234B', false],
    ['1234ABC', false],
    ['', false],
  ])('isPrisonerNumber(%s) === %s', (input: string, expected: boolean) => {
    expect(isPrisonerNumber(input)).toEqual(expected)
  })
})

describe('parseUkDate', () => {
  it.each([
    ['missing', undefined, undefined],
    ['blank', '', undefined],
    ['single digits', '5/7/2024', '2024-07-05'],
    ['padded', '17/05/2024', '2024-05-17'],
    ['dash separators', '17-5-2024', '2024-05-17'],
    ['not a real date', '31/2/2024', undefined],
    ['nonsense', 'abc', undefined],
    ['wrong order', '2024/05/17', undefined],
  ])('%s parseUkDate(%s) === %s', (_: string, input: string, expected?: string) => {
    expect(parseUkDate(input)).toEqual(expected)
  })
})

describe('parseCsraHistoryQuery', () => {
  it('defaults to page 1, zero-based page 0 and the default size with no filters', () => {
    const result = parseCsraHistoryQuery({})
    expect(result.page).toBe(1)
    expect(result.ratings).toEqual([])
    expect(result.establishments).toEqual([])
    expect(result.apiQuery).toEqual({
      page: '0',
      size: '20',
      ratings: undefined,
      establishments: undefined,
      fromDate: undefined,
      toDate: undefined,
    })
  })

  it('whitelists ratings, normalises establishments, parses dates and translates the 1-based page to zero-based', () => {
    const result = parseCsraHistoryQuery({
      ratings: ['HIGH', 'BOGUS', 'STANDARD'],
      establishments: ['lei', 'MDI'],
      fromDate: '1/1/2020',
      toDate: '31/12/2024',
      page: '3',
    })
    expect(result.ratings).toEqual(['HIGH', 'STANDARD'])
    expect(result.establishments).toEqual(['LEI', 'MDI'])
    expect(result.fromDateRaw).toBe('1/1/2020')
    expect(result.page).toBe(3)
    expect(result.apiQuery).toEqual({
      page: '2',
      size: '20',
      ratings: ['HIGH', 'STANDARD'],
      establishments: ['LEI', 'MDI'],
      fromDate: '2020-01-01',
      toDate: '2024-12-31',
    })
  })

  it('falls back to page 1 for invalid page values', () => {
    expect(parseCsraHistoryQuery({ page: '0' }).page).toBe(1)
    expect(parseCsraHistoryQuery({ page: '-2' }).page).toBe(1)
    expect(parseCsraHistoryQuery({ page: 'abc' }).page).toBe(1)
  })
})

describe('buildPagination', () => {
  it('returns the result window and no previous/next on a single page', () => {
    const pagination = buildPagination(1, 1, 3, 20, '')
    expect(pagination.results).toEqual({ from: 1, to: 3, count: 3 })
    expect(pagination.previous).toBeUndefined()
    expect(pagination.next).toBeUndefined()
    expect(pagination.items).toEqual([{ text: 1, href: '?page=1', selected: true }])
  })

  it('computes the from/to window and preserves the base query in links', () => {
    const pagination = buildPagination(2, 3, 55, 20, 'ratings=HIGH')
    expect(pagination.results).toEqual({ from: 21, to: 40, count: 55 })
    expect(pagination.previous?.href).toBe('?ratings=HIGH&page=1')
    expect(pagination.next?.href).toBe('?ratings=HIGH&page=3')
    expect(pagination.items.map(item => item.text)).toEqual([1, 2, 3])
  })

  it('reports zero results for an empty list', () => {
    const pagination = buildPagination(1, 0, 0, 20, '')
    expect(pagination.results).toEqual({ from: 0, to: 0, count: 0 })
    expect(pagination.items).toEqual([])
  })
})
