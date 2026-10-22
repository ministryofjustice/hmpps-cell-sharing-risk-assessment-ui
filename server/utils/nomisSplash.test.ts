import {
  activeSuccessMessage,
  approvalStepSuccessMessage,
  CASELOAD_CONDITION,
  deriveApprovalStep,
  deriveNomisState,
  derivePrisonState,
  expectedScreenState,
  isBlockedInNomis,
  isNomisApprovalStep,
  isSwitchedOn,
  NOMIS_APPROVAL_MODULE,
  NOMIS_AUTO_APPROVAL_SWITCH,
  NOMIS_CSRA_MODULES,
  NOMIS_CSRA_SWITCH,
  NomisPrisonOnDpsError,
  NomisScreenNotSetUpError,
  NomisSwitchNotSetUpError,
} from './nomisSplash'
import type { NomisScreen, NomisSwitches } from './nomisSplash'
import type { SplashScreenCondition } from '../data/prisonApiTypes'

const caseload = (conditionValue: string, blockAccess: boolean): SplashScreenCondition => ({
  conditionType: CASELOAD_CONDITION,
  conditionValue,
  blockAccess,
})

const screen = (moduleName: string, conditions: SplashScreenCondition[]): NomisScreen => ({ moduleName, conditions })

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

describe('config', () => {
  it('covers both screens CSRA replaces, with OIDCAPPR as the approval screen', () => {
    expect(NOMIS_CSRA_MODULES).toEqual(['OCDNOQUE', 'OIDCAPPR'])
    expect(NOMIS_APPROVAL_MODULE).toBe('OIDCAPPR')
  })

  it('uses the switch codes from Syscon CR 502', () => {
    expect(NOMIS_CSRA_SWITCH).toBe('CSRA')
    expect(NOMIS_AUTO_APPROVAL_SWITCH).toBe('CSRA_AUTO_APPROVAL')
  })
})

describe('isNomisApprovalStep', () => {
  it.each([
    ['REQUIRED', true],
    ['NOT_REQUIRED', true],
    ['required', false],
    ['', false],
    [undefined, false],
  ])('is %j -> %s', (value, expected) => {
    expect(isNomisApprovalStep(value)).toBe(expected)
  })
})

describe('isSwitchedOn', () => {
  it('is on for a prison on the list', () => {
    expect(isSwitchedOn(['LEI', 'MDI'], 'MDI')).toBe(true)
  })

  it('is off for a prison not on the list', () => {
    expect(isSwitchedOn(['LEI'], 'MDI')).toBe(false)
  })

  it('is on for every prison when switched on for *ALL*', () => {
    expect(isSwitchedOn(['*ALL*'], 'MDI')).toBe(true)
  })
})

describe('deriveApprovalStep', () => {
  it('is NOT_REQUIRED when the auto-approval switch is on for the prison', () => {
    expect(deriveApprovalStep({ csra: [], autoApproval: ['MDI'] }, 'MDI')).toBe('NOT_REQUIRED')
  })

  it('is REQUIRED when it is not', () => {
    expect(deriveApprovalStep({ csra: ['MDI'], autoApproval: [] }, 'MDI')).toBe('REQUIRED')
  })

  it('is REQUIRED when the switches cannot be read, as NOMIS then has no way to drop the step', () => {
    expect(deriveApprovalStep(null, 'MDI')).toBe('REQUIRED')
  })
})

describe('expectedScreenState', () => {
  it.each([
    ['OCDNOQUE', true, 'REQUIRED', 'BLOCKED'],
    ['OIDCAPPR', true, 'REQUIRED', 'BLOCKED'],
    ['OIDCAPPR', true, 'NOT_REQUIRED', 'BLOCKED'],
    ['OCDNOQUE', false, 'REQUIRED', 'NORMAL'],
    ['OIDCAPPR', false, 'REQUIRED', 'NORMAL'],
    ['OCDNOQUE', false, 'NOT_REQUIRED', 'NORMAL'],
    ['OIDCAPPR', false, 'NOT_REQUIRED', 'BLOCKED'],
  ] as const)('%s with DPS on %s and approval %s is %s', (moduleName, active, approval, expected) => {
    expect(expectedScreenState(moduleName, active, approval)).toBe(expected)
  })
})

describe('isBlockedInNomis', () => {
  it('is true when the screens other than the approval screen are blocked', () => {
    expect(isBlockedInNomis([screen('OCDNOQUE', [caseload('MDI', true)]), screen('OIDCAPPR', [])], 'MDI')).toBe(true)
  })

  it('is false when only the approval screen is blocked, as for a prison with no approval step', () => {
    expect(isBlockedInNomis([screen('OCDNOQUE', []), screen('OIDCAPPR', [caseload('MDI', true)])], 'MDI')).toBe(false)
  })

  it('is false for a warning', () => {
    expect(isBlockedInNomis([screen('OCDNOQUE', [caseload('MDI', false)])], 'MDI')).toBe(false)
  })
})

