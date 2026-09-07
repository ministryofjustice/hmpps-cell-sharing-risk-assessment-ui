import { Router } from 'express'
import IndexController from '../controllers/indexController'
import assessmentsInProgressRouter from './assessmentsInProgressRouter'
import reviewsInProgressRouter from './reviewsInProgressRouter'
import type { Services } from '../services'
import checkPrisonerAccess from '../middleware/checkPrisonerAccess'
import dueForReviewRouter from './dueForReviewRouter'
import prisonerRouter from './prisonerRouter'
import adminRouter from './adminRouter'
import allPrisonersRouter from './allPrisonersRouter'
import recentArrivalsRouter from './recentArrivalsRouter'

export default function routes(services: Services): Router {
  const { prisonerSearchService, manageUsersService } = services
  const router = Router()
  const indexController = new IndexController(services)

  // NOTE: reading CSRA information is open to any user with the prisoner in their caseload, so none of
  // the routes below are gated on rollout. Writing is what rollout gates: as each write journey is
  // built, wrap its route in `requireActivePrison(services.activeAgenciesService)`
  // (server/middleware/requireActivePrison.ts) *and* a check on the user holding
  // Role.CSRA__ASSESSMENT_EDIT or Role.CSRA__REVIEW_EDIT as appropriate.

  // Guards all prisoner routes: enforces the caseload/role access rules and, on success, stashes
  // the looked-up prisoner on res.locals.prisoner for the handlers to reuse.
  const requirePrisonerAccess = checkPrisonerAccess(prisonerSearchService, manageUsersService)

  router.get('/', indexController.index)

  router.use('/due-for-review', dueForReviewRouter(services))
  router.use('/all-prisoners', allPrisonersRouter(services))
  router.use('/recent-arrivals', recentArrivalsRouter(services))
  router.use('/assessments-in-progress', assessmentsInProgressRouter(services))
  router.use('/reviews-in-progress', reviewsInProgressRouter(services))
  router.use('/prisoner/:prisonerNumber', requirePrisonerAccess, prisonerRouter(services))
  router.use('/admin', adminRouter(services))

  return router
}
