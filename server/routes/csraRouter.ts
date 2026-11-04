import { Router } from 'express'
import type { Services } from '../services'
import csraStartController from '../controllers/csraStartController'
import csraQuestionController from '../controllers/csraQuestionController'
import csraTaskListController from '../controllers/csraTaskListController'
import csraBreadcrumbs from '../middleware/csraBreadcrumbs'
import csraCheckAnswersController from '../controllers/csraCheckAnswersController'
import csraCancelAssessmentController from '../controllers/csraCancelAssessmentController'
import csraWarrantsController, { csraWarrantFileController } from '../controllers/csraWarrantsController'
import permissionGuard from '../middleware/permissionGuard'
import CsraSelectRatingController from '../controllers/csraSelectRatingController'
import CsraConfirmRatingController from '../controllers/csraConfirmRatingController'
import csraViewController from '../controllers/csraViewController'
import csraReviewProvisionalController from '../controllers/csraReviewProvisionalController'

export default function csraRouter(
  services: Pick<
    Services,
    'auditService' | 'csraService' | 'manageUsersService' | 'prisonApiService' | 'warrantsService'
  >,
): Router {
  const router = Router({ mergeParams: true })

  // Read-only view, open like the old history review page, so it sits above the edit guard.
  router.get('/:assessmentId/view', csraBreadcrumbs('view'), csraViewController(services))

  router.use(permissionGuard('edit_assessment'))
  router.use((_req, res, next) => {
    res.set('Cache-Control', 'private, no-store')
    res.locals.revalidateOnHistoryRestore = true
    next()
  })

  router.get('/start', csraStartController(services))

  router.get('/:assessmentId', csraBreadcrumbs('taskList'), csraTaskListController(services))

  // Court warrants (MAPA-349 proof of concept). Both routes 404 unless the feature flag is on.
  router.get('/:assessmentId/warrants', csraWarrantsController(services))
  // The PDF proxy renders no page, so it gets no back link or breadcrumb trail.
  router.get('/:assessmentId/warrants/:documentId/file', csraWarrantFileController(services))

  router.get('/:assessmentId/check-answers', csraCheckAnswersController(services))

  const reviewProvisionalHandler = csraReviewProvisionalController(services)
  router.get('/:assessmentId/review-provisional', reviewProvisionalHandler)
  router.post('/:assessmentId/review-provisional', reviewProvisionalHandler)

  const selectRatingHandler = new CsraSelectRatingController(services).requestHandler()
  router.get('/:assessmentId/select-rating', selectRatingHandler)
  router.post('/:assessmentId/select-rating', selectRatingHandler)

  const confirmRatingHandler = new CsraConfirmRatingController(services).requestHandler()
  router.get('/:assessmentId/confirm-rating/:rating', confirmRatingHandler)
  router.post('/:assessmentId/confirm-rating/:rating', confirmRatingHandler)

  const cancelAssessmentController = csraCancelAssessmentController(services)
  router.get('/:assessmentId/cancel', cancelAssessmentController.get)
  router.post('/:assessmentId/cancel', cancelAssessmentController.post)
  router.get('/:assessmentId/cancelled', cancelAssessmentController.cancelled)

  router.get('/:assessmentId/section/:sectionId{/:stepId}', csraQuestionController(services))
  router.post('/:assessmentId/section/:sectionId{/:stepId}', csraQuestionController(services))

  return router
}
