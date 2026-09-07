import { Router } from 'express'

import DueForReviewController from '../controllers/dueForReviewController'
import addBreadcrumb from '../middleware/addBreadcrumb'
import type { Services } from '../services'

export default function dueForReviewRouter(services: Pick<Services, 'auditService' | 'csraService'>): Router {
  const router = Router()
  const controller = new DueForReviewController(services)

  router.get('/', addBreadcrumb({ title: 'CSRA', href: '/' }), controller.index)

  return router
}
