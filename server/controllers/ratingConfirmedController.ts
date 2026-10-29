import { type RequestHandler } from 'express'

import type { Services } from '../services'
import { Page } from '../services/auditService'

type Dependencies = Pick<Services, 'auditService' | 'csraService'>

export default function ratingConfirmedController({
  auditService,
  csraService,
}: Dependencies): RequestHandler<{ prisonerNumber: string; assessmentId?: string }> {
  return async (req, res) => {
    const {
      prisoner,
      user: { username },
    } = res.locals

    const csra = await csraService.getCurrentRating(username, prisoner.prisonerNumber)

    await auditService.logPageView(Page.RATING_CONFIRMED, {
      who: username,
      subjectId: prisoner.prisonerNumber,
      subjectType: 'PRISONER_ID',
      correlationId: req.id,
    })

    res.render('pages/ratingConfirmed', {
      prisoner,
      csra,
      cancelLink: `/prisoner/${prisoner.prisonerNumber}`,
    })
  }
}
