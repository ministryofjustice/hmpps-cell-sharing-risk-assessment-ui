import { Router } from 'express'

import type { Services } from '../services'
import { Page } from '../services/auditService'

export default function routes({ auditService, prisonerSearchService, csraService }: Services): Router {
  const router = Router()

  router.get('/', async (req, res, next) => {
    await auditService.logPageView(Page.EXAMPLE_PAGE, { who: res.locals.user.username, correlationId: req.id })

    const now = new Date()
    return res.render('pages/index', { currentTime: now.toISOString() })
  })

  router.get('/prisoner/:prisonerNumber', async (req, res) => {
    const { prisonerNumber } = req.params
    const { username } = res.locals.user

    const [prisoner, csra] = await Promise.all([
      prisonerSearchService.getPrisoner(username, prisonerNumber),
      csraService.getCurrentRating(username, prisonerNumber),
    ])

    await auditService.logPageView(Page.PRISONER_CSRA, {
      who: username,
      subjectId: prisonerNumber,
      subjectType: 'PRISONER_ID',
      correlationId: req.id,
    })

    return res.render('pages/prisonerCsra', { prisoner, csra, prisonerNumber })
  })

  return router
}
