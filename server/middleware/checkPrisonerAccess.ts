import type { RequestHandler } from 'express'
import createError from 'http-errors'

import type PrisonerSearchService from '../services/prisonerSearchService'
import type PrisonApiService from '../services/prisonApiService'
import { isPrisonerNumber } from '../utils/utils'
import { Role } from '../utils/roles'
import asyncMiddleware from './asyncMiddleware'

// prisoner-search prisonId sentinels for prisoners not currently located in an establishment
// (released / being transferred between establishments).
const OUT_OF_PRISON = ['OUT', 'TRN']

/**
 * Guards the prisoner CSRA pages. A signed-in user may only view a prisoner when:
 *  - the prisoner is currently in one of the user's caseloads, OR
 *  - the user has the GLOBAL_SEARCH role (no caseload match required); AND
 *  - if the prisoner is no longer in an establishment (prisonId OUT/TRN or missing), the user
 *    must have the INACTIVE_BOOKINGS role.
 *
 * On any denial we return a 404 "Prisoner not found" rather than a 403, so the response does not
 * reveal whether the prisoner exists.
 *
 * The looked-up prisoner is stashed on res.locals.prisoner so the route handlers can reuse it
 * without a second prisoner-search call.
 */
export default function checkPrisonerAccess(
  prisonerSearchService: PrisonerSearchService,
  prisonApiService: PrisonApiService,
): RequestHandler<{ prisonerNumber: string }> {
  return asyncMiddleware(async (req, res, next) => {
    const { prisonerNumber } = req.params
    if (typeof prisonerNumber !== 'string' || !isPrisonerNumber(prisonerNumber)) {
      return next(createError(404, 'Prisoner not found'))
    }

    const { user } = res.locals
    const prisoner = await prisonerSearchService.getPrisoner(user.username, prisonerNumber)
    const roles = user.userRoles ?? []

    const outOfPrison = !prisoner.prisonId || OUT_OF_PRISON.includes(prisoner.prisonId)

    let allowed: boolean
    if (outOfPrison) {
      allowed = roles.includes(Role.INACTIVE_BOOKINGS)
    } else if (roles.includes(Role.GLOBAL_SEARCH)) {
      allowed = true
    } else {
      const caseloads = await prisonApiService.getUserCaseLoads(user)
      allowed = caseloads.some(caseload => caseload.caseLoadId === prisoner.prisonId)
    }

    if (!allowed) {
      return next(createError(404, 'Prisoner not found'))
    }

    res.locals.prisoner = prisoner
    return next()
  })
}
