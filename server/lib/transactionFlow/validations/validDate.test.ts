import validDate from './validDate'

describe('validDate', () => {
  const messages = {
    WRONG_FORMAT: 'Use day/month/year',
    INCOMPLETE: 'Enter a full date',
    NON_EXISTENT: 'Enter a real date',
  }
  const validate = validDate(messages)

  it.each([undefined, 2026, ['17/5/2026']])('rejects non-string input %j', value => {
    expect(validate(value)).toBe(messages.WRONG_FORMAT)
  })

  it.each(['', ' ', '17/5/2026', '17/05/2026', '29/2/2024', ' 17/5/2026 '])(
    'accepts %j, leaving empty values to the required validator',
    value => {
      expect(validate(value)).toBeNull()
    },
  )

  it.each([
    ['17-5-2026', 'WRONG_FORMAT'],
    ['2026/05/17', 'WRONG_FORMAT'],
    ['17/5', 'INCOMPLETE'],
    ['17//2026', 'INCOMPLETE'],
    ['31/4/2026', 'NON_EXISTENT'],
    ['29/2/2025', 'NON_EXISTENT'],
  ] as const)('maps %s to the configured %s error', (value, error) => {
    expect(validate(value)).toBe(messages[error])
  })
})
