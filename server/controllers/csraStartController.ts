import { type RequestHandler } from 'express'

import type { Services } from '../services'
import { appendReferrers, referrerStack } from '../utils/breadcrumbOrigins'

type Dependencies = Pick<Services, 'csraService'>

export default function csraStartController({ csraService }: Dependencies): RequestHandler {
  return async (req, res, _next) => {
    const {
      user: { username },
      prisoner: { prisonerNumber },
    } = res.locals

    const activeCaseloadId = res.locals.feComponents?.sharedData?.activeCaseLoad?.caseLoadId

    const { assessmentId } = await csraService.startCsraAssessment(username, prisonerNumber, activeCaseloadId)

    res.redirect(appendReferrers(`/prisoner/${prisonerNumber}/csra/${assessmentId}`, referrerStack(req.query.referrer)))
  }
}
