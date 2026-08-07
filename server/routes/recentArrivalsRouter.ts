import { Router } from 'express'

import RecentArrivalsController from '../controllers/recentArrivalsController'
import addBreadcrumb from '../middleware/addBreadcrumb'
import type { Services } from '../services'

export default function recentArrivalsRouter(services: Pick<Services, 'auditService' | 'csraService'>): Router {
  const router = Router()
  const controller = new RecentArrivalsController(services)

  router.get('/', addBreadcrumb({ title: 'CSRA', href: '/' }), controller.index)

  return router
}
