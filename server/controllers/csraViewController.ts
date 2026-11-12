import { type RequestHandler } from 'express'
import { NotFound } from 'http-errors'

import flowConfig from '../lib/transactionFlow/config'
import type { Services } from '../services'
import { Page } from '../services/auditService'
import { getAnswersFromAssessmentStage } from './getAnswersFromAssessment'
import getOffenceEvidenceMap from '../utils/getOffenceEvidenceMap'
import {
  CsraAssessmentStageAnswers,
  CsraOffenceEvidence,
  csraRiskToCategoryLabelMap,
  csraVulnerabilityCategoryLabelMap,
} from '../data/csraApiTypes'
import { populateUserDisplayNames } from '../utils/populateUserDisplayNames'
import { appendReferrers, referrerStack } from '../utils/breadcrumbOrigins'
import { convertToTitleCase } from '../utils/utils'
import { createLegacyQuestionsRows, createSummaryRows, SummaryRow } from '../utils/csraReviewSummaryRows'
import config from '../config'

type Dependencies = Pick<Services, 'auditService' | 'changeSomeonesCellService' | 'csraService' | 'manageUsersService'>

export default function csraViewController({
  auditService,
  changeSomeonesCellService,
  csraService,
  manageUsersService,
}: Dependencies): RequestHandler<{ prisonerNumber: string; assessmentId: string }> {
  return async (req, res) => {
    const { locals } = res
    const {
      prisoner,
      user: { username },
    } = locals

    const detailedRating = await csraService.getDetailedRating(username, req.params.assessmentId).catch(error => {
      if (error.responseStatus === 404) {
        throw NotFound(`No CSRA rating found for ID: ${req.params.assessmentId}`)
      }

      throw error
    })
    if (detailedRating.prisonerNumber !== prisoner.prisonerNumber) {
      throw NotFound(`No CSRA rating found for ID: ${req.params.assessmentId}`)
    }

    let finalAssessmentAnswers: CsraAssessmentStageAnswers | undefined
    let finalOffenceEvidenceMap: Record<string, CsraOffenceEvidence> | undefined
    let provisionalAssessmentAnswers: CsraAssessmentStageAnswers | undefined
    let provisionalOffenceEvidenceMap: Record<string, CsraOffenceEvidence> | undefined
    let cellSharingHistory: ({ text: string } | { html: string })[][] | undefined
    try {
      finalAssessmentAnswers = getAnswersFromAssessmentStage(detailedRating, 'FINAL')
      if (finalAssessmentAnswers) {
        finalOffenceEvidenceMap = getOffenceEvidenceMap(finalAssessmentAnswers)
      }

      provisionalAssessmentAnswers = getAnswersFromAssessmentStage(detailedRating, 'PROVISIONAL')
      if (provisionalAssessmentAnswers) {
        provisionalOffenceEvidenceMap = getOffenceEvidenceMap(provisionalAssessmentAnswers)
      }

      if (detailedRating.provisionalRating === 'HIGH_SPECIFIC') {
        let toDate = new Date().toISOString()
        if (detailedRating.finalDate && detailedRating.finalTime) {
          toDate = `${detailedRating.finalDate}T${detailedRating.finalTime}`
        }

        cellSharingHistory = (
          await changeSomeonesCellService.getCellSharingHistory(username, {
            prisonerNumber: prisoner.prisonerNumber,
            from: `${detailedRating.provisionalDate}T${detailedRating.provisionalTime}`,
            to: '',
          })
        )?.cells?.flatMap(cell =>
          cell.sharedWith.map(sharedWith => [
            {
              text: cell.pathHierarchy,
            },
            {
              text: convertToTitleCase(`${sharedWith.firstName} ${sharedWith.lastName}`),
            },
            {
              html: `<a class='govuk-link' href='${config.serviceUrls.digitalPrison}/prisoner/${prisoner.prisonerNumber}/location-history?agencyId=${cell.prisonId}&locationId=${cell.nomisLocationId}&fromDate=${detailedRating.provisionalDate}T${encodeURIComponent(detailedRating.provisionalTime)}&toDate=${toDate}' target='_blank'>View details (opens in new tab)</a>`,
            },
          ]),
        )
      }
    } catch (e) {
      if (!(e.responseStatus === 404 && e.data?.errorCode === 'CsraReviewNotFound')) {
        throw e
      }
    }

    const usernames: string[] = []
    if (provisionalAssessmentAnswers && detailedRating.provisionalCompletedBy) {
      usernames.push(detailedRating.provisionalCompletedBy)
    }
    if (finalAssessmentAnswers && detailedRating.finalCompletedBy) {
      usernames.push(detailedRating.finalCompletedBy)
    }
    if (detailedRating.legacy && detailedRating.startedBy) {
      usernames.push(detailedRating.startedBy)
    }
    await populateUserDisplayNames(locals, manageUsersService, username, usernames)

    const referrers = referrerStack(req.query.referrer)
    let backLink = appendReferrers(`/prisoner/${prisoner.prisonerNumber}`, referrers)
    let backLinkText = 'Back to CSRA overview'
    if (referrers.at(-1) === 'history') {
      backLink = appendReferrers(`/prisoner/${prisoner.prisonerNumber}/history`, referrers.slice(0, -1))
      backLinkText = 'Back to CSRA history'
    }

    const provisionalSummaryRows = createSummaryRows({
      assessmentAnswers: provisionalAssessmentAnswers,
      detailedRating,
      userDisplayNames: locals.userDisplayNames,
    })

    const finalSummaryRows = createSummaryRows({
      assessmentAnswers: finalAssessmentAnswers,
      detailedRating,
      userDisplayNames: locals.userDisplayNames,
    })

    const legacySummaryRows = createSummaryRows({
      detailedRating,
      userDisplayNames: locals.userDisplayNames,
    })

    let legacyQuestionsRows: SummaryRow[]
    if (detailedRating.legacy?.questions?.length) {
      legacyQuestionsRows = createLegacyQuestionsRows({ questions: detailedRating.legacy.questions })
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
      provisionalSummaryRows,
      finalSummaryRows,
      legacySummaryRows,
      legacyQuestionsRows,
      finalAssessmentAnswers,
      provisionalAssessmentAnswers,
      csraRiskToCategoryLabelMap,
      csraVulnerabilityCategoryLabelMap,
      detailedRating,
      cellSharingHistory,
      finalOffenceEvidenceMap,
      provisionalOffenceEvidenceMap,
      flowConfig,
      backLink,
      backLinkText,
    })
  }
}
