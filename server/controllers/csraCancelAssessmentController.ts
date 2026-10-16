import { type RequestHandler } from 'express'
import type { SanitisedError } from '@ministryofjustice/hmpps-rest-client'

import { Conflict, NotFound } from 'http-errors'
import type { Services } from '../services'
import getAnswersFromAssessment from './getAnswersFromAssessment'
import flowConfig from '../lib/transactionFlow/config'
import { Page } from '../services/auditService'
import getOffenceEvidenceMap from '../utils/getOffenceEvidenceMap'

type Dependencies = Pick<Services, 'auditService' | 'csraService'>
type Params = { prisonerNumber: string; assessmentId: string }

const CONFIRM_CANCEL_ERROR_FLASH = 'confirmCancelError'

export default function csraCancelAssessmentController({ auditService, csraService }: Dependencies): {
  get: RequestHandler<Params>
  post: RequestHandler<Params>
  cancelled: RequestHandler<Params>
} {
  const get: RequestHandler<Params> = async (req, res, _next) => {
    const { assessmentId, prisonerNumber } = req.params
    const {
      prisoner,
      user: { username },
    } = res.locals

    const assessment = await csraService.getCsraAssessment(username, prisonerNumber, assessmentId)
    if (!assessment) {
      throw NotFound(`No CSRA assessment found for ID: ${assessmentId}`)
    }

    const confirmCancelError = req.flash(CONFIRM_CANCEL_ERROR_FLASH)?.[0]
    const validationErrors = confirmCancelError ? { confirmCancel: { text: confirmCancelError } } : undefined

    await auditService.logPageView(Page.PRISONER_CSRA_CANCEL_ASSESSMENT, {
      who: username,
      subjectId: assessmentId,
      subjectType: 'ASSESSMENT_ID',
      correlationId: req.id,
    })

    const assessmentAnswers = getAnswersFromAssessment(assessment)
    const assessmentUrl = `/prisoner/${prisonerNumber}/csra/${assessmentId}`

    res.render('pages/csraCancelAssessment', {
      prisoner,
      assessment,
      assessmentAnswers,
      offenceEvidenceMap: getOffenceEvidenceMap(assessmentAnswers),
      flowConfig,
      backLink: assessmentUrl,
      cancelLink: assessmentUrl,
      ...(validationErrors ? { validationErrors } : {}),
    })
  }

  const post: RequestHandler<Params> = async (req, res, _next) => {
    const { assessmentId, prisonerNumber } = req.params
    const {
      user: { username },
    } = res.locals
    const assessmentUrl = `/prisoner/${prisonerNumber}/csra/${assessmentId}`
    const { confirmCancel } = req.body ?? {}

    if (confirmCancel === 'no') {
      res.redirect(assessmentUrl)
      return
    }

    if (confirmCancel !== 'yes') {
      req.flash(CONFIRM_CANCEL_ERROR_FLASH, 'Select yes if you want to cancel this assessment')
      res.redirect(`${assessmentUrl}/cancel`)
      return
    }

    const prisonId = res.locals.feComponents?.sharedData?.activeCaseLoad?.caseLoadId

    try {
      await csraService.cancelCsraAssessment(username, prisonerNumber, assessmentId, prisonId)
    } catch (error) {
      const { responseStatus, data } = error as SanitisedError<{ errorCode?: string }>
      if (responseStatus === 404) {
        throw NotFound(`No CSRA assessment found for ID: ${assessmentId}`)
      }
      if (responseStatus === 409) {
        throw Conflict(`CSRA assessment ${assessmentId} cannot be cancelled: ${data?.errorCode}`)
      }
      throw error
    }

    res.redirect(`${assessmentUrl}/cancelled`)
  }

  const cancelled: RequestHandler<Params> = async (req, res, _next) => {
    const { prisoner, user } = res.locals

    await auditService.logPageView(Page.PRISONER_CSRA_ASSESSMENT_CANCELLED, {
      who: user.username,
      subjectId: req.params.assessmentId,
      subjectType: 'ASSESSMENT_ID',
      correlationId: req.id,
    })

    res.render('pages/csraAssessmentCancelled', { prisoner })
  }

  return { get, post, cancelled }
}
