import { type RequestHandler } from 'express'

import type { Services } from '../services'

type Dependencies = Pick<Services, 'prisonApiService'>

export default class PrisonerImageController {
  constructor(private readonly dependencies: Dependencies) {}

  index: RequestHandler<{ prisonerNumber: string }> = async (req, res) => {
    const { prisonApiService } = this.dependencies
    const { prisonerNumber } = req.params
    const { username } = res.locals.user

    try {
      const { body, contentType } = await prisonApiService.getPrisonerImage(username, prisonerNumber)
      res.set('Content-Type', contentType)
      res.set('Cache-Control', 'private, max-age=3600')
      return res.send(body)
    } catch {
      return res.redirect('/assets/images/prisoner-placeholder.svg')
    }
  }
}
