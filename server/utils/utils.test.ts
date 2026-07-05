import {
  convertToTitleCase,
  csraRatingLabel,
  csraRatingTagClass,
  csraStatusLabel,
  enumLabel,
  formatDate,
  initialiseName,
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
