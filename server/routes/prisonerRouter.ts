import { Router } from 'express'

import PrisonerCsraController from '../controllers/prisonerCsraController'
import PrisonerCsraHistoryController from '../controllers/prisonerCsraHistoryController'
import PrisonerCsraReviewController from '../controllers/prisonerCsraReviewController'
import PrisonerImageController from '../controllers/prisonerImageController'
import csraWarrantsController, { csraWarrantFileController } from '../controllers/csraWarrantsController'
import csraBreadcrumbs from '../middleware/csraBreadcrumbs'
import requireAdminRole from '../middleware/requireAdminRole'
import type { Services } from '../services'
import csraRouter from './csraRouter'

export default function prisonerRouter(
  services: Pick<
    Services,
    'auditService' | 'csraService' | 'manageUsersService' | 'prisonApiService' | 'warrantsService'
  >,
): Router {
  const router = Router({ mergeParams: true })
  const csraController = new PrisonerCsraController(services)
  const historyController = new PrisonerCsraHistoryController(services)
  const reviewController = new PrisonerCsraReviewController(services)
  const imageController = new PrisonerImageController(services)

  // Breadcrumbs are attached per route rather than with router.use so the image proxy below, which
  // renders no page, never builds a trail.
  router.get('/', csraBreadcrumbs('current'), csraController.index)
  router.get('/history', csraBreadcrumbs('history'), historyController.index)
  router.get('/history/:reviewId', csraBreadcrumbs('review'), reviewController.index)

  // Proxy the prisoner photo through the app so the browser never needs a backend token. On any error
  // (no image, prisoner unknown, backend down) fall back to a neutral placeholder so the banner still
  // renders.
  router.get('/image', imageController.index)

  // Court warrants reachable without an assessment id, so the MAPA-349 spike can be tested before any
  // assessments exist. Admin-gated because it is a proof of concept rather than a journey for
  // officers - the task list route in csraRouter is the real one and stays open to any user.
  // Caseload rules already apply: this router is mounted behind requirePrisonerAccess.
  router.get('/warrants', requireAdminRole, csraWarrantsController(services))
  router.get('/warrants/:documentId/file', requireAdminRole, csraWarrantFileController(services))

  router.use('/csra', csraRouter(services))

  return router
}
