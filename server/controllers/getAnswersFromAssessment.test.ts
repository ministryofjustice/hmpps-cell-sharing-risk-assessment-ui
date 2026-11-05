import { CsraAssessment, CsraAssessmentStageAnswers } from '../data/csraApiTypes'
import getAnswersFromAssessment from './getAnswersFromAssessment'
import flowConfig from '../lib/transactionFlow/config'

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

  it('copies other sections but clears evidence and offences in a new final stage at version 1', () => {
    const provisional = makeStageAnswers({
      prisonId: 'MDI',
      likelyToHarmCellmate: true,
      version: 4,
      pncChecked: true,
      warrantChecked: true,
      dpsChecked: false,
      perChecked: false,
      offenceMurderManslaughter: true,
      offenceAssistingSuicide: false,
      offenceSexualAssault: false,
      offenceRepeatedViolence: false,
      offencePrejudiceMotivated: false,
      offenceArson: false,
      offenceKidnapHostage: false,
      offenceEvidence: [{ offence: 'MURDER_MANSLAUGHTER', sources: ['PNC'], details: 'Provisional evidence' }],
    })
    const original = structuredClone(provisional)
    const assessment = makeAssessment({ interimResult: 'HIGH_GENERAL', stages: [provisional] })

    const final = getAnswersFromAssessment(assessment)
    expect(final).toEqual({
      ...provisional,
      stage: 'FINAL',
      version: 1,
      pncChecked: null,
      warrantChecked: null,
      dpsChecked: null,
      perChecked: null,
      offenceMurderManslaughter: null,
      offenceAssistingSuicide: null,
      offenceSexualAssault: null,
      offenceRepeatedViolence: null,
      offencePrejudiceMotivated: null,
      offenceArson: null,
      offenceKidnapHostage: null,
      offenceEvidence: [],
    })
    expect(flowConfig.evidenceAndOffences.steps[0].isAnswered(final)).toBe(false)
    expect(provisional).toEqual(original)
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
