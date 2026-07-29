import { Router } from 'express'

import PrisonerCsraController from '../controllers/prisonerCsraController'
import PrisonerCsraHistoryController from '../controllers/prisonerCsraHistoryController'
import PrisonerImageController from '../controllers/prisonerImageController'
import type { Services } from '../services'

export default function prisonerRouter(
  services: Pick<Services, 'auditService' | 'csraService' | 'prisonApiService'>,
): Router {
  const router = Router({ mergeParams: true })
  const csraController = new PrisonerCsraController(services)
  const historyController = new PrisonerCsraHistoryController(services)
  const imageController = new PrisonerImageController(services)

  router.get('/', csraController.index)
  router.get('/history', historyController.index)

  // Proxy the prisoner photo through the app so the browser never needs a backend token. On any error
  // (no image, prisoner unknown, backend down) fall back to a neutral placeholder so the banner still
  // renders.
  router.get('/image', imageController.index)

  return router
}
