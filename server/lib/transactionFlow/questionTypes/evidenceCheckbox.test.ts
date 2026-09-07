import { CsraAssessment } from '../../../data/csraApiTypes'
import Question from './base'
import EvidenceCheckboxQuestion from './evidenceCheckbox'

class ConditionalQuestion extends Question {
  override componentAttributes(): object {
    return {}
  }

  override validations(): ValidationFunction[] {
    return []
  }

  override getFormValues(): FormValues {
    return {}
  }

  override isComplete(): boolean {
    return true
  }

  override mutateAssessment(assessment: CsraAssessment): CsraAssessment {
    return { ...assessment, assessmentComment: 'conditional was called' }
  }
}

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

describe('EvidenceCheckboxQuestion', () => {
  it('is complete when at least one source is checked', () => {
    const question = new EvidenceCheckboxQuestion()

    expect(question.isComplete(makeAssessment())).toBe(false)
    expect(question.isComplete(makeAssessment({ pncChecked: true }))).toBe(true)
  })

  it('mutates source flags from selected checkboxes', () => {
    const question = new EvidenceCheckboxQuestion()

    const mutated = question.mutateAssessment(makeAssessment({ dpsChecked: true }), {
      evidenceSources: ['pncChecked', 'perChecked'],
    })

    expect(mutated.pncChecked).toBe(true)
    expect(mutated.perChecked).toBe(true)
    expect(mutated.warrantChecked).toBe(false)
    expect(mutated.dpsChecked).toBe(false)
  })

  it('runs conditional mutate when a conditional source is selected', () => {
    const question = new EvidenceCheckboxQuestion()
    question.items[0] = {
      ...question.items[0],
      conditional: new ConditionalQuestion('Conditional', 'conditionalField', 'govukInput'),
    }

    const mutated = question.mutateAssessment(makeAssessment(), { evidenceSources: ['pncChecked'] })

    expect(mutated.assessmentComment).toBe('conditional was called')
  })

  it('maps assessment values back to selected source values', () => {
    const question = new EvidenceCheckboxQuestion()

    expect(question.getFormValues(makeAssessment({ pncChecked: true, dpsChecked: true }))).toEqual({
      evidenceSources: ['pncChecked', 'dpsChecked'],
    })
  })
})
