import { type RequestHandler } from 'express'

import type { Services } from '../services'
import { Page } from '../services/auditService'

type Dependencies = Pick<Services, 'auditService' | 'csraService'>

export default function prisonerCsraController({
  auditService,
  csraService,
}: Dependencies): RequestHandler<{ prisonerNumber: string }> {
  return async (req, res) => {
    const { prisonerNumber } = req.params
    const { username } = res.locals.user
    const { prisoner } = res.locals

    const csra = await csraService.getCurrentRating(username, prisonerNumber)

    await auditService.logPageView(Page.PRISONER_CSRA, {
      who: username,
      subjectId: prisonerNumber,
      subjectType: 'PRISONER_ID',
      correlationId: req.id,
    })

    return res.render('pages/prisonerCsra', { prisoner, csra, prisonerNumber })
  }
}
