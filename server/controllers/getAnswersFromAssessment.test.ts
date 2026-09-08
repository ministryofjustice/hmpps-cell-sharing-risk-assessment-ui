import { CsraAssessment, CsraAssessmentStageAnswers } from '../data/csraApiTypes'
import getAnswersFromAssessment from './getAnswersFromAssessment'

const makeStageAnswers = (overrides: Partial<CsraAssessmentStageAnswers> = {}): CsraAssessmentStageAnswers => ({
  stage: 'PROVISIONAL',
  prisonId: 'MDI',
  offenceEvidence: [],
  riskTo: [],
  vulnerabilities: [],
  version: 1,
  ...overrides,
})

const makeAssessment = (overrides: Partial<CsraAssessment> = {}): CsraAssessment => ({
  assessmentId: 'assessment-1',
  prisonerNumber: 'A1234BC',
  prisonId: 'MDI',
  status: 'IN_PROGRESS',
  startedBy: 'USER1',
  startedAt: '2026-09-07T10:00:00Z',
  stages: [],
  ...overrides,
})

describe('getAnswersFromAssessment', () => {
  it('returns the final stage answers when a final stage exists', () => {
    const provisional = makeStageAnswers({ prisonId: 'MDI' })
    const final = makeStageAnswers({ stage: 'FINAL', prisonId: 'LEI', likelyToHarmCellmate: true })
    const assessment = makeAssessment({
      interimResult: 'HIGH_GENERAL',
      stages: [provisional, final],
    })

    expect(getAnswersFromAssessment(assessment)).toBe(final)
  })

  it('returns the provisional stage answers when there is no final stage', () => {
    const provisional = makeStageAnswers({ prisonId: 'MDI', likelyToHarmCellmate: true })
    const assessment = makeAssessment({ stages: [provisional] })

    expect(getAnswersFromAssessment(assessment)).toBe(provisional)
  })

  it('falls back to an empty provisional stage when there are no stored answers', () => {
    const assessment = makeAssessment({ stages: [] })

    expect(getAnswersFromAssessment(assessment)).toEqual({
      prisonId: 'MDI',
      stage: 'PROVISIONAL',
      offenceEvidence: [],
      riskTo: [],
      vulnerabilities: [],
      version: 1,
    })
  })
})
