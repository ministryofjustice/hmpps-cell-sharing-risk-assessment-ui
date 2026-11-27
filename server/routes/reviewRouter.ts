import { Router } from 'express'
import type { Services } from '../services'
import permissionGuard from '../middleware/permissionGuard'
import reviewQuestionController from '../controllers/reviewQuestionController'
import { reviewSteps } from '../lib/transactionFlow/reviewConfig'

export default function reviewRouter(
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

  router.use(permissionGuard('edit_review'))
  router.use((_req, res, next) => {
    res.set('Cache-Control', 'private, no-store')
    res.locals.revalidateOnHistoryRestore = true
    next()
  })

  const review = reviewQuestionController(services)
  reviewSteps.forEach(({ path, persistence }) => {
    const handler = review.question(path)
    if (persistence !== 'update') {
      router.get(`/${path}`, handler)
      if (persistence !== 'pending') router.post(`/${path}`, handler)
    }
    router.get(`/:reviewId/${path}`, handler)
    if (persistence !== 'pending') router.post(`/:reviewId/${path}`, handler)
  })
  router.get('/:reviewId', review.overview)

  return router
}
