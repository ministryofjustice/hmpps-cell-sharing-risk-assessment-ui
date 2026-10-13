import { type RequestHandler } from 'express'

import { NotFound } from 'http-errors'
import type { Services } from '../services'
import getAnswersFromAssessment from './getAnswersFromAssessment'
import flowConfig from '../lib/transactionFlow/config'
import { Page } from '../services/auditService'
import getOffenceEvidenceMap from '../utils/getOffenceEvidenceMap'

type Dependencies = Pick<Services, 'auditService' | 'csraService'>

export default function csraCancelAssessmentController({
  auditService,
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

    const assessmentUrl = `/prisoner/${prisoner.prisonerNumber}/csra/${assessmentId}`
    let validationErrors: Record<string, { text: string }> | undefined

    if (req.method === 'POST') {
      const { confirmCancel } = req.body ?? {}

      if (confirmCancel === 'no') {
        res.redirect(assessmentUrl)
        return
      }

      if (confirmCancel === 'yes') {
        // TODO: call the cancel assessment API endpoint once it is implemented
        res.redirect(`${assessmentUrl}/cancel`)
        return
      }

      validationErrors = { confirmCancel: { text: 'Select yes if you want to cancel this assessment' } }
    }

    await auditService.logPageView(Page.PRISONER_CSRA_CANCEL_ASSESSMENT, {
      who: username,
      subjectId: assessmentId,
      subjectType: 'ASSESSMENT_ID',
      correlationId: req.id,
    })

    const assessmentAnswers = getAnswersFromAssessment(assessment)

    res.render('pages/csraCancelAssessment', {
      prisoner,
      assessment,
      assessmentAnswers,
      offenceEvidenceMap: getOffenceEvidenceMap(assessmentAnswers),
      flowConfig,
      ...(validationErrors ? { validationErrors } : {}),
    })
  }
}
