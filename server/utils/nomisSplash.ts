import config from '../config'
import type { SplashScreenCondition } from '../data/prisonApiTypes'

/**
 * The NOMIS screens/modules that CSRA replaces. Blocking them for a caseload forces staff at that
 * prison to use DPS instead — the NOMIS half of DPS/NOMIS mutual exclusivity during rollout.
 *
 * Both are retired by the same rollout step, so the admin console drives them together as one action
 * rather than exposing a control per screen.
 */
export const NOMIS_CSRA_MODULES = config.nomis.csraModules

// Access is driven per prison, so every condition managed here is a CASELOAD condition keyed by prison id.
export const CASELOAD_CONDITION = 'CASELOAD'

/**
 * The three states a prison's NOMIS CSRA screens can be in, derived from the caseload condition on
 * each: NORMAL = no condition, WARNING = condition with blockAccess false, BLOCKED = blockAccess true.
 */
export type NomisScreenState = 'NORMAL' | 'WARNING' | 'BLOCKED'

/**
 * What a prison's screens are in taken together. MIXED means the modules disagree — they are always
 * set as one, so it implies something changed them outside this service (or a change part-applied).
 * It is surfaced rather than hidden so an admin can see it and re-apply the state they want.
 */
export type NomisCombinedState = NomisScreenState | 'MIXED'

export const isNomisScreenState = (value: unknown): value is NomisScreenState =>
  value === 'NORMAL' || value === 'WARNING' || value === 'BLOCKED'

/** Derive a prison's state on one screen from that screen's caseload conditions. */
export const deriveNomisState = (conditions: SplashScreenCondition[], agencyId: string): NomisScreenState => {
  const condition = conditions.find(c => c.conditionType === CASELOAD_CONDITION && c.conditionValue === agencyId)
  if (!condition) return 'NORMAL'
  return condition.blockAccess ? 'BLOCKED' : 'WARNING'
}

/** Combine a prison's per-screen states into the one shown on the admin console. */
export const combineNomisStates = (states: NomisScreenState[]): NomisCombinedState => {
  if (states.length === 0) return 'NORMAL'
  return states.every(state => state === states[0]) ? states[0] : 'MIXED'
}

/** The success-banner message shown after an admin moves a prison's NOMIS CSRA screens to a state. */
export const nomisStateSuccessMessage = (name: string, state: NomisScreenState): string => {
  switch (state) {
    case 'BLOCKED':
      return `NOMIS CSRA access is now blocked for ${name}.`
    case 'WARNING':
      return `A NOMIS CSRA closure warning is now showing for ${name}.`
    default:
      return `NOMIS CSRA access is back to normal for ${name}.`
  }
}

/**
 * Thrown when an admin tries to warn/block a caseload but a CSRA splash screen has not been set up in
 * NOMIS yet — the warning and blocked message text is configured manually there first. Names the
 * screens that are missing so the admin knows what to create.
 */
export class NomisScreenNotSetUpError extends Error {
  constructor(readonly missingModules: string[]) {
    super(`The NOMIS splash screen has not been set up for: ${missingModules.join(', ')}`)
    this.name = 'NomisScreenNotSetUpError'
  }
}
