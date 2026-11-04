import { type RequestHandler } from 'express'
import { NotFound } from 'http-errors'

import flowConfig from '../lib/transactionFlow/config'
import type { Services } from '../services'
import { Page } from '../services/auditService'
import getAnswersFromAssessment from './getAnswersFromAssessment'
import getOffenceEvidenceMap from '../utils/getOffenceEvidenceMap'
import {
  CsraAssessment,
  CsraAssessmentStageAnswers,
  CsraOffenceEvidence,
  csraRiskToCategoryLabelMap,
  csraVulnerabilityCategoryLabelMap,
} from '../data/csraApiTypes'
import { populateUserDisplayNames } from '../utils/populateUserDisplayNames'
import { appendReferrers, referrerStack } from '../utils/breadcrumbOrigins'

type Dependencies = Pick<Services, 'auditService' | 'csraService' | 'manageUsersService'>

export default function csraViewController({
  auditService,
  csraService,
  manageUsersService,
}: Dependencies): RequestHandler<{ prisonerNumber: string; assessmentId: string }> {
  return async (req, res) => {
    const { locals } = res
    const {
      prisoner,
      user: { username },
    } = locals

    let assessment: CsraAssessment | undefined
    let assessmentAnswers: CsraAssessmentStageAnswers | undefined
    let offenceEvidenceMap: Record<string, CsraOffenceEvidence> | undefined
    try {
      assessment = await csraService.getCsraAssessment(username, prisoner.prisonerNumber, req.params.assessmentId)
      assessmentAnswers = getAnswersFromAssessment(assessment)
      offenceEvidenceMap = getOffenceEvidenceMap(assessmentAnswers)
    } catch (e) {
      if (!(e.responseStatus === 404 && e.data?.errorCode === 'CsraReviewNotFound')) {
        throw e
      }
    }

    const detailedRating = await csraService.getDetailedCsraRating(username, req.params.assessmentId)
    if (detailedRating.prisonerNumber !== prisoner.prisonerNumber) {
      throw NotFound(`No CSRA rating found for ID: ${req.params.assessmentId}`)
    }

    const isProvisional = detailedRating.status === 'PROVISIONAL'
    const completedBy = isProvisional ? detailedRating.provisionalCompletedBy : detailedRating.finalCompletedBy
    await populateUserDisplayNames(locals, manageUsersService, username, completedBy ? [completedBy] : [])

    const referrers = referrerStack(req.query.referrer)
    let backLink = appendReferrers(`/prisoner/${prisoner.prisonerNumber}`, referrers)
    let backLinkText = 'CSRA overview'
    if (referrers.at(-1) === 'history') {
      backLink = appendReferrers(`/prisoner/${prisoner.prisonerNumber}/history`, referrers.slice(0, -1))
      backLinkText = 'CSRA history'
    }

    await auditService.logPageView(Page.PRISONER_CSRA_VIEW, {
      who: username,
      subjectId: prisoner.prisonerNumber,
      subjectType: 'PRISONER_ID',
      correlationId: req.id,
    })

    res.render('pages/csraView', {
      ...locals,
      prisoner,
      assessment,
      assessmentAnswers,
      csraRiskToCategoryLabelMap,
      csraVulnerabilityCategoryLabelMap,
      detailedRating,
      offenceEvidenceMap,
      flowConfig,
      backLink,
      backLinkText,
    })
  }
}
