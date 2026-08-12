import { Router } from 'express'

import AssessmentsInProgressController from '../controllers/assessmentsInProgressController'
import addBreadcrumb from '../middleware/addBreadcrumb'
import type { Services } from '../services'

export default function assessmentsInProgressRouter(
  services: Pick<Services, 'auditService' | 'csraService' | 'manageUsersService'>,
): Router {
  const router = Router()
  const controller = new AssessmentsInProgressController(services)

  router.get('/', addBreadcrumb({ title: 'CSRA', href: '/' }), controller.index)

  return router
}
