import type { RequestHandler } from 'express'

import type ActiveAgenciesService from '../services/activeAgenciesService'
import asyncMiddleware from './asyncMiddleware'

/**
 * Gates a CSRA write journey on the user's establishment having CSRA switched on in DPS.
 *
 * During rollout a prison uses either DPS or NOMIS for CSRA, never both, so a user whose active
 * caseload has not been switched on must not be able to record anything here even if they hold the
 * role. Reading stays open — only writes are gated.
 *
 * Renders the authorisation-error page rather than signing the user out, and denies when there is no
 * active caseload at all, so an unresolvable establishment fails closed.
 */
export default function requireActivePrison(activeAgenciesService: ActiveAgenciesService): RequestHandler {
  return asyncMiddleware(async (req, res, next) => {
    const activeCaseloadId = res.locals.feComponents?.sharedData?.activeCaseLoad?.caseLoadId

    if (activeCaseloadId && (await activeAgenciesService.isPrisonActive(activeCaseloadId))) {
      return next()
    }

    res.status(403)
    return res.render('autherror')
  })
}
