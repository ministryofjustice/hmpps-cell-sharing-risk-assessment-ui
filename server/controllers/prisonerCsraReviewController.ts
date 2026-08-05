import { type RequestHandler } from 'express'
import createError from 'http-errors'

import type { Services } from '../services'
import { Page } from '../services/auditService'
import { answeredQuestions, buildDpsReviewRows, buildLegacyReviewRows } from '../utils/csraReviewSummaryRows'

type Dependencies = Pick<Services, 'auditService' | 'csraService'>

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * The status a failed backend call carries.
 *
 * The rest client's SanitisedError names it `responseStatus`, not `status` — which is also why the
 * global error handler cannot translate a backend 404 for us and this controller has to.
 */
const backendStatus = (error: unknown): number | undefined => (error as { responseStatus?: number })?.responseStatus

export default class PrisonerCsraReviewController {
  constructor(private readonly dependencies: Dependencies) {}

  index: RequestHandler<{ prisonerNumber: string; reviewId: string }> = async (req, res, next) => {
    const { auditService, csraService } = this.dependencies
    const { prisonerNumber, reviewId } = req.params
    const { username } = res.locals.user
    const { prisoner } = res.locals

    const notFound = () => next(createError(404, 'CSRA review not found'))

    // The API's path variable is a UUID, so anything else comes back as a 400 rather than a 404.
    // Reject it here so a mistyped link is a not-found page rather than a server error.
    if (!UUID_PATTERN.test(reviewId)) return notFound()

    let review
    try {
      review = await csraService.getReview(username, reviewId)
    } catch (error) {
      if (backendStatus(error) === 404) return notFound()
      return next(error)
    }

    // GET /csra-review/{id} is not prisoner-scoped, so without this check any review could be read by
    // pasting its id under a prisoner the user does have access to, going straight past
    // checkPrisonerAccess. Answering 404 rather than 403 also avoids confirming the id exists at all.
    if (review.prisonerNumber !== prisonerNumber) return notFound()

    // Audited only once the review is known to be this prisoner's, so a probe for someone else's
    // record is not recorded as a page view of it.
    await auditService.logPageView(Page.PRISONER_CSRA_REVIEW, {
      who: username,
      subjectId: prisonerNumber,
      subjectType: 'PRISONER_ID',
      correlationId: req.id,
      details: { reviewId },
    })

    const isLegacy = Boolean(review.legacy)

    return res.render('pages/prisonerCsraReview', {
      prisonerNumber,
      prisoner,
      review,
      isLegacy,
      rows: isLegacy ? buildLegacyReviewRows(review) : buildDpsReviewRows(review),
      questions: answeredQuestions(review.legacy?.questions),
    })
  }
}
