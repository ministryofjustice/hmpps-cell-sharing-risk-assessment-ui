import { type RequestHandler } from 'express'
import type { Services } from '../services'
import { Page } from '../services/auditService'
import logger from '../../logger'
import { populateUserDisplayNames } from '../utils/populateUserDisplayNames'
import { Role } from '../utils/roles'

type Dependencies = Pick<Services, 'auditService' | 'csraService' | 'manageUsersService'>

export default class ReviewsInProgressController {
  constructor(private readonly dependencies: Dependencies) {}

  index: RequestHandler = async (req, res, next) => {
    const { auditService, csraService, manageUsersService } = this.dependencies
    await auditService.logPageView(Page.REVIEWS_IN_PROGRESS, {
      who: res.locals.user.username,
      correlationId: req.id,
    })

    try {
      const { content: reviewsInProgress } = await csraService.getReviewsInProgress(
        res.locals.user.username,
        res.locals.feComponents.sharedData.activeCaseLoad.caseLoadId,
      )

      const canEditReviews = res.locals.user?.userRoles?.includes(Role.CSRA__REVIEW_EDIT)

      const usernames = reviewsInProgress.map(review => review.startedBy)

      await populateUserDisplayNames(res.locals, manageUsersService, res.locals.user.username, usernames)

      return res.render('pages/reviewsInProgress', {
        title: 'Reviews in progress',
        reviewsInProgress,
        canEditReviews,
      })
    } catch (error) {
      logger.error('Error fetching prisoners for reviews-in-progress page', error)
      return next(error)
    }
  }
}
