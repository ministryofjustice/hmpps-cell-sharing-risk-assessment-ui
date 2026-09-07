import type { SanitisedError } from '@ministryofjustice/hmpps-rest-client'
import { PrisonApiClient, PrisonApiSplashClient } from '../data'
import type { PrisonerImage } from '../data/prisonApiClient'
import type { SplashScreenCondition } from '../data/prisonApiTypes'
import {
  CASELOAD_CONDITION,
  combineNomisStates,
  deriveNomisState,
  NOMIS_CSRA_MODULES,
  NomisScreenNotSetUpError,
  type NomisCombinedState,
  type NomisScreenState,
} from '../utils/nomisSplash'
import logger from '../../logger'

export default class PrisonApiService {
  constructor(
    private readonly prisonApiClient: PrisonApiClient,
    private readonly prisonApiSplashClient: PrisonApiSplashClient,
  ) {}

  /**
   * Fetch a prisoner's photo. `username` is stamped onto the system token used for the call
   * (see PrisonApiClient.getPrisonerImage).
   */
  getPrisonerImage(username: string, prisonerNumber: string): Promise<PrisonerImage> {
    return this.prisonApiClient.getPrisonerImage(username, prisonerNumber)
  }

  /**
   * Read each prison's combined NOMIS CSRA screen state from the caseload conditions on every module.
   *
   * Returns a prisonId -> state map, or `null` when any screen cannot be read (not set up yet, missing
   * role, or prison-api down). It is all-or-nothing on purpose: a partial read would show some prisons
   * as Normal purely because one screen was unreadable, understating what staff can still reach in
   * NOMIS. The admin list degrades to an "unavailable" notice instead.
   */
  async getNomisScreenStates(username: string): Promise<Map<string, NomisCombinedState> | null> {
    let screens: { moduleName: string; conditions: SplashScreenCondition[] }[]
    try {
      screens = await this.readAllScreens(username)
    } catch (error) {
      logger.warn(`Failed to read NOMIS CSRA splash screens: ${(error as Error).message}`)
      return null
    }

    // Every prison named on any screen, so a prison set on one module but not another still appears
    // (and shows as MIXED) rather than silently reading as Normal.
    const agencyIds = new Set(
      screens.flatMap(screen =>
        screen.conditions.filter(c => c.conditionType === CASELOAD_CONDITION).map(c => c.conditionValue),
      ),
    )

    const states = new Map<string, NomisCombinedState>()
    for (const agencyId of agencyIds) {
      states.set(agencyId, combineNomisStates(screens.map(screen => deriveNomisState(screen.conditions, agencyId))))
    }
    return states
  }

  /**
   * Move a prison's NOMIS CSRA screens to the target state. Both screens are retired by the same
   * rollout step, so they are always set together.
   *
   * Every screen is read up front, so a missing splash screen fails before anything is changed rather
   * than leaving the prison blocked on one screen and open on another. Each screen is then brought to
   * the target state individually, which keeps the change idempotent and repairs a MIXED prison:
   * conditions are added, updated or removed to suit, and a screen already in the target is left alone.
   */
  async setNomisScreenState(username: string, agencyId: string, target: NomisScreenState): Promise<void> {
    const screens = await this.readAllScreensForWrite(username)

    // A screen already in the target state is left untouched, which keeps the change idempotent and
    // lets a MIXED prison be repaired by moving only the screen that is out of step. The screens are
    // independent, so the remaining changes are applied together.
    const outOfStep = screens
      .map(({ moduleName, conditions }) => ({ moduleName, current: deriveNomisState(conditions, agencyId) }))
      .filter(({ current }) => current !== target)

    await Promise.all(
      outOfStep.map(({ moduleName, current }) => this.applyState(username, moduleName, agencyId, current, target)),
    )
  }

  /** Adds, updates or removes one screen's caseload condition to bring it to [target]. */
  private applyState(
    username: string,
    moduleName: string,
    agencyId: string,
    current: NomisScreenState,
    target: NomisScreenState,
  ): Promise<unknown> {
    if (target === 'NORMAL') {
      return this.prisonApiSplashClient.removeSplashCondition(username, {
        moduleName,
        conditionType: CASELOAD_CONDITION,
        conditionValue: agencyId,
      })
    }

    const blockAccess = target === 'BLOCKED'
    if (current === 'NORMAL') {
      return this.prisonApiSplashClient.addSplashCondition(
        username,
        { moduleName },
        { conditionType: CASELOAD_CONDITION, conditionValue: agencyId, blockAccess },
      )
    }
    return this.prisonApiSplashClient.updateSplashCondition(username, {
      moduleName,
      conditionType: CASELOAD_CONDITION,
      conditionValue: agencyId,
      blockAccess: String(blockAccess),
    })
  }

  private async readAllScreens(username: string) {
    return Promise.all(
      NOMIS_CSRA_MODULES.map(async moduleName => {
        const screen = await this.prisonApiSplashClient.getSplashScreen(username, { moduleName })
        return { moduleName, conditions: screen.conditions ?? [] }
      }),
    )
  }

  /**
   * Reads every screen, reporting the ones NOMIS does not have yet as a NomisScreenNotSetUpError the
   * console can explain. Any other failure is genuine and surfaces as an error page.
   */
  private async readAllScreensForWrite(username: string) {
    const results = await Promise.all(
      NOMIS_CSRA_MODULES.map(async moduleName => {
        try {
          const screen = await this.prisonApiSplashClient.getSplashScreen(username, { moduleName })
          return { moduleName, conditions: screen.conditions ?? [], missing: false }
        } catch (error) {
          if ((error as SanitisedError).responseStatus === 404) {
            return { moduleName, conditions: [] as SplashScreenCondition[], missing: true }
          }
          throw error
        }
      }),
    )

    const missing = results.filter(result => result.missing).map(result => result.moduleName)
    if (missing.length) throw new NomisScreenNotSetUpError(missing)
    return results
  }
}
