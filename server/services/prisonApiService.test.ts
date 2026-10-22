import PrisonApiService from './prisonApiService'
import type PrisonApiClient from '../data/prisonApiClient'
import type PrisonApiSplashClient from '../data/prisonApiSplashClient'
import type PrisonApiAgencySwitchClient from '../data/prisonApiAgencySwitchClient'
import {
  CASELOAD_CONDITION,
  NOMIS_AUTO_APPROVAL_SWITCH,
  NOMIS_CSRA_MODULES,
  NOMIS_CSRA_SWITCH,
  NomisPrisonOnDpsError,
  NomisScreenNotSetUpError,
} from '../utils/nomisSplash'
import type { SplashScreenCondition } from '../data/prisonApiTypes'

const [QUESTIONNAIRE, APPROVAL] = NOMIS_CSRA_MODULES

describe('PrisonApiService NOMIS CSRA screens', () => {
  const getSplashScreen = jest.fn()
  const addSplashCondition = jest.fn()
  const updateSplashCondition = jest.fn()
  const removeSplashCondition = jest.fn()
  const getAgencySwitches = jest.fn()
  const addAgencySwitch = jest.fn()
  const removeAgencySwitch = jest.fn()

  const splashClient = {
    getSplashScreen,
    addSplashCondition,
    updateSplashCondition,
    removeSplashCondition,
  } as unknown as PrisonApiSplashClient

  const switchClient = {
    getAgencySwitches,
    addAgencySwitch,
    removeAgencySwitch,
  } as unknown as PrisonApiAgencySwitchClient

  const service = new PrisonApiService({} as PrisonApiClient, splashClient, switchClient)

  const caseload = (conditionValue: string, blockAccess: boolean): SplashScreenCondition => ({
    conditionType: CASELOAD_CONDITION,
    conditionValue,
    blockAccess,
  })

  /** Both screens carry the same conditions. */
  const stubBothScreens = (conditions: SplashScreenCondition[]) =>
    getSplashScreen.mockImplementation((_username, { moduleName }) => Promise.resolve({ moduleName, conditions }))

  /** The screens differ, either by design (no approval step) or because one was changed elsewhere. */
  const stubScreensSeparately = (byModule: Record<string, SplashScreenCondition[]>) =>
    getSplashScreen.mockImplementation((_username, { moduleName }) =>
      Promise.resolve({ moduleName, conditions: byModule[moduleName] ?? [] }),
    )

  /** The agencies each switch is on for. */
  const stubSwitches = ({ csra = [], autoApproval = [] }: { csra?: string[]; autoApproval?: string[] } = {}) =>
    getAgencySwitches.mockImplementation((_username, { serviceCode }) =>
      Promise.resolve((serviceCode === NOMIS_CSRA_SWITCH ? csra : autoApproval).map(agencyId => ({ agencyId }))),
    )

  const notFound = () => Object.assign(new Error('Not Found'), { responseStatus: 404 })

  /** The switches are not in this NOMIS environment yet (Syscon CR 502 not applied). */
  const stubSwitchesNotSetUp = () => getAgencySwitches.mockRejectedValue(notFound())

  const nothingChanged = () => {
    expect(addSplashCondition).not.toHaveBeenCalled()
    expect(updateSplashCondition).not.toHaveBeenCalled()
    expect(removeSplashCondition).not.toHaveBeenCalled()
    expect(addAgencySwitch).not.toHaveBeenCalled()
    expect(removeAgencySwitch).not.toHaveBeenCalled()
  }

  beforeEach(() => {
    // Reset, not just clear, so a rejection stubbed by one test cannot leak into the next.
    jest.resetAllMocks()
    stubSwitches()
  })

  describe('getNomisReadings', () => {
    it('reads every module and both switches, whatever the number of prisons', async () => {
      stubBothScreens([caseload('MDI', true), caseload('LEI', false)])

      await service.getNomisReadings('user1')

      expect(getSplashScreen).toHaveBeenCalledTimes(2)
      expect(getSplashScreen).toHaveBeenCalledWith('user1', { moduleName: QUESTIONNAIRE })
      expect(getSplashScreen).toHaveBeenCalledWith('user1', { moduleName: APPROVAL })
      expect(getAgencySwitches).toHaveBeenCalledTimes(2)
      expect(getAgencySwitches).toHaveBeenCalledWith('user1', { serviceCode: NOMIS_CSRA_SWITCH })
      expect(getAgencySwitches).toHaveBeenCalledWith('user1', { serviceCode: NOMIS_AUTO_APPROVAL_SWITCH })
    })

    it('returns the screens and the agencies on each switch', async () => {
      stubBothScreens([caseload('MDI', true)])
      stubSwitches({ csra: ['MDI'], autoApproval: ['LEI'] })

      expect(await service.getNomisReadings('user1')).toEqual({
        screens: [
          { moduleName: QUESTIONNAIRE, conditions: [caseload('MDI', true)] },
          { moduleName: APPROVAL, conditions: [caseload('MDI', true)] },
        ],
        switches: { csra: ['MDI'], autoApproval: ['LEI'] },
      })
    })

    it('copes with a screen that has no conditions', async () => {
      getSplashScreen.mockImplementation((_username, { moduleName }) => Promise.resolve({ moduleName }))

      expect((await service.getNomisReadings('user1')).screens).toEqual([
        { moduleName: QUESTIONNAIRE, conditions: [] },
        { moduleName: APPROVAL, conditions: [] },
      ])
    })

    it('returns null when any screen cannot be read, rather than understating the state', async () => {
      getSplashScreen.mockImplementation((_username, { moduleName }) =>
        moduleName === APPROVAL
          ? Promise.reject(new Error('prison-api down'))
          : Promise.resolve({ moduleName, conditions: [] }),
      )

      expect(await service.getNomisReadings('user1')).toBeNull()
    })

    it('still returns the screens when the switches cannot be read', async () => {
      stubBothScreens([])
      stubSwitchesNotSetUp()

      expect(await service.getNomisReadings('user1')).toEqual({
        screens: expect.any(Array),
        switches: null,
      })
    })
  })

  describe('setPrisonOnDps', () => {
    const changeDps = jest.fn()

    beforeEach(() => changeDps.mockResolvedValue(undefined))

    /** Every write, in the order it was made. */
    const writeOrder = () =>
      [
        ...addSplashCondition.mock.invocationCallOrder.map(order => ({ order, call: 'block screen' })),
        ...updateSplashCondition.mock.invocationCallOrder.map(order => ({ order, call: 'update screen' })),
        ...removeSplashCondition.mock.invocationCallOrder.map(order => ({ order, call: 'open screen' })),
        ...addAgencySwitch.mock.invocationCallOrder.map(order => ({ order, call: 'add switch' })),
        ...removeAgencySwitch.mock.invocationCallOrder.map(order => ({ order, call: 'remove switch' })),
        ...changeDps.mock.invocationCallOrder.map(order => ({ order, call: 'DPS' })),
      ]
        .sort((a, b) => a.order - b.order)
        .map(({ call }) => call)

    describe('turning on', () => {
      it('blocks every screen, adds the CSRA switch, then turns DPS on', async () => {
        stubBothScreens([])

        const change = await service.setPrisonOnDps('user1', 'MDI', true, changeDps)

        NOMIS_CSRA_MODULES.forEach(moduleName => {
          expect(addSplashCondition).toHaveBeenCalledWith(
            'user1',
            { moduleName },
            { conditionType: CASELOAD_CONDITION, conditionValue: 'MDI', blockAccess: true },
          )
        })
        expect(addAgencySwitch).toHaveBeenCalledWith('user1', { serviceCode: NOMIS_CSRA_SWITCH, agencyId: 'MDI' })
        expect(writeOrder()).toEqual(['block screen', 'block screen', 'add switch', 'DPS'])
        expect(change).toEqual({
          screens: { [QUESTIONNAIRE]: 'BLOCKED', [APPROVAL]: 'BLOCKED' },
          switches: { [NOMIS_CSRA_SWITCH]: true },
        })
      })

      it('only blocks the questionnaire for a prison whose approval screen is already blocked', async () => {
        stubScreensSeparately({ [APPROVAL]: [caseload('MDI', true)] })
        stubSwitches({ autoApproval: ['MDI'] })

        await service.setPrisonOnDps('user1', 'MDI', true, changeDps)

        expect(addSplashCondition).toHaveBeenCalledTimes(1)
        expect(addSplashCondition).toHaveBeenCalledWith(
          'user1',
          { moduleName: QUESTIONNAIRE },
          { conditionType: CASELOAD_CONDITION, conditionValue: 'MDI', blockAccess: true },
        )
      })

      it('turns a warning left by the old page into a block', async () => {
        stubBothScreens([caseload('MDI', false)])

        await service.setPrisonOnDps('user1', 'MDI', true, changeDps)

        expect(updateSplashCondition).toHaveBeenCalledTimes(2)
        expect(updateSplashCondition).toHaveBeenCalledWith('user1', {
          moduleName: QUESTIONNAIRE,
          conditionType: CASELOAD_CONDITION,
          conditionValue: 'MDI',
          blockAccess: 'true',
        })
      })

      it('only turns DPS on when NOMIS is already blocked, so pressing it again is safe', async () => {
        stubBothScreens([caseload('MDI', true)])
        stubSwitches({ csra: ['MDI'] })

        await service.setPrisonOnDps('user1', 'MDI', true, changeDps)

        expect(writeOrder()).toEqual(['DPS'])
      })

      it('treats the CSRA switch already being on (409) as success', async () => {
        stubBothScreens([])
        addAgencySwitch.mockRejectedValue(Object.assign(new Error('Conflict'), { responseStatus: 409 }))

        await service.setPrisonOnDps('user1', 'MDI', true, changeDps)

        expect(changeDps).toHaveBeenCalled()
      })

      it('leaves DPS off when blocking NOMIS fails', async () => {
        stubBothScreens([])
        addSplashCondition.mockRejectedValue(new Error('prison-api down'))

        await expect(service.setPrisonOnDps('user1', 'MDI', true, changeDps)).rejects.toThrow('prison-api down')
        expect(changeDps).not.toHaveBeenCalled()
      })

      it('blocks only the screens when the switches are not set up in NOMIS yet', async () => {
        stubBothScreens([])
        stubSwitchesNotSetUp()

        const change = await service.setPrisonOnDps('user1', 'MDI', true, changeDps)

        expect(writeOrder()).toEqual(['block screen', 'block screen', 'DPS'])
        expect(change.switches).toEqual({})
      })
    })

    describe('turning off', () => {
      it('turns DPS off, removes the CSRA switch, then opens every screen', async () => {
        stubBothScreens([caseload('MDI', true)])
        stubSwitches({ csra: ['MDI'] })

        const change = await service.setPrisonOnDps('user1', 'MDI', false, changeDps)

        NOMIS_CSRA_MODULES.forEach(moduleName => {
          expect(removeSplashCondition).toHaveBeenCalledWith('user1', {
            moduleName,
            conditionType: CASELOAD_CONDITION,
            conditionValue: 'MDI',
          })
        })
        expect(removeAgencySwitch).toHaveBeenCalledWith('user1', { serviceCode: NOMIS_CSRA_SWITCH, agencyId: 'MDI' })
        expect(writeOrder()).toEqual(['DPS', 'remove switch', 'open screen', 'open screen'])
        expect(change).toEqual({
          screens: { [QUESTIONNAIRE]: 'NORMAL', [APPROVAL]: 'NORMAL' },
          switches: { [NOMIS_CSRA_SWITCH]: false },
        })
      })

      it('returns a prison with no approval step to that process, approval screen still blocked', async () => {
        stubBothScreens([caseload('MDI', true)])
        stubSwitches({ csra: ['MDI'], autoApproval: ['MDI'] })

        const change = await service.setPrisonOnDps('user1', 'MDI', false, changeDps)

        expect(removeSplashCondition).toHaveBeenCalledTimes(1)
        expect(removeSplashCondition).toHaveBeenCalledWith('user1', {
          moduleName: QUESTIONNAIRE,
          conditionType: CASELOAD_CONDITION,
          conditionValue: 'MDI',
        })
        expect(removeAgencySwitch).toHaveBeenCalledTimes(1)
        expect(change.screens).toEqual({ [QUESTIONNAIRE]: 'NORMAL', [APPROVAL]: 'BLOCKED' })
      })

      it('leaves NOMIS blocked when turning DPS off fails', async () => {
        stubBothScreens([caseload('MDI', true)])
        stubSwitches({ csra: ['MDI'] })
        changeDps.mockRejectedValue(new Error('CSRA API down'))

        await expect(service.setPrisonOnDps('user1', 'MDI', false, changeDps)).rejects.toThrow('CSRA API down')
        expect(removeSplashCondition).not.toHaveBeenCalled()
        expect(removeAgencySwitch).not.toHaveBeenCalled()
      })
    })

    it('reports which screens are not set up in NOMIS, changing nothing, DPS included', async () => {
      getSplashScreen.mockImplementation((_username, { moduleName }) =>
        moduleName === APPROVAL ? Promise.reject(notFound()) : Promise.resolve({ moduleName, conditions: [] }),
      )

      await expect(service.setPrisonOnDps('user1', 'MDI', true, changeDps)).rejects.toMatchObject({
        name: 'NomisScreenNotSetUpError',
        missingModules: [APPROVAL],
      })
      nothingChanged()
      expect(changeDps).not.toHaveBeenCalled()
    })

    it('propagates any other failure reading the switches, changing nothing', async () => {
      stubBothScreens([])
      getAgencySwitches.mockRejectedValue(Object.assign(new Error('Forbidden'), { responseStatus: 403 }))

      await expect(service.setPrisonOnDps('user1', 'MDI', true, changeDps)).rejects.toThrow('Forbidden')
      nothingChanged()
      expect(changeDps).not.toHaveBeenCalled()
    })

    it('propagates any other failure reading the screens', async () => {
      getSplashScreen.mockRejectedValue(Object.assign(new Error('Forbidden'), { responseStatus: 403 }))

      await expect(service.setPrisonOnDps('user1', 'MDI', true, changeDps)).rejects.toThrow('Forbidden')
      expect(changeDps).not.toHaveBeenCalled()
    })
  })

  describe('setApprovalStep', () => {
    it('adds the auto-approval switch, then blocks the approval screen, leaving the questionnaire alone', async () => {
      stubBothScreens([])

      const change = await service.setApprovalStep('user1', 'MDI', 'NOT_REQUIRED')

      expect(addAgencySwitch).toHaveBeenCalledWith('user1', {
        serviceCode: NOMIS_AUTO_APPROVAL_SWITCH,
        agencyId: 'MDI',
      })
      expect(addSplashCondition).toHaveBeenCalledTimes(1)
      expect(addSplashCondition).toHaveBeenCalledWith(
        'user1',
        { moduleName: APPROVAL },
        { conditionType: CASELOAD_CONDITION, conditionValue: 'MDI', blockAccess: true },
      )
      expect(addAgencySwitch.mock.invocationCallOrder[0]).toBeLessThan(addSplashCondition.mock.invocationCallOrder[0])
      expect(change).toEqual({
        screens: { [APPROVAL]: 'BLOCKED' },
        switches: { [NOMIS_AUTO_APPROVAL_SWITCH]: true },
      })
    })

    it('opens the approval screen, then removes the switch, when restoring the step', async () => {
      stubScreensSeparately({ [APPROVAL]: [caseload('MDI', true)] })
      stubSwitches({ autoApproval: ['MDI'] })

      const change = await service.setApprovalStep('user1', 'MDI', 'REQUIRED')

      expect(removeSplashCondition).toHaveBeenCalledTimes(1)
      expect(removeSplashCondition).toHaveBeenCalledWith('user1', {
        moduleName: APPROVAL,
        conditionType: CASELOAD_CONDITION,
        conditionValue: 'MDI',
      })
      expect(removeAgencySwitch).toHaveBeenCalledWith('user1', {
        serviceCode: NOMIS_AUTO_APPROVAL_SWITCH,
        agencyId: 'MDI',
      })
      expect(removeSplashCondition.mock.invocationCallOrder[0]).toBeLessThan(
        removeAgencySwitch.mock.invocationCallOrder[0],
      )
      expect(change.screens).toEqual({ [APPROVAL]: 'NORMAL' })
    })

    it('does nothing when the prison already has no approval step', async () => {
      stubScreensSeparately({ [APPROVAL]: [caseload('MDI', true)] })
      stubSwitches({ autoApproval: ['MDI'] })

      await service.setApprovalStep('user1', 'MDI', 'NOT_REQUIRED')

      nothingChanged()
    })

    it('is refused, changing nothing, for a prison blocked in NOMIS because it is on DPS', async () => {
      stubBothScreens([caseload('MDI', true)])
      stubSwitches({ csra: ['MDI'] })

      await expect(service.setApprovalStep('user1', 'MDI', 'NOT_REQUIRED')).rejects.toThrow(NomisPrisonOnDpsError)
      nothingChanged()
    })

    it('treats the switch already being on (409) as success', async () => {
      stubBothScreens([])
      addAgencySwitch.mockRejectedValue(Object.assign(new Error('Conflict'), { responseStatus: 409 }))

      await service.setApprovalStep('user1', 'MDI', 'NOT_REQUIRED')

      expect(addSplashCondition).toHaveBeenCalledTimes(1)
    })

    it('stops on any other failure adding the switch, before blocking the screen', async () => {
      stubBothScreens([])
      addAgencySwitch.mockRejectedValue(Object.assign(new Error('Server Error'), { responseStatus: 500 }))

      await expect(service.setApprovalStep('user1', 'MDI', 'NOT_REQUIRED')).rejects.toThrow('Server Error')
      expect(addSplashCondition).not.toHaveBeenCalled()
    })

    it('reports which switches are not set up in NOMIS, changing nothing', async () => {
      stubBothScreens([])
      getAgencySwitches.mockImplementation((_username, { serviceCode }) =>
        serviceCode === NOMIS_AUTO_APPROVAL_SWITCH ? Promise.reject(notFound()) : Promise.resolve([]),
      )

      await expect(service.setApprovalStep('user1', 'MDI', 'NOT_REQUIRED')).rejects.toMatchObject({
        name: 'NomisSwitchNotSetUpError',
        missingSwitches: [NOMIS_AUTO_APPROVAL_SWITCH],
      })
      nothingChanged()
    })

    it('reports a missing screen as NomisScreenNotSetUpError, changing nothing', async () => {
      getSplashScreen.mockRejectedValue(notFound())

      await expect(service.setApprovalStep('user1', 'MDI', 'NOT_REQUIRED')).rejects.toThrow(NomisScreenNotSetUpError)
      nothingChanged()
    })
  })
})
