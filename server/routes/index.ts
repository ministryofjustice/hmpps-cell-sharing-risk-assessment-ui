import { Router } from 'express'

import indexController from '../controllers/indexController'
import prisonerCsraController from '../controllers/prisonerCsraController'
import prisonerCsraHistoryController from '../controllers/prisonerCsraHistoryController'
import prisonerImageController from '../controllers/prisonerImageController'
import type { Services } from '../services'
import checkPrisonerAccess from '../middleware/checkPrisonerAccess'

export default function routes({
  auditService,
  prisonerSearchService,
  csraService,
  prisonApiService,
  manageUsersService,
}: Services): Router {
  const router = Router()

  // Guards all prisoner routes: enforces the caseload/role access rules and, on success, stashes
  // the looked-up prisoner on res.locals.prisoner for the handlers to reuse.
  const requirePrisonerAccess = checkPrisonerAccess(prisonerSearchService, manageUsersService)

  router.get('/', indexController({ auditService, csraService }))

  router.get('/prisoner/:prisonerNumber', requirePrisonerAccess, prisonerCsraController({ auditService, csraService }))

  router.get(
    '/prisoner/:prisonerNumber/history',
    requirePrisonerAccess,
    prisonerCsraHistoryController({ auditService, csraService }),
  )

  // Proxy the prisoner photo through the app so the browser never needs a backend token. On any error
  // (no image, prisoner unknown, backend down) fall back to a neutral placeholder so the banner still
  // renders.
  router.get('/prisoner/:prisonerNumber/image', requirePrisonerAccess, prisonerImageController({ prisonApiService }))

  return router
}
