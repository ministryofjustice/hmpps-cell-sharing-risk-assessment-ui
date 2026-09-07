import { Router } from 'express'

import AdminPrisonsController from '../controllers/adminPrisonsController'
import requireAdminRole from '../middleware/requireAdminRole'
import type { Services } from '../services'

export default function adminRouter(services: Services): Router {
  const router = Router()
  const controller = new AdminPrisonsController(services)

  // The rollout admin console. National rather than caseload-scoped, so it is gated on the admin role
  // only - not on the user's own establishment being switched on.
  router.use(requireAdminRole)
  router.get('/prisons', controller.list)
  router.post('/prisons/:agencyId', controller.setActive)
  router.post('/prisons/:agencyId/nomis-screen', controller.setNomisScreen)

  return router
}
