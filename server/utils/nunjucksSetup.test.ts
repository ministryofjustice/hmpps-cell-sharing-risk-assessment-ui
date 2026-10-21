import express from 'express'
import nunjucks from 'nunjucks'
import nunjucksSetup from './nunjucksSetup'

describe('tomorrow Nunjucks global', () => {
  let environment: nunjucks.Environment

  beforeEach(() => {
    jest.useFakeTimers()
    environment = new nunjucks.Environment()
    jest.spyOn(nunjucks, 'configure').mockReturnValue(environment)
    nunjucksSetup(express())
  })

  afterEach(() => {
    jest.useRealTimers()
    jest.restoreAllMocks()
  })

  it.each([
    ['2026-07-01T23:30:00Z', '3/7/2026'],
    ['2026-01-01T23:30:00Z', '2/1/2026'],
    ['2026-03-29T23:30:00Z', '31/3/2026'],
    ['2026-10-25T00:30:00Z', '26/10/2026'],
    ['2026-10-25T01:30:00Z', '26/10/2026'],
    ['2026-12-31T23:30:00Z', '1/1/2027'],
  ])('renders UK tomorrow at %s as %s', (now, expected) => {
    jest.setSystemTime(new Date(now))

    expect(environment.renderString('{{ tomorrow() | formatUkDate }}', {})).toBe(expected)
  })

  it('recomputes tomorrow on each render after UK midnight', () => {
    jest.setSystemTime(new Date('2026-07-01T22:59:00Z'))
    expect(environment.renderString('{{ tomorrow() | formatUkDate }}', {})).toBe('2/7/2026')

    jest.setSystemTime(new Date('2026-07-01T23:01:00Z'))
    expect(environment.renderString('{{ tomorrow() | formatUkDate }}', {})).toBe('3/7/2026')
  })
})
