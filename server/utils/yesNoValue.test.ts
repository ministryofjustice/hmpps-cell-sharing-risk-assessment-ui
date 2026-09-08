import { yesNoValue } from './yesNoValue'

describe('yesNoValue', () => {
  it.each([
    [true, 'Yes'],
    [false, 'No'],
    [null, null],
    [undefined, undefined],
    ['OTHER', 'OTHER'],
  ])('yesNoValue(%p) === %p', (input, expected) => {
    expect(yesNoValue(input)).toBe(expected)
  })
})
