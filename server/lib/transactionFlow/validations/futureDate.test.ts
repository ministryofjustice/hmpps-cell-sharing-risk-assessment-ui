import futureDate from './futureDate'

describe('futureDate validation', () => {
  const errorMessage = 'Select an available date from the calendar'
  const validate = futureDate(errorMessage)

  beforeEach(() => {
    jest.useFakeTimers()
    jest.setSystemTime(new Date('2026-07-01T23:30:00Z'))
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it.each([
    ['2026-07-01T23:30:00Z', '2/7/2026', '3/7/2026'],
    ['2026-01-01T23:30:00Z', '1/1/2026', '2/1/2026'],
    ['2026-03-29T23:30:00Z', '30/3/2026', '31/3/2026'],
    ['2026-10-25T00:30:00Z', '25/10/2026', '26/10/2026'],
    ['2026-10-25T01:30:00Z', '25/10/2026', '26/10/2026'],
    ['2026-12-31T23:30:00Z', '31/12/2026', '1/1/2027'],
  ])('compares UK calendar dates at %s', (now, today, tomorrow) => {
    jest.setSystemTime(new Date(now))

    expect(validate(today)).toBe(errorMessage)
    expect(validate(tomorrow)).toBeNull()
  })

  it('rejects a past date', () => {
    expect(validate('1/7/2026')).toBe(errorMessage)
  })

  it.each([undefined, 123, ['3/7/2026'], '', 'invalid', '31/4/2026'])('rejects invalid input %p', value => {
    expect(validate(value)).toBe(errorMessage)
  })
})
