import { CsraAssessment, CsraAssessmentStageAnswers } from '../data/csraApiTypes'
import { Prisoner } from '../data/prisonerSearchApiTypes'
import { AssessmentSubmitType, getAssessmentSubmitStatus } from './getAssessmentSubmitStatus'

const makeStageAnswers = (overrides: Partial<CsraAssessmentStageAnswers> = {}): CsraAssessmentStageAnswers => ({
  stage: 'PROVISIONAL',
  prisonId: 'MDI',
  dpsChecked: true,
  perChecked: true,
  warrantChecked: true,
  pncChecked: true,
  offenceMurderManslaughter: false,
  offenceAssistingSuicide: false,
  offenceSexualAssault: false,
  offenceRepeatedViolence: false,
  offencePrejudiceMotivated: false,
  offenceArson: false,
  offenceKidnapHostage: false,
  offenceEvidence: [],
  officerSpokeToPrisoner: true,
  likelyToHarmCellmate: false,
  significantlyVulnerable: false,
  causeForConcernSharing: false,
  otherHighRiskIndicators: false,
  seenByHealthcare: true,
  healthcareIncreasedRisk: false,
  riskTo: [],
  vulnerabilities: [],
  version: 1,
  ...overrides,
})

const makeAssessment = (
  answers: CsraAssessmentStageAnswers = makeStageAnswers(),
  overrides: Partial<CsraAssessment> = {},
): CsraAssessment => ({
  assessmentId: 'assessment-123',
  prisonerNumber: 'A1234BC',
  status: 'IN_PROGRESS',
  startedBy: 'USER1',
  startedAt: '2026-09-07T10:00:00Z',
  stages: [answers],
  ...overrides,
})

const prisoner: Prisoner = {
  prisonerNumber: 'A1234BC',
  firstName: 'JOHN',
  lastName: 'SMITH',
}

describe('getAssessmentSubmitStatus', () => {
  it('returns NONE when an assessment prerequisite is unanswered', () => {
    const result = getAssessmentSubmitStatus(
      makeAssessment(makeStageAnswers({ offenceArson: undefined })),
      makeStageAnswers({ offenceArson: undefined }),
      prisoner,
    )

    expect(result).toEqual({ submitType: AssessmentSubmitType.NONE, remainingTasks: [] })
  })

  it('allows a provisional rating when evidence and healthcare are answered but the assessment is incomplete', () => {
    const answers = makeStageAnswers({ seenByHealthcare: false })

    expect(getAssessmentSubmitStatus(makeAssessment(answers), answers, prisoner)).toEqual({
      submitType: AssessmentSubmitType.PROVISIONAL,
      remainingTasks: ['ensure the prisoner has been seen by healthcare'],
    })
  })

  it('allows a final rating when every assessment section is complete', () => {
    const answers = makeStageAnswers()

    expect(getAssessmentSubmitStatus(makeAssessment(answers), answers, prisoner)).toEqual({
      submitType: AssessmentSubmitType.FINAL,
      remainingTasks: [],
    })
  })

  it.each([
    ['complete answers', makeStageAnswers()],
    ['provisional-ready answers', makeStageAnswers({ seenByHealthcare: false })],
    ['unanswered prerequisites', makeStageAnswers({ offenceArson: undefined })],
  ])('returns NONE for %s when a final result already exists', (_description, answers) => {
    const result = getAssessmentSubmitStatus(
      makeAssessment(answers, { finalResult: 'HIGH_GENERAL' }),
      answers,
      prisoner,
    )

    expect(result.submitType).toBe(AssessmentSubmitType.NONE)
  })

  it('does not allow another provisional rating after an interim result has been entered', () => {
    const answers = makeStageAnswers({ seenByHealthcare: false })

    expect(
      getAssessmentSubmitStatus(makeAssessment(answers, { interimResult: 'HIGH_GENERAL' }), answers, prisoner),
    ).toEqual({ submitType: AssessmentSubmitType.NONE, remainingTasks: [] })
  })

  // TODO: this test requires the reviewProvisional section to also be complete, but that section is not yet implemented
  // it('allows a final rating when an interim result has been entered', () => {
  //   const answers = makeStageAnswers()
  //
  //   expect(
  //     getAssessmentSubmitStatus(makeAssessment(answers, { interimResult: 'HIGH_GENERAL' }), answers, prisoner),
  //   ).toEqual({ submitType: AssessmentSubmitType.FINAL, remainingTasks: [] })
  // })

  it('lists unchecked sources and unfinished assessment actions in order', () => {
    const answers = makeStageAnswers({
      dpsChecked: false,
      perChecked: false,
      warrantChecked: false,
      pncChecked: true,
      officerSpokeToPrisoner: false,
      causeForConcernSharing: true,
      otherHighRiskIndicators: true,
      seenByHealthcare: false,
    })

    expect(getAssessmentSubmitStatus(makeAssessment(answers), answers, prisoner)).toEqual({
      submitType: AssessmentSubmitType.PROVISIONAL,
      remainingTasks: [
        'check remaining evidence sources (DPS, PER, Warrant)',
        'review offence questions after checking remaining evidence sources',
        'speak to the prisoner about sharing a cell',
        'record any observations that cause a cell sharing concern',
        'record any other indicators that suggest the prisoner is high risk',
        'ensure the prisoner has been seen by healthcare',
      ],
    })
  })

  it('requires harm details only when the prisoner may harm a cellmate', () => {
    const answers = makeStageAnswers({
      likelyToHarmCellmate: true,
      seenByHealthcare: false,
    })

    expect(getAssessmentSubmitStatus(makeAssessment(answers), answers, prisoner).remainingTasks).toContain(
      'record if there is reason to believe the prisoner may harm someone they share a cell with',
    )

    const noHarmAnswers = makeStageAnswers({ seenByHealthcare: false })
    expect(
      getAssessmentSubmitStatus(makeAssessment(noHarmAnswers), noHarmAnswers, prisoner).remainingTasks,
    ).not.toContain('record if there is reason to believe the prisoner may harm someone they share a cell with')
  })
})
