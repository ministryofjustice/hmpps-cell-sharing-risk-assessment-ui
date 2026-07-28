import { Router } from 'express'
import dueForReviewController from '../controllers/dueForReviewController'
import indexController from '../controllers/indexController'
import prisonerCsraController from '../controllers/prisonerCsraController'
import prisonerCsraHistoryController from '../controllers/prisonerCsraHistoryController'
import prisonerImageController from '../controllers/prisonerImageController'
import {
  adminPrisonsListController,
  adminSetNomisScreenController,
  adminSetPrisonActiveController,
} from '../controllers/adminPrisonsController'
import type { Services } from '../services'
import checkPrisonerAccess from '../middleware/checkPrisonerAccess'
import addBreadcrumb from '../middleware/addBreadcrumb'
import requireAdminRole from '../middleware/requireAdminRole'

export default function routes(services: Services): Router {
  const { auditService, prisonerSearchService, csraService, prisonApiService, manageUsersService } = services
  const router = Router()

  // NOTE: reading CSRA information is open to any user with the prisoner in their caseload, so none of
  // the routes below are gated on rollout. Writing is what rollout gates: as each write journey is
  // built, wrap its route in `requireActivePrison(services.activeAgenciesService)`
  // (server/middleware/requireActivePrison.ts) *and* a check on the user holding
  // Role.CSRA__ASSESSMENT_EDIT or Role.CSRA__REVIEW_EDIT as appropriate.

  // Guards all prisoner routes: enforces the caseload/role access rules and, on success, stashes
  // the looked-up prisoner on res.locals.prisoner for the handlers to reuse.
  const requirePrisonerAccess = checkPrisonerAccess(prisonerSearchService, manageUsersService)

  router.get('/', indexController({ auditService, csraService }))

  router.get(
    '/due-for-review',
    addBreadcrumb({ title: 'CSRA', href: '/' }),
    dueForReviewController({ auditService, csraService }),
  )

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

  // The rollout admin console. National rather than caseload-scoped, so it is gated on the admin role
  // only — not on the user's own establishment being switched on.
  router.get('/admin/prisons', requireAdminRole, adminPrisonsListController(services))
  router.post('/admin/prisons/:agencyId', requireAdminRole, adminSetPrisonActiveController(services))
  router.post('/admin/prisons/:agencyId/nomis-screen', requireAdminRole, adminSetNomisScreenController(services))

  return router
}
