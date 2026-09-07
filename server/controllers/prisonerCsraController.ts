import { type RequestHandler } from 'express'

import type { Services } from '../services'
import { Page } from '../services/auditService'

type Dependencies = Pick<Services, 'auditService' | 'csraService'>

export default class PrisonerCsraController {
  constructor(private readonly dependencies: Dependencies) {}

  index: RequestHandler<{ prisonerNumber: string }> = async (req, res) => {
    const { auditService, csraService } = this.dependencies
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
