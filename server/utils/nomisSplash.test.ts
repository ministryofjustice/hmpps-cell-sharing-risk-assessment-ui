import {
  CASELOAD_CONDITION,
  deriveNomisState,
  isNomisScreenState,
  combineNomisStates,
  NOMIS_CSRA_MODULES,
  NomisScreenNotSetUpError,
  nomisStateSuccessMessage,
} from './nomisSplash'
import type { NomisScreenState } from './nomisSplash'
import type { SplashScreenCondition } from '../data/prisonApiTypes'

const caseload = (conditionValue: string, blockAccess: boolean): SplashScreenCondition => ({
  conditionType: CASELOAD_CONDITION,
  conditionValue,
  blockAccess,
})

describe('deriveNomisState', () => {
  it('is NORMAL when the prison has no condition', () => {
    expect(deriveNomisState([caseload('LEI', true)], 'MDI')).toBe('NORMAL')
  })

  it('is NORMAL when there are no conditions at all', () => {
    expect(deriveNomisState([], 'MDI')).toBe('NORMAL')
  })

  it('is WARNING when the condition does not block access', () => {
    expect(deriveNomisState([caseload('MDI', false)], 'MDI')).toBe('WARNING')
  })

  it('is BLOCKED when the condition blocks access', () => {
    expect(deriveNomisState([caseload('MDI', true)], 'MDI')).toBe('BLOCKED')
  })

  it('ignores conditions of another type that happen to name the prison', () => {
    const other: SplashScreenCondition = { conditionType: 'USER', conditionValue: 'MDI', blockAccess: true }

    expect(deriveNomisState([other], 'MDI')).toBe('NORMAL')
  })
})

describe('isNomisScreenState', () => {
  it.each([
    ['NORMAL', true],
    ['WARNING', true],
    ['BLOCKED', true],
    ['blocked', false],
    ['SOMETHING', false],
    ['', false],
    [undefined, false],
    [null, false],
    [1, false],
  ])('is %j -> %s', (value, expected) => {
    expect(isNomisScreenState(value)).toBe(expected)
  })
})

describe('nomisStateSuccessMessage', () => {
  it.each([
    ['BLOCKED' as const, 'NOMIS CSRA access is now blocked for Leeds (HMP).'],
    ['WARNING' as const, 'A NOMIS CSRA closure warning is now showing for Leeds (HMP).'],
    ['NORMAL' as const, 'NOMIS CSRA access is back to normal for Leeds (HMP).'],
  ])('describes %s', (state, expected) => {
    expect(nomisStateSuccessMessage('Leeds (HMP)', state)).toBe(expected)
  })
})

describe('combineNomisStates', () => {
  it.each([
    [['NORMAL', 'NORMAL'], 'NORMAL'],
    [['BLOCKED', 'BLOCKED'], 'BLOCKED'],
    [['WARNING', 'WARNING'], 'WARNING'],
  ])('reports %j as %s when the screens agree', (states, expected) => {
    expect(combineNomisStates(states as NomisScreenState[])).toBe(expected)
  })

  it.each([[['BLOCKED', 'NORMAL']], [['WARNING', 'BLOCKED']], [['NORMAL', 'WARNING']]])(
    'reports %j as MIXED when the screens disagree',
    states => {
      expect(combineNomisStates(states as NomisScreenState[])).toBe('MIXED')
    },
  )

  it('reports no screens as NORMAL', () => {
    expect(combineNomisStates([])).toBe('NORMAL')
  })
})

describe('NOMIS_CSRA_MODULES', () => {
  it('covers both screens CSRA replaces', () => {
    expect(NOMIS_CSRA_MODULES).toEqual(['OCDNOQUE', 'OIDCAPPR'])
  })
})

describe('NomisScreenNotSetUpError', () => {
  it('names the missing screens so the admin knows what to create in NOMIS', () => {
    const error = new NomisScreenNotSetUpError(['OCDNOQUE', 'OIDCAPPR'])

    expect(error.name).toBe('NomisScreenNotSetUpError')
    expect(error.missingModules).toEqual(['OCDNOQUE', 'OIDCAPPR'])
    expect(error.message).toContain('OCDNOQUE')
    expect(error.message).toContain('OIDCAPPR')
  })
})
