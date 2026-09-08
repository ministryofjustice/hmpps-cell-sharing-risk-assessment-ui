import { type RequestHandler } from 'express'

import { NotFound } from 'http-errors'
import type { Services } from '../services'
import getAnswersFromAssessment from './getAnswersFromAssessment'
import flowConfig from '../lib/transactionFlow/config'

type Dependencies = Pick<Services, 'auditService' | 'csraService'>

export default function csraConfirmRatingController({
  // auditService,
  csraService,
}: Dependencies): RequestHandler<{ prisonerNumber: string; assessmentId: string }> {
  return async (req, res, _next) => {
    const { assessmentId, prisonerNumber } = req.params
    const {
      prisoner,
      user: { username },
    } = res.locals

    const assessment = await csraService.getCsraAssessment(username, prisonerNumber, assessmentId)
    if (!assessment) {
      throw NotFound(`No CSRA assessment found for ID: ${assessmentId}`)
    }

    const assessmentAnswers = getAnswersFromAssessment(assessment)

    // await auditService.logPageView(Page.PRISONER_CSRA, {
    //   who: username,
    //   subjectId: prisonerNumber,
    //   subjectType: 'PRISONER_ID',
    //   correlationId: req.id,
    // })

    if (req.method === 'POST') {
      // TODO: change this to submit real data when the submit rating page is implemented fully
      await csraService.submitProvisionalRating(username, prisonerNumber, assessmentId, {
        rating: 'HIGH_GENERAL',
        assessmentComment: 'WIP generated comment',
        ...assessmentAnswers,
      })

      res.redirect(`/prisoner/${prisonerNumber}`)
    } else {
      res.render('pages/csraConfirmRating', {
        prisoner,
        assessment,
        assessmentAnswers,
        flowConfig,
      })
    }
  }
}
