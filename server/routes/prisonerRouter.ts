import { Router } from 'express'

import PrisonerCsraController from '../controllers/prisonerCsraController'
import PrisonerCsraHistoryController from '../controllers/prisonerCsraHistoryController'
import PrisonerCsraReviewController from '../controllers/prisonerCsraReviewController'
import PrisonerImageController from '../controllers/prisonerImageController'
import csraBreadcrumbs from '../middleware/csraBreadcrumbs'
import type { Services } from '../services'
import csraQuestionController from '../controllers/csraQuestionController'

export default function prisonerRouter(
  services: Pick<Services, 'auditService' | 'csraService' | 'prisonApiService'>,
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

  router.get('/csra/:assessmentId/section/:sectionId{/:stepId}', csraQuestionController(services))
  router.post('/csra/:assessmentId/section/:sectionId{/:stepId}', csraQuestionController(services))

  return router
}
