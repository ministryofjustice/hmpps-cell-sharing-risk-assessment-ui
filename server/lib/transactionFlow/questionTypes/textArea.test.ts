import { CsraAssessment } from '../../../data/csraApiTypes'
import TextAreaQuestion from './textArea'

const makeAssessment = (overrides: Partial<CsraAssessment> = {}): CsraAssessment => ({
  rating: 'STANDARD',
  prisonId: 'MDI',
  assessmentComment: '',
  dpsChecked: false,
  perChecked: false,
  warrantChecked: false,
  pncChecked: false,
  offenceMurderManslaughter: false,
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

describe('TextAreaQuestion', () => {
  const question = new TextAreaQuestion('Provide details', 'assessmentComment')

  it('builds textarea component attributes', () => {
    const result = question.componentAttributes(
      { assessmentComment: { text: 'Required' } },
      { assessmentComment: 'Current value' },
      makeAssessment(),
    ) as { value?: string; errorMessage?: string }

    expect(result.value).toBe('Current value')
    expect(result.errorMessage).toBe('Required')
  })

  it('uses required validation', () => {
    const [validate] = question.validations()

    expect(validate('')).toBe('TODO: enter a reason')
    expect(validate('details')).toBeNull()
  })

  it('maps values between form and assessment', () => {
    expect(question.getFormValues(makeAssessment({ assessmentComment: 'A note' }))).toEqual({
      assessmentComment: 'A note',
    })

    const mutated = question.mutateAssessment(makeAssessment(), { assessmentComment: 'Updated comment' })
    expect(mutated.assessmentComment).toBe('Updated comment')
  })

  it('is complete when a value exists', () => {
    expect(question.isComplete(makeAssessment({ assessmentComment: 'Done' }))).toBe(true)
    expect(question.isComplete(makeAssessment({ assessmentComment: '' }))).toBe(false)
  })
})
