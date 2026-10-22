// The NOMIS errors below are small and only make sense together, so they share this file.
/* eslint-disable max-classes-per-file */
import config from '../config'
import type { SplashScreenCondition } from '../data/prisonApiTypes'

/**
 * The NOMIS screens/modules that CSRA replaces. Turning a prison on in DPS blocks them for that
 * caseload, so staff there can only record a CSRA in DPS — the two systems never both accept one.
 */
export const NOMIS_CSRA_MODULES = config.nomis.csraModules

/** The approval screen (OIDCAPPR), also blocked for a prison still on NOMIS with no approval step. */
export const NOMIS_APPROVAL_MODULE = config.nomis.csraApprovalModule

/** NOMIS agency switch for a prison that has moved to DPS: the NOMIS header shows "View in DPS". */
export const NOMIS_CSRA_SWITCH = config.nomis.csraSwitch

/** NOMIS agency switch for a prison with no approval step: saving an assessment also approves it. */
export const NOMIS_AUTO_APPROVAL_SWITCH = config.nomis.csraAutoApprovalSwitch

/** The agency id prison-api uses to switch a service on for every agency at once. */
export const ALL_AGENCIES = '*ALL*'

// Access is driven per prison, so every condition managed here is a CASELOAD condition keyed by prison id.
export const CASELOAD_CONDITION = 'CASELOAD'

/**
 * A prison's state on one NOMIS screen, from its caseload condition: NORMAL = no condition, WARNING =
 * condition with blockAccess false, BLOCKED = blockAccess true. This service only sets NORMAL and
 * BLOCKED; WARNING is still read, as an earlier version of the admin page could set it.
 */
export type NomisScreenState = 'NORMAL' | 'WARNING' | 'BLOCKED'

/** Whether NOMIS still has its approval step for a prison, held by the auto-approval switch. */
export type NomisApprovalStep = 'REQUIRED' | 'NOT_REQUIRED'

/** A prison's NOMIS set-up as shown on the admin console. */
export interface NomisPrisonState {
  approval: NomisApprovalStep
  /**
   * False when the NOMIS screens and switches are not where this service would have put them for the
   * prison's DPS state: something changed them elsewhere, or a change part-applied.
   */
  matchesDps: boolean
}

/** The agencies switched on for each CSRA switch, as read from prison-api. */
export interface NomisSwitches {
  csra: string[]
  autoApproval: string[]
}

/** One screen's caseload conditions, as read from prison-api. */
export interface NomisScreen {
  moduleName: string
  conditions: SplashScreenCondition[]
}

/** What a change set, recorded in the audit: the state of each screen and switch it touched. */
export interface NomisChange {
  screens: Record<string, NomisScreenState>
  switches: Record<string, boolean>
}

export const isNomisApprovalStep = (value: unknown): value is NomisApprovalStep =>
  value === 'REQUIRED' || value === 'NOT_REQUIRED'

/** Derive a prison's state on one screen from that screen's caseload conditions. */
export const deriveNomisState = (conditions: SplashScreenCondition[], agencyId: string): NomisScreenState => {
  const condition = conditions.find(c => c.conditionType === CASELOAD_CONDITION && c.conditionValue === agencyId)
  if (!condition) return 'NORMAL'
  return condition.blockAccess ? 'BLOCKED' : 'WARNING'
}

/** Whether a switch is on for a prison, either for the prison itself or for every agency. */
export const isSwitchedOn = (agencyIds: string[], agencyId: string): boolean =>
  agencyIds.includes(agencyId) || agencyIds.includes(ALL_AGENCIES)

/** A prison's approval step, from the auto-approval switch. Without the switches, NOMIS always has one. */
export const deriveApprovalStep = (switches: NomisSwitches | null, agencyId: string): NomisApprovalStep =>
  switches && isSwitchedOn(switches.autoApproval, agencyId) ? 'NOT_REQUIRED' : 'REQUIRED'

