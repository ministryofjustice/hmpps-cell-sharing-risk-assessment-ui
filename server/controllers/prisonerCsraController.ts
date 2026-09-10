import { type RequestHandler } from 'express'

import type { Services } from '../services'
import { Page } from '../services/auditService'
import { populateUserDisplayNames } from '../utils/populateUserDisplayNames'

type Dependencies = Pick<Services, 'auditService' | 'csraService' | 'manageUsersService'>

export default class PrisonerCsraController {
  constructor(private readonly dependencies: Dependencies) {}

  index: RequestHandler<{ prisonerNumber: string }> = async (req, res) => {
    const { auditService, csraService, manageUsersService } = this.dependencies
    const { prisonerNumber } = req.params
    const { username } = res.locals.user
    const { prisoner } = res.locals

    await auditService.logPageView(Page.PRISONER_CSRA, {
      who: username,
      subjectId: prisonerNumber,
      subjectType: 'PRISONER_ID',
      correlationId: req.id,
    })

    const csra = await csraService.getCurrentRating(username, prisonerNumber)

    if (csra.inProgress) {
      await populateUserDisplayNames(res.locals, manageUsersService, res.locals.user.username, [
        csra.inProgress.startedBy,
      ])
    }

    return res.render('pages/prisonerCsra', { prisoner, csra, prisonerNumber })
  }
}
