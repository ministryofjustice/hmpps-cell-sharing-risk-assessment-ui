import { firstQueryValue, toArray } from './queryUtils'

describe('firstQueryValue', () => {
  it.each([
    ['undefined', undefined, undefined],
    ['single value', 'abc', 'abc'],
    ['trimmed value', '  abc  ', 'abc'],
    ['array takes first', ['first', 'second'], 'first'],
    ['array first trimmed', ['  first  ', 'second'], 'first'],
    ['empty string', '', undefined],
    ['whitespace', '   ', undefined],
    ['array empty first', ['', 'second'], undefined],
  ])('%s', (_: string, input: any, expected: string | undefined) => {
    expect(firstQueryValue(input)).toEqual(expected)
  })
})

describe('toArray', () => {
  it.each([
    ['single value', 'abc', ['abc']],
    ['single trimmed', '  abc  ', ['abc']],
    ['empty string removed', '', []],
    ['whitespace removed', '   ', []],
    ['array preserves order', ['a', 'b', 'c'], ['a', 'b', 'c']],
    ['array trims items', ['  a  ', ' b '], ['a', 'b']],
    ['array removes empty items', ['a', '', '   ', 'b'], ['a', 'b']],
  ])('%s', (_: string, input: any, expected: string[]) => {
    expect(toArray(input)).toEqual(expected)
  })
})
