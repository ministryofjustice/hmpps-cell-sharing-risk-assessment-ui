import type { SanitisedError } from '@ministryofjustice/hmpps-rest-client'
import { PrisonApiAgencySwitchClient, PrisonApiClient, PrisonApiSplashClient } from '../data'
import type { PrisonerImage } from '../data/prisonApiClient'
import type { SplashScreenCondition } from '../data/prisonApiTypes'
import {
  ALL_AGENCIES,
  CASELOAD_CONDITION,
  deriveApprovalStep,
  deriveNomisState,
  expectedScreenState,
  isBlockedInNomis,
  isSwitchedOn,
  NOMIS_APPROVAL_MODULE,
  NOMIS_AUTO_APPROVAL_SWITCH,
  NOMIS_CSRA_MODULES,
  NOMIS_CSRA_SWITCH,
  NomisPrisonOnDpsError,
  NomisScreenNotSetUpError,
  NomisSwitchNotSetUpError,
  NomisSwitchSetNationallyError,
  type NomisApprovalStep,
  type NomisChange,
  type NomisScreen,
  type NomisScreenState,
  type NomisSwitches,
} from '../utils/nomisSplash'
import logger from '../../logger'

export default class PrisonApiService {
  constructor(
    private readonly prisonApiClient: PrisonApiClient,
    private readonly prisonApiSplashClient: PrisonApiSplashClient,
    private readonly prisonApiAgencySwitchClient: PrisonApiAgencySwitchClient,
  ) {}

  /**
   * Fetch a prisoner's photo. `username` is stamped onto the system token used for the call
   * (see PrisonApiClient.getPrisonerImage).
   */
  getPrisonerImage(username: string, prisonerNumber: string): Promise<PrisonerImage> {
    return this.prisonApiClient.getPrisonerImage(username, prisonerNumber)
  }

  /**
   * Read the NOMIS CSRA screens and switches, for the admin console to work out each prison's state
   * with derivePrisonState. A fixed number of calls, however many prisons there are.
   *
   * Returns `null` when any screen cannot be read (not set up yet, missing role, or prison-api down).
   * It is all-or-nothing on purpose: a partial read would show some prisons as Normal purely because one
   * screen was unreadable, understating what staff can still reach in NOMIS. The admin list degrades to
   * an "unavailable" notice instead.
   *
   * The switches degrade separately to `null`, since they only exist once Syscon CR 502 is applied to
   * that NOMIS environment. The screens are then shown and managed without them.
   */
  async getNomisReadings(username: string): Promise<{ screens: NomisScreen[]; switches: NomisSwitches | null } | null> {
    const [screens, switches] = await Promise.all([
      this.readAllScreens(username).catch((error): null => {
        logger.warn(`Failed to read NOMIS CSRA splash screens: ${(error as Error).message}`)
        return null
      }),
      this.readSwitches(username).catch((error): null => {
        logger.warn(`Failed to read NOMIS CSRA agency switches: ${(error as Error).message}`)
        return null
      }),
    ])
    return screens && { screens, switches }
  }

  /**
   * Turn a prison on or off in DPS, blocking or opening its NOMIS CSRA screens to match, so the two
   * systems never both accept a CSRA. `changeDps` makes the DPS change; it is run after NOMIS is blocked
   * when turning on, and before NOMIS is opened when turning off. If a later step fails, the prison shows
   * as needing attention and turning it on or off again finishes the change.
   *
   * On DPS, every screen
   * is blocked and the CSRA switch is on, so the NOMIS header shows "View in DPS". Off DPS, the screens
   * open again and the switch goes, except that the approval screen stays blocked for a prison with no
   * approval step, so the prison returns to the NOMIS process it was on before.
   *
   * Everything is read up front, so a missing splash screen fails before anything, DPS included, is
   * changed. Each
   * screen and switch is then brought to its target individually, which keeps the change safe to repeat
   * and repairs a prison that needs attention. Blocking changes the screens before adding the switch,
   * and opening removes the switch first, so the header never says "View in DPS" while the screens are
   * open.
   *
   * Where the switches do not exist in this NOMIS environment yet, only the screens are changed.
   */
  async setPrisonOnDps(
    username: string,
    agencyId: string,
    activeInDps: boolean,
    changeDps: () => Promise<unknown>,
  ): Promise<NomisChange> {
    const [screens, switches] = await Promise.all([
      this.readAllScreensForWrite(username),
      this.readSwitchesForWrite(username).catch((error): null => {
        if (error instanceof NomisSwitchNotSetUpError) return null
        throw error
      }),
    ])
    if (!activeInDps && switches?.csra.includes(ALL_AGENCIES)) {
      throw new NomisSwitchSetNationallyError(NOMIS_CSRA_SWITCH)
    }
    const approval = deriveApprovalStep(switches, agencyId)

    const change: NomisChange = {
      screens: Object.fromEntries(
        screens.map(({ moduleName }) => [moduleName, expectedScreenState(moduleName, activeInDps, approval)]),
      ),
      switches: switches ? { [NOMIS_CSRA_SWITCH]: activeInDps } : {},
    }

    const setSwitch = () =>
      switches && this.applySwitch(username, NOMIS_CSRA_SWITCH, switches.csra, agencyId, activeInDps)
    if (activeInDps) {
      await this.applyScreens(username, screens, agencyId, change.screens)
      await setSwitch()
      await changeDps()
    } else {
      await changeDps()
      await setSwitch()
      await this.applyScreens(username, screens, agencyId, change.screens)
    }

    return change
  }

