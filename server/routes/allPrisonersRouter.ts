import { Router } from 'express'

import AllPrisonersController from '../controllers/allPrisonersController'
import addBreadcrumb from '../middleware/addBreadcrumb'
import type { Services } from '../services'

export default function allPrisonersRouter(services: Pick<Services, 'auditService' | 'csraService'>): Router {
  const router = Router()
  const controller = new AllPrisonersController(services)

  router.get('/', addBreadcrumb({ title: 'CSRA', href: '/' }), controller.index)

  return router
}
