import { type RequestHandler } from 'express'

import { NotFound } from 'http-errors'
import type { Services } from '../services'
import getAnswersFromAssessment from './getAnswersFromAssessment'
import { Page } from '../services/auditService'
import { AssessmentSubmitType, getAssessmentSubmitStatus } from '../utils/getAssessmentSubmitStatus'

type Dependencies = Pick<Services, 'auditService' | 'csraService'>

export default function csraSelectRatingController({
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
    const assessmentAnswers = getAnswersFromAssessment(assessment)

    const submitStatus = getAssessmentSubmitStatus(assessment, assessmentAnswers, prisoner)
    if (submitStatus.submitType === AssessmentSubmitType.NONE) {
      res.redirect(assessmentUrl)
      return
    }

    const csra = await csraService.getCurrentRating(username, prisonerNumber)
    const isProvisional = submitStatus.submitType === AssessmentSubmitType.PROVISIONAL
    const isHighGeneral = Boolean(
      assessmentAnswers.offenceMurderManslaughter ||
      assessmentAnswers.offenceAssistingSuicide ||
      assessmentAnswers.offenceSexualAssault,
    )

    if (req.method === 'POST') {
      const selectedRating = req.body?.selectedRating
      let allowedRatings: string[]

      if (isProvisional) {
        if (isHighGeneral) {
          allowedRatings = ['HIGH_GENERAL_PROVISIONAL']
        } else {
          allowedRatings = ['HIGH_GENERAL_PROVISIONAL', 'HIGH_SPECIFIC_PROVISIONAL']
        }
      } else if (isHighGeneral) {
        allowedRatings = ['HIGH_GENERAL']
      } else {
        allowedRatings = ['HIGH_GENERAL', 'HIGH_SPECIFIC', 'STANDARD']
      }

      if (typeof selectedRating !== 'string' || !allowedRatings.includes(selectedRating)) {
        res.render('pages/csraSelectRating', {
          prisoner,
          csra,
          assessmentAnswers,
          isProvisional,
          isHighGeneral,
          selectedRating,
          backLink: assessmentUrl,
          cancelLink: assessmentUrl,
          validationErrors: {
            selectedRating: { text: 'Select a CSRA rating' },
          },
        })

        return
      }

      res.redirect(`${assessmentUrl}/confirm-rating?selectedRating=${selectedRating}`)
      return
    }

    await auditService.logPageView(Page.PRISONER_CSRA_SELECT_RATING, {
      who: username,
      subjectId: assessmentId,
      subjectType: 'ASSESSMENT_ID',
      correlationId: req.id,
    })

    res.render('pages/csraSelectRating', {
      prisoner,
      csra,
      assessmentAnswers,
      isProvisional,
      isHighGeneral,
      selectedRating: req.query.selectedRating,
      backLink: assessmentUrl,
      cancelLink: assessmentUrl,
    })
  }
}