  /**
   * Put a prison still on NOMIS on, or take it off, the process with no approval step: the auto-approval
   * switch, and the approval screen blocked for as long as the switch is on.
   *
   * Removing the step adds the switch before blocking the screen, and restoring it opens the screen
   * before removing the switch, so assessments are never left waiting for an approval that is blocked.
   * Refused for a prison blocked in NOMIS because it is on DPS, where the step does not apply.
   */
  async setApprovalStep(username: string, agencyId: string, approval: NomisApprovalStep): Promise<NomisChange> {
    const [screens, switches] = await Promise.all([
      this.readAllScreensForWrite(username),
      this.readSwitchesForWrite(username),
    ])
    if (isBlockedInNomis(screens, agencyId)) throw new NomisPrisonOnDpsError(agencyId)
    if (approval === 'REQUIRED' && switches.autoApproval.includes(ALL_AGENCIES)) {
      throw new NomisSwitchSetNationallyError(NOMIS_AUTO_APPROVAL_SWITCH)
    }

    const approvalScreens = screens.filter(screen => screen.moduleName === NOMIS_APPROVAL_MODULE)
    const notRequired = approval === 'NOT_REQUIRED'
    const change: NomisChange = {
      screens: Object.fromEntries(
        approvalScreens.map(({ moduleName }) => [moduleName, expectedScreenState(moduleName, false, approval)]),
      ),
      switches: { [NOMIS_AUTO_APPROVAL_SWITCH]: notRequired },
    }

    const setSwitch = () =>
      this.applySwitch(username, NOMIS_AUTO_APPROVAL_SWITCH, switches.autoApproval, agencyId, notRequired)
    if (notRequired) await setSwitch()
    await this.applyScreens(username, approvalScreens, agencyId, change.screens)
    if (!notRequired) await setSwitch()

    return change
  }

  /**
   * Brings each screen to its target. A screen already there is left untouched; the rest are
   * independent, so they are changed together.
   */
  private async applyScreens(
    username: string,
    screens: NomisScreen[],
    agencyId: string,
    targets: Record<string, NomisScreenState>,
  ): Promise<void> {
    await Promise.all(
      screens
        .map(({ moduleName, conditions }) => ({
          moduleName,
          current: deriveNomisState(conditions, agencyId),
          target: targets[moduleName],
        }))
        .filter(({ current, target }) => current !== target)
        .map(({ moduleName, current, target }) => this.applyState(username, moduleName, agencyId, current, target)),
    )
  }

  /**
   * Switches a service on or off for a prison, if it is not already. On counts a national `*ALL*` row,
   * which already covers the prison; callers refuse to switch off under one before getting here. A 409
   * on adding means another change got there first, which is the state wanted, so it counts as success.
   */
  private async applySwitch(
    username: string,
    serviceCode: string,
    current: string[],
    agencyId: string,
    on: boolean,
  ): Promise<void> {
    if (on ? isSwitchedOn(current, agencyId) : !current.includes(agencyId)) return
    if (!on) {
      await this.prisonApiAgencySwitchClient.removeAgencySwitch(username, { serviceCode, agencyId })
      return
    }
    try {
      await this.prisonApiAgencySwitchClient.addAgencySwitch(username, { serviceCode, agencyId })
    } catch (error) {
      if ((error as SanitisedError).responseStatus !== 409) throw error
    }
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

  private async readAllScreens(username: string): Promise<NomisScreen[]> {
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

  private async readSwitches(username: string): Promise<NomisSwitches> {
    const [csra, autoApproval] = await Promise.all(
      [NOMIS_CSRA_SWITCH, NOMIS_AUTO_APPROVAL_SWITCH].map(async serviceCode =>
        (await this.prisonApiAgencySwitchClient.getAgencySwitches(username, { serviceCode })).map(
          agency => agency.agencyId,
        ),
      ),
    )
    return { csra, autoApproval }
  }

  /**
   * Reads both switches, reporting the ones NOMIS does not have yet as a NomisSwitchNotSetUpError.
   * Any other failure is genuine and surfaces as an error page.
   */
  private async readSwitchesForWrite(username: string): Promise<NomisSwitches> {
    const results = await Promise.all(
      [NOMIS_CSRA_SWITCH, NOMIS_AUTO_APPROVAL_SWITCH].map(async serviceCode => {
        try {
          const agencies = await this.prisonApiAgencySwitchClient.getAgencySwitches(username, { serviceCode })
          return { serviceCode, agencyIds: agencies.map(agency => agency.agencyId), missing: false }
        } catch (error) {
          if ((error as SanitisedError).responseStatus === 404) {
            return { serviceCode, agencyIds: [] as string[], missing: true }
          }
          throw error
        }
      }),
    )

    const missing = results.filter(result => result.missing).map(result => result.serviceCode)
    if (missing.length) throw new NomisSwitchNotSetUpError(missing)
    const [csra, autoApproval] = results.map(result => result.agencyIds)
    return { csra, autoApproval }
  }
}