/**
 * The state one screen should be in for a prison. Every screen is blocked once the prison is on DPS.
 * Before that, only the approval screen is, and only when the prison has no approval step.
 */
export const expectedScreenState = (
  moduleName: string,
  activeInDps: boolean,
  approval: NomisApprovalStep,
): NomisScreenState =>
  activeInDps || (moduleName === NOMIS_APPROVAL_MODULE && approval === 'NOT_REQUIRED') ? 'BLOCKED' : 'NORMAL'

/**
 * Whether a prison is on DPS as far as NOMIS is concerned, read from the screens other than the
 * approval screen, since that one is also blocked for a prison with no approval step.
 */
export const isBlockedInNomis = (screens: NomisScreen[], agencyId: string): boolean => {
  const dpsScreens = screens.filter(screen => screen.moduleName !== NOMIS_APPROVAL_MODULE)
  return (dpsScreens.length ? dpsScreens : screens).every(
    screen => deriveNomisState(screen.conditions, agencyId) === 'BLOCKED',
  )
}

/**
 * A prison's NOMIS set-up compared with its DPS state. It matches when every screen, and the CSRA switch
 * when the switches can be read, are where turning the prison on or off would have put them.
 */
export const derivePrisonState = (
  screens: NomisScreen[],
  switches: NomisSwitches | null,
  agencyId: string,
  activeInDps: boolean,
): NomisPrisonState => {
  const approval = deriveApprovalStep(switches, agencyId)
  const screensMatch = screens.every(
    screen =>
      deriveNomisState(screen.conditions, agencyId) === expectedScreenState(screen.moduleName, activeInDps, approval),
  )
  const switchMatches = !switches || isSwitchedOn(switches.csra, agencyId) === activeInDps
  return { approval, matchesDps: screensMatch && switchMatches }
}

/** The success-banner message shown after an admin turns a prison on or off. */
export const activeSuccessMessage = (name: string, active: boolean): string =>
  active
    ? `CSRA is now switched on for ${name}. The NOMIS CSRA screens are blocked.`
    : `CSRA is now switched off for ${name}. The NOMIS CSRA screens are open again.`

/** The success-banner message shown after an admin changes a prison's NOMIS approval step. */
export const approvalStepSuccessMessage = (name: string, approval: NomisApprovalStep): string =>
  approval === 'NOT_REQUIRED'
    ? `NOMIS CSRAs at ${name} are now approved when they are saved, with no approval step.`
    : `NOMIS CSRAs at ${name} need approving again.`

/**
 * Thrown when a CSRA splash screen has not been set up in NOMIS yet — the blocked message text is
 * configured manually there first. Names the screens that are missing so the admin knows what to create.
 */
export class NomisScreenNotSetUpError extends Error {
  constructor(readonly missingModules: string[]) {
    super(`The NOMIS splash screen has not been set up for: ${missingModules.join(', ')}`)
    this.name = 'NomisScreenNotSetUpError'
  }
}

/**
 * Thrown when an admin changes the approval step but the CSRA agency switches do not exist in this
 * NOMIS environment yet (Syscon CR 502 not applied). Names the missing switches.
 */
export class NomisSwitchNotSetUpError extends Error {
  constructor(readonly missingSwitches: string[]) {
    super(`The NOMIS agency switch has not been set up for: ${missingSwitches.join(', ')}`)
    this.name = 'NomisSwitchNotSetUpError'
  }
}

/**
 * Thrown when an admin changes the approval step for a prison that is blocked in NOMIS because it is on
 * DPS. The step only applies to prisons still recording CSRAs in NOMIS.
 */
export class NomisPrisonOnDpsError extends Error {
  constructor(readonly agencyId: string) {
    super(`${agencyId} is blocked in NOMIS for DPS, so its NOMIS approval step does not apply`)
    this.name = 'NomisPrisonOnDpsError'
  }
}
