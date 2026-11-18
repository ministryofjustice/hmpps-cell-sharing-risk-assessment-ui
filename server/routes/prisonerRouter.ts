import { Router } from 'express'

import PrisonerCsraController from '../controllers/prisonerCsraController'
import PrisonerCsraHistoryController from '../controllers/prisonerCsraHistoryController'
import PrisonerImageController from '../controllers/prisonerImageController'
import csraWarrantsController, { csraWarrantFileController } from '../controllers/csraWarrantsController'
import csraBreadcrumbs from '../middleware/csraBreadcrumbs'
import type { Services } from '../services'
import csraRouter from './csraRouter'
import ratingConfirmedController from '../controllers/ratingConfirmedController'

export default function prisonerRouter(
  services: Pick<
    Services,
    | 'auditService'
    | 'changeSomeonesCellService'
    | 'csraService'
    | 'manageUsersService'
    | 'prisonApiService'
    | 'warrantsService'
  >,
): Router {
  const router = Router({ mergeParams: true })
  const csraController = new PrisonerCsraController(services)
  const historyController = new PrisonerCsraHistoryController(services)
  const imageController = new PrisonerImageController(services)

  // Breadcrumbs are attached per route rather than with router.use so the image proxy below, which
  // renders no page, never builds a trail.
  router.get('/', csraBreadcrumbs('current'), csraController.index)
  router.get('/history', csraBreadcrumbs('history'), historyController.index)

  // Proxy the prisoner photo through the app so the browser never needs a backend token. On any error
  // (no image, prisoner unknown, backend down) fall back to a neutral placeholder so the banner still
  // renders.
  router.get('/image', imageController.index)

  // Court warrants are reachable before any assessment exists.
  // Caseload rules already apply: this router is mounted behind requirePrisonerAccess.
  router.get('/warrants', csraWarrantsController(services))
  router.get('/warrants/:documentId/file', csraWarrantFileController(services))

  router.use('/csra', csraRouter(services))
  router.get('/rating-confirmed', ratingConfirmedController(services))

  return router
}
