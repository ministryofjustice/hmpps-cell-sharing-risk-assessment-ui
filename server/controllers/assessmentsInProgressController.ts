import { type RequestHandler } from 'express'
import type { Services } from '../services'
import { Page } from '../services/auditService'
import logger from '../../logger'
import { populateUserDisplayNames } from '../utils/populateUserDisplayNames'

type Dependencies = Pick<Services, 'auditService' | 'csraService' | 'manageUsersService'>

export default class AssessmentsInProgressController {
  constructor(private readonly dependencies: Dependencies) {}

  index: RequestHandler = async (req, res, next) => {
    const { auditService, csraService, manageUsersService } = this.dependencies
    await auditService.logPageView(Page.ASSESSMENTS_IN_PROGRESS, {
      who: res.locals.user.username,
      correlationId: req.id,
    })

    try {
      const { assessmentStarted, provisionalRatingEntered } = await csraService.getAssessmentsInProgress(
        res.locals.user.username,
        res.locals.feComponents.sharedData.activeCaseLoad.caseLoadId,
      )

      const usernames = Array.from(
        new Set([
          ...assessmentStarted.map(assessment => assessment.startedBy),
          ...provisionalRatingEntered.map(assessment => assessment.assessedBy),
        ]),
      )

      await populateUserDisplayNames(res.locals, manageUsersService, res.locals.user.username, usernames)

      return res.render('pages/assessmentsInProgress', {
        title: 'Assessments in progress',
        assessmentStarted,
        provisionalRatingEntered,
      })
    } catch (error) {
      logger.error('Error fetching prisoners for assessments-in-progress page', error)
      return next(error)
    }
  }
}
