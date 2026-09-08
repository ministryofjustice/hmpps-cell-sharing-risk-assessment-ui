import { Router } from 'express'
import type { Services } from '../services'
import csraStartController from '../controllers/csraStartController'
import csraQuestionController from '../controllers/csraQuestionController'
import csraTaskListController from '../controllers/csraTaskListController'
import csraBreadcrumbs from '../middleware/csraBreadcrumbs'
import csraConfirmRatingController from '../controllers/csraConfirmRatingController'

export default function csraRouter(
  services: Pick<Services, 'auditService' | 'csraService' | 'prisonApiService'>,
): Router {
  const router = Router({ mergeParams: true })

  router.get('/start', csraStartController(services))

  router.get('/:assessmentId', csraBreadcrumbs('taskList'), csraTaskListController(services))

  router.get('/:assessmentId/confirm-rating', csraConfirmRatingController(services))
  router.post('/:assessmentId/confirm-rating', csraConfirmRatingController(services))

  router.get('/:assessmentId/section/:sectionId{/:stepId}', csraQuestionController(services))
  router.post('/:assessmentId/section/:sectionId{/:stepId}', csraQuestionController(services))

  return router
}
