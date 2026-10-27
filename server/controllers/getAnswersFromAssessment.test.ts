import { CsraAssessment, CsraAssessmentStageAnswers } from '../data/csraApiTypes'
import getAnswersFromAssessment from './getAnswersFromAssessment'
import getAssessmentContext from '../lib/transactionFlow/assessmentContext'

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

  it('seeds a new final stage from the submitted answers using the initial API version', () => {
    const provisional = makeStageAnswers({ pncChecked: true, likelyToHarmCellmate: true, version: 7 })
    const original = structuredClone(provisional)
    const assessment = makeAssessment({ interimResult: 'HIGH_GENERAL', stages: [provisional] })

    expect(getAnswersFromAssessment(assessment)).toEqual({ ...provisional, stage: 'FINAL', version: 1 })
    expect(getAssessmentContext(assessment)).toEqual({
      phase: 'POST_PROVISIONAL',
      provisionalAnswers: provisional,
      answers: { ...provisional, stage: 'FINAL', version: 1 },
    })
    expect(provisional).toEqual(original)
  })

  it('retains the saved final version and selections on revisit', () => {
    const provisional = makeStageAnswers({ pncChecked: true, version: 7 })
    const final = makeStageAnswers({ stage: 'FINAL', pncChecked: true, dpsChecked: true, version: 3 })
    const assessment = makeAssessment({ interimResult: 'HIGH_GENERAL', stages: [provisional, final] })

    expect(getAssessmentContext(assessment)).toEqual({
      phase: 'POST_PROVISIONAL',
      provisionalAnswers: provisional,
      answers: final,
    })
  })

  it('does not silently invent a baseline when submitted provisional answers are missing', () => {
    expect(() => getAssessmentContext(makeAssessment({ interimResult: 'HIGH_GENERAL' }))).toThrow(
      'Submitted provisional assessment answers not found',
    )
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
