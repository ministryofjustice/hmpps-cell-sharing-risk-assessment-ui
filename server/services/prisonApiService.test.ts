import PrisonApiService from './prisonApiService'
import type PrisonApiClient from '../data/prisonApiClient'
import type PrisonApiSplashClient from '../data/prisonApiSplashClient'
import { CASELOAD_CONDITION, NOMIS_CSRA_MODULES, NomisScreenNotSetUpError } from '../utils/nomisSplash'
import type { SplashScreenCondition } from '../data/prisonApiTypes'

const [QUESTIONNAIRE, APPROVAL] = NOMIS_CSRA_MODULES

describe('PrisonApiService NOMIS CSRA screens', () => {
  const getSplashScreen = jest.fn()
  const addSplashCondition = jest.fn()
  const updateSplashCondition = jest.fn()
  const removeSplashCondition = jest.fn()

  const splashClient = {
    getSplashScreen,
    addSplashCondition,
    updateSplashCondition,
    removeSplashCondition,
  } as unknown as PrisonApiSplashClient

  const service = new PrisonApiService({} as PrisonApiClient, splashClient)

  const caseload = (conditionValue: string, blockAccess: boolean): SplashScreenCondition => ({
    conditionType: CASELOAD_CONDITION,
    conditionValue,
    blockAccess,
  })

  /** Both screens carry the same conditions — the normal case, since they are always set together. */
  const stubBothScreens = (conditions: SplashScreenCondition[]) =>
    getSplashScreen.mockImplementation((_username, { moduleName }) => Promise.resolve({ moduleName, conditions }))

  /** The screens disagree, e.g. because one was changed outside this service. */
  const stubScreensSeparately = (byModule: Record<string, SplashScreenCondition[]>) =>
    getSplashScreen.mockImplementation((_username, { moduleName }) =>
      Promise.resolve({ moduleName, conditions: byModule[moduleName] ?? [] }),
    )

  const notFound = () => Object.assign(new Error('Not Found'), { responseStatus: 404 })

  beforeEach(() => jest.clearAllMocks())

  describe('getNomisScreenStates', () => {
    it('reads every module', async () => {
      stubBothScreens([])

      await service.getNomisScreenStates('user1')

      expect(getSplashScreen).toHaveBeenCalledWith('user1', { moduleName: QUESTIONNAIRE })
      expect(getSplashScreen).toHaveBeenCalledWith('user1', { moduleName: APPROVAL })
    })

    it('combines matching per-screen states into one state per prison', async () => {
      stubBothScreens([caseload('MDI', true), caseload('LEI', false)])

      expect(await service.getNomisScreenStates('user1')).toEqual(
        new Map([
          ['MDI', 'BLOCKED'],
          ['LEI', 'WARNING'],
        ]),
      )
    })

    it('reports a prison whose screens disagree as MIXED', async () => {
      stubScreensSeparately({
        [QUESTIONNAIRE]: [caseload('MDI', true)],
        [APPROVAL]: [],
      })

      expect(await service.getNomisScreenStates('user1')).toEqual(new Map([['MDI', 'MIXED']]))
    })

    it('ignores conditions that are not caseload-scoped', async () => {
      stubBothScreens([{ conditionType: 'USER', conditionValue: 'someone', blockAccess: true }])

      expect(await service.getNomisScreenStates('user1')).toEqual(new Map())
    })

    it('copes with a screen that has no conditions', async () => {
      getSplashScreen.mockImplementation((_username, { moduleName }) => Promise.resolve({ moduleName }))

      expect(await service.getNomisScreenStates('user1')).toEqual(new Map())
    })

    it('returns null when any screen cannot be read, rather than understating the state', async () => {
      getSplashScreen.mockImplementation((_username, { moduleName }) =>
        moduleName === APPROVAL
          ? Promise.reject(new Error('prison-api down'))
          : Promise.resolve({ moduleName, conditions: [] }),
      )

      expect(await service.getNomisScreenStates('user1')).toBeNull()
    })
  })

  describe('setNomisScreenState', () => {
    it('adds the condition to every screen when the prison is currently NORMAL', async () => {
      stubBothScreens([])

      await service.setNomisScreenState('user1', 'MDI', 'BLOCKED')

      expect(addSplashCondition).toHaveBeenCalledTimes(2)
      NOMIS_CSRA_MODULES.forEach(moduleName => {
        expect(addSplashCondition).toHaveBeenCalledWith(
          'user1',
          { moduleName },
          { conditionType: CASELOAD_CONDITION, conditionValue: 'MDI', blockAccess: true },
        )
      })
      expect(updateSplashCondition).not.toHaveBeenCalled()
      expect(removeSplashCondition).not.toHaveBeenCalled()
    })

    it('updates every existing condition when moving between WARNING and BLOCKED', async () => {
      stubBothScreens([caseload('MDI', false)])

      await service.setNomisScreenState('user1', 'MDI', 'BLOCKED')

      expect(updateSplashCondition).toHaveBeenCalledTimes(2)
      NOMIS_CSRA_MODULES.forEach(moduleName => {
        expect(updateSplashCondition).toHaveBeenCalledWith('user1', {
          moduleName,
          conditionType: CASELOAD_CONDITION,
          conditionValue: 'MDI',
          blockAccess: 'true',
        })
      })
      expect(addSplashCondition).not.toHaveBeenCalled()
    })

    it('removes the condition from every screen when returning to NORMAL', async () => {
      stubBothScreens([caseload('MDI', true)])

      await service.setNomisScreenState('user1', 'MDI', 'NORMAL')

      expect(removeSplashCondition).toHaveBeenCalledTimes(2)
      NOMIS_CSRA_MODULES.forEach(moduleName => {
        expect(removeSplashCondition).toHaveBeenCalledWith('user1', {
          moduleName,
          conditionType: CASELOAD_CONDITION,
          conditionValue: 'MDI',
        })
      })
    })

    it('does nothing when every screen is already in the target state', async () => {
      stubBothScreens([caseload('MDI', true)])

      await service.setNomisScreenState('user1', 'MDI', 'BLOCKED')

      expect(addSplashCondition).not.toHaveBeenCalled()
      expect(updateSplashCondition).not.toHaveBeenCalled()
      expect(removeSplashCondition).not.toHaveBeenCalled()
    })

    it('repairs a MIXED prison, touching only the screen that is out of step', async () => {
      stubScreensSeparately({
        [QUESTIONNAIRE]: [caseload('MDI', true)],
        [APPROVAL]: [],
      })

      await service.setNomisScreenState('user1', 'MDI', 'BLOCKED')

      // The questionnaire screen is already blocked, so only the approval screen is changed.
      expect(addSplashCondition).toHaveBeenCalledTimes(1)
      expect(addSplashCondition).toHaveBeenCalledWith(
        'user1',
        { moduleName: APPROVAL },
        { conditionType: CASELOAD_CONDITION, conditionValue: 'MDI', blockAccess: true },
      )
    })

    it('reports which screens are not set up in NOMIS', async () => {
      getSplashScreen.mockImplementation((_username, { moduleName }) =>
        moduleName === APPROVAL ? Promise.reject(notFound()) : Promise.resolve({ moduleName, conditions: [] }),
      )

      await expect(service.setNomisScreenState('user1', 'MDI', 'BLOCKED')).rejects.toMatchObject({
        name: 'NomisScreenNotSetUpError',
        missingModules: [APPROVAL],
      })
    })

    it('changes nothing when a screen is missing, rather than part-applying', async () => {
      getSplashScreen.mockImplementation((_username, { moduleName }) =>
        moduleName === APPROVAL ? Promise.reject(notFound()) : Promise.resolve({ moduleName, conditions: [] }),
      )

      await expect(service.setNomisScreenState('user1', 'MDI', 'BLOCKED')).rejects.toThrow(NomisScreenNotSetUpError)

      expect(addSplashCondition).not.toHaveBeenCalled()
      expect(updateSplashCondition).not.toHaveBeenCalled()
      expect(removeSplashCondition).not.toHaveBeenCalled()
    })

    it('propagates any other failure', async () => {
      getSplashScreen.mockRejectedValue(Object.assign(new Error('Forbidden'), { responseStatus: 403 }))

      await expect(service.setNomisScreenState('user1', 'MDI', 'BLOCKED')).rejects.toThrow('Forbidden')
    })
  })
})
