import { Router } from 'express'

import ReviewsInProgressController from '../controllers/reviewsInProgressController'
import addBreadcrumb from '../middleware/addBreadcrumb'
import type { Services } from '../services'

export default function reviewsInProgressRouter(
  services: Pick<Services, 'auditService' | 'csraService' | 'manageUsersService'>,
): Router {
  const router = Router()
  const controller = new ReviewsInProgressController(services)

  router.get('/', addBreadcrumb({ title: 'CSRA', href: '/' }), controller.index)

  return router
}
