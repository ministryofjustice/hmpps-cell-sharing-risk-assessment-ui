import required from './required'

describe('required validation', () => {
  const validate = required('This field is required')

  it.each([
    ['undefined', undefined],
    ['null', null],
    ['empty string', ''],
    ['empty array', []],
  ])('returns error for %s', (_label: string, value: unknown) => {
    expect(validate(value as string | string[] | number | undefined)).toBe('This field is required')
  })

  it.each([
    ['string', 'value'],
    ['number', 0],
    ['array', ['one']],
  ])('returns null for valid %s', (_label: string, value: string | string[] | number) => {
    expect(validate(value)).toBeNull()
  })
})
