import { type RequestHandler } from 'express'

import type { Services } from '../services'

type Dependencies = Pick<Services, 'auditService' | 'csraService'>

export default function csraStartController({
  // auditService,
  csraService,
}: Dependencies): RequestHandler {
  return async (req, res, _next) => {
    const {
      user: { username },
      prisoner: { prisonerNumber },
    } = res.locals

    const activeCaseloadId = res.locals.feComponents?.sharedData?.activeCaseLoad?.caseLoadId

    const { assessmentId } = await csraService.startCsraAssessment(username, prisonerNumber, activeCaseloadId)

    // await auditService.logPageView(Page.PRISONER_CSRA, {
    //   who: username,
    //   subjectId: prisonerNumber,
    //   subjectType: 'PRISONER_ID',
    //   correlationId: req.id,
    // })

    res.redirect(`/prisoner/${prisonerNumber}/csra/${assessmentId}`)
  }
}
