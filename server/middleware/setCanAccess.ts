import { RequestHandler } from 'express'
import ActiveAgenciesService from '../services/activeAgenciesService'
import asyncMiddleware from './asyncMiddleware'
import { Role } from '../utils/roles'

/**
 * Middleware to set the `canAccess` function on `res.locals` based on the user's roles and the active status of the prison.
 * @param activeAgenciesService - Service to check if a prison is active.
 * @returns Express request handler.
 */
export default function setCanAccess(activeAgenciesService: ActiveAgenciesService): RequestHandler {
  return asyncMiddleware(async (_req, res, next) => {
    const activeCaseloadId = res.locals.feComponents?.sharedData?.activeCaseLoad?.caseLoadId
    const isActive = await activeAgenciesService.isPrisonActive(activeCaseloadId)

    res.locals.canAccess = (action: string) => {
      switch (action) {
        case 'edit_assessment':
          return isActive && res.locals.hasRole(Role.CSRA__ASSESSMENT_EDIT)
        case 'edit_review':
          return isActive && res.locals.hasRole(Role.CSRA__REVIEW_EDIT)
        default:
          return true
      }
    }
    next()
  })
}