describe('derivePrisonState', () => {
  const screens = (questionnaire: SplashScreenCondition[], approval: SplashScreenCondition[]): NomisScreen[] => [
    screen('OCDNOQUE', questionnaire),
    screen('OIDCAPPR', approval),
  ]
  const switches = (csra: string[] = [], autoApproval: string[] = []): NomisSwitches => ({ csra, autoApproval })
  const blocked = [caseload('MDI', true)]
  const warning = [caseload('MDI', false)]

  it.each([
    ['on NOMIS with nothing set', screens([], []), switches(), false, 'REQUIRED'],
    ['on NOMIS with no approval step', screens([], blocked), switches([], ['MDI']), false, 'NOT_REQUIRED'],
    ['on DPS', screens(blocked, blocked), switches(['MDI']), true, 'REQUIRED'],
    [
      'on DPS, having had no approval step',
      screens(blocked, blocked),
      switches(['MDI'], ['MDI']),
      true,
      'NOT_REQUIRED',
    ],
  ] as const)('reads a prison %s as matching', (_description, prisonScreens, prisonSwitches, active, approval) => {
    expect(derivePrisonState(prisonScreens, prisonSwitches, 'MDI', active)).toEqual({ approval, matchesDps: true })
  })

  it.each([
    ['on DPS but open in NOMIS', screens([], []), switches(), true],
    ['on DPS, blocked, without the CSRA switch', screens(blocked, blocked), switches(), true],
    ['on DPS with only one screen blocked', screens(blocked, []), switches(['MDI']), true],
    ['off DPS but blocked in NOMIS', screens(blocked, blocked), switches(['MDI']), false],
    ['off DPS with the CSRA switch left on', screens([], []), switches(['MDI']), false],
    ['off DPS with the approval screen blocked and no switch to explain it', screens([], blocked), switches(), false],
    ['off DPS with no approval step but the approval screen open', screens([], []), switches([], ['MDI']), false],
    ['showing a warning left by the old page', screens(warning, warning), switches(), false],
  ] as const)('reads a prison %s as needing attention', (_description, prisonScreens, prisonSwitches, active) => {
    expect(derivePrisonState(prisonScreens, prisonSwitches, 'MDI', active).matchesDps).toBe(false)
  })

  it('ignores the CSRA switch when the switches cannot be read, as before they existed', () => {
    expect(derivePrisonState(screens(blocked, blocked), null, 'MDI', true)).toEqual({
      approval: 'REQUIRED',
      matchesDps: true,
    })
  })
})

describe('activeSuccessMessage', () => {
  it.each([
    [true, 'CSRA is now switched on for Leeds (HMP). The NOMIS CSRA screens are blocked.'],
    [false, 'CSRA is now switched off for Leeds (HMP). The NOMIS CSRA screens are open again.'],
  ])('describes turning on = %s', (active, expected) => {
    expect(activeSuccessMessage('Leeds (HMP)', active)).toBe(expected)
  })
})

describe('approvalStepSuccessMessage', () => {
  it.each([
    [
      'NOT_REQUIRED' as const,
      'NOMIS CSRAs at Leeds (HMP) are now approved when they are saved, with no approval step.',
    ],
    ['REQUIRED' as const, 'NOMIS CSRAs at Leeds (HMP) need approving again.'],
  ])('describes %s', (approval, expected) => {
    expect(approvalStepSuccessMessage('Leeds (HMP)', approval)).toBe(expected)
  })
})

describe('errors', () => {
  it('NomisScreenNotSetUpError names the missing screens so the admin knows what to create in NOMIS', () => {
    const error = new NomisScreenNotSetUpError(['OCDNOQUE', 'OIDCAPPR'])

    expect(error.name).toBe('NomisScreenNotSetUpError')
    expect(error.missingModules).toEqual(['OCDNOQUE', 'OIDCAPPR'])
    expect(error.message).toContain('OCDNOQUE')
    expect(error.message).toContain('OIDCAPPR')
  })

  it('NomisSwitchNotSetUpError names the missing switches', () => {
    const error = new NomisSwitchNotSetUpError(['CSRA_AUTO_APPROVAL'])

    expect(error.name).toBe('NomisSwitchNotSetUpError')
    expect(error.missingSwitches).toEqual(['CSRA_AUTO_APPROVAL'])
    expect(error.message).toContain('CSRA_AUTO_APPROVAL')
  })

  it('NomisPrisonOnDpsError names the prison', () => {
    const error = new NomisPrisonOnDpsError('MDI')

    expect(error.name).toBe('NomisPrisonOnDpsError')
    expect(error.agencyId).toBe('MDI')
  })
})
