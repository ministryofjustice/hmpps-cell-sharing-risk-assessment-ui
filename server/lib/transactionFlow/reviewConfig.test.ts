import { availableReviewReasons, evidenceSources, reasonQuestion, reviewSteps } from './reviewConfig'
import { CsraDetailedRating } from '../../data/csraApiTypes'
import ReviewEvidenceCheckbox from './questionTypes/reviewEvidenceCheckbox'

describe('review flow config', () => {
  it('defines the ordered steps and their save behaviour', () => {
    expect(reviewSteps.map(({ path, persistence }) => ({ path, persistence }))).toEqual([
      { path: 'reason', persistence: 'stage-reason' },
      { path: 'scheduled-review', persistence: 'pending' },
      { path: 'short-term-review', persistence: 'pending' },
      { path: 'multidisciplinary-team-review', persistence: 'pending' },
      { path: 'evidence', persistence: 'create' },
    ])
    expect(reviewSteps[0].step.questions).toEqual([reasonQuestion])
    expect(reviewSteps[4].step.questions[0]).toBeInstanceOf(ReviewEvidenceCheckbox)
    expect(evidenceSources.find(source => source.value === 'DPS')?.text).toBe('DPS')
  })

  it('uses the review reason API values', () => {
    expect(reasonQuestion.items.map(item => item.value)).toEqual([
      'SCHEDULED_LONG_TERM_HIGH_RISK_REVIEW',
      'SHORT_TERM_HIGH_RISK_REVIEW',
      'NEW_OR_ADDITIONAL_INFORMATION',
      'RECENT_CHANGE_IN_BEHAVIOUR_OR_THINKING',
    ])
    const attributes = reasonQuestion.componentAttributes(
      undefined,
      {},
      { reviewReason: null, evidenceSources: [] },
    ) as {
      items: { hint?: { text: string } }[]
    }
    expect(attributes.items[0].hint).toEqual({ text: reasonQuestion.items[0].hint })
    expect(
      reasonQuestion.mutateAssessmentAnswers(
        { reviewReason: null, evidenceSources: [] },
        { reviewReason: 'SHORT_TERM_HIGH_RISK_REVIEW' },
      ),
    ).toEqual({
      reviewReason: 'SHORT_TERM_HIGH_RISK_REVIEW',
      evidenceSources: [],
    })
  })

  it('treats a legacy high rating as unspecified high risk and legacy standard as standard', () => {
    const rating: CsraDetailedRating = {
      prisonerNumber: 'A1234BC',
      status: 'COMPLETE',
      provisional: false,
      finalRating: 'HIGH',
      riskTo: [],
      vulnerabilities: [],
      stages: [],
    }
    expect(availableReviewReasons(rating)).toEqual(reasonQuestion.items.map(item => item.value))
    expect(availableReviewReasons({ ...rating, finalRating: 'STANDARD' })).toEqual(
      reasonQuestion.items.slice(2).map(item => item.value),
    )
  })
})
