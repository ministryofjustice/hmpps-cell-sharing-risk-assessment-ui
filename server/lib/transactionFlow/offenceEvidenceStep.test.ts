import { CsraAssessment } from '../../data/csraApiTypes'
import OffenceEvidenceDetailsQuestion from './questionTypes/offenceEvidenceDetails'
import OffenceEvidenceSourceCheckboxQuestion from './questionTypes/offenceEvidenceSourceCheckbox'
import YesNoQuestion from './questionTypes/yesNo'
import OffenceEvidenceStep from './offenceEvidenceStep'

const makeAssessment = (overrides: Partial<CsraAssessment> = {}): CsraAssessment => ({
  rating: 'STANDARD',
  prisonId: 'MDI',
  assessmentComment: '',
  dpsChecked: true,
  perChecked: true,
  warrantChecked: true,
  pncChecked: true,
  offenceMurderManslaughter: true,
  offenceAssistingSuicide: false,
  offenceSexualAssault: false,
  offenceRepeatedViolence: false,
  offencePrejudiceMotivated: false,
  offenceArson: false,
  offenceKidnapHostage: false,
  offenceEvidence: [],
  officerSpokeToPrisoner: false,
  likelyToHarmCellmate: false,
  significantlyVulnerable: false,
  causeForConcernSharing: false,
  otherHighRiskIndicators: false,
  seenByHealthcare: false,
  healthcareIncreasedRisk: false,
  riskTo: [],
  vulnerabilities: [],
  ...overrides,
})

describe('OffenceEvidenceStep', () => {
  const yesNoQuestion = new YesNoQuestion('Is there any evidence of offence?', 'offenceMurderManslaughter')

  it('contains source and detail questions', () => {
    const step = new OffenceEvidenceStep(yesNoQuestion, 'MURDER_MANSLAUGHTER')

    expect(step.questions).toHaveLength(2)
    expect(step.questions[0]).toBeInstanceOf(OffenceEvidenceSourceCheckboxQuestion)
    expect(step.questions[1]).toBeInstanceOf(OffenceEvidenceDetailsQuestion)
  })

  it('is removed when the yes/no question was answered negatively', () => {
    const step = new OffenceEvidenceStep(yesNoQuestion, 'MURDER_MANSLAUGHTER')

    expect(step.removeIf(makeAssessment({ offenceMurderManslaughter: true }))).toBe(false)
    expect(step.removeIf(makeAssessment({ offenceMurderManslaughter: false }))).toBe(true)
  })

  it('initialises offence evidence entry when missing and mutates values', () => {
    const step = new OffenceEvidenceStep(yesNoQuestion, 'MURDER_MANSLAUGHTER')

    const mutated = step.mutateAssessment(makeAssessment(), {
      evidenceSources: ['PNC'],
      assessmentComment: 'Found in records',
    })

    expect(mutated.offenceEvidence).toEqual([
      {
        offence: 'MURDER_MANSLAUGHTER',
        sources: ['PNC'],
        details: 'Found in records',
      },
    ])
  })

  it('does not duplicate existing evidence entries for the offence', () => {
    const step = new OffenceEvidenceStep(yesNoQuestion, 'MURDER_MANSLAUGHTER')

    const existing = makeAssessment({
      offenceEvidence: [{ offence: 'MURDER_MANSLAUGHTER', sources: ['DPS'], details: 'existing' }],
    })

    const mutated = step.mutateAssessment(existing, { evidenceSources: ['PER'], assessmentComment: 'updated' })

    expect(mutated.offenceEvidence).toHaveLength(1)
  })
})
