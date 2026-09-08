import { CsraAssessmentStageAnswers } from '../../../data/csraApiTypes'
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

  override isAnswered(_assessment: CsraAssessmentStageAnswers): boolean {
    return true
  }

  override mutateAssessmentAnswers(assessment: CsraAssessmentStageAnswers): CsraAssessmentStageAnswers {
    return { ...assessment, likelyToHarmCellmateDetail: 'conditional was called' }
  }
}

const makeAssessment = (overrides: Partial<CsraAssessmentStageAnswers> = {}): CsraAssessmentStageAnswers => ({
  stage: 'PROVISIONAL',
  prisonId: 'MDI',
  offenceEvidence: [],
  riskTo: [],
  vulnerabilities: [],
  version: 1,
  ...overrides,
})

describe('EvidenceCheckboxQuestion', () => {
  it('is complete when at least one source is checked', () => {
    const question = new EvidenceCheckboxQuestion()

    expect(question.isAnswered(makeAssessment())).toBe(false)
    expect(question.isAnswered(makeAssessment({ pncChecked: true }))).toBe(true)
  })

  it('mutates source flags from selected checkboxes', () => {
    const question = new EvidenceCheckboxQuestion()

    const mutated = question.mutateAssessmentAnswers(makeAssessment({ dpsChecked: true }), {
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

    const mutated = question.mutateAssessmentAnswers(makeAssessment(), { evidenceSources: ['pncChecked'] })

    expect(mutated.likelyToHarmCellmateDetail).toBe('conditional was called')
  })

  it('maps assessment values back to selected source values', () => {
    const question = new EvidenceCheckboxQuestion()

    expect(question.getFormValues(makeAssessment({ pncChecked: true, dpsChecked: true }))).toEqual({
      evidenceSources: ['pncChecked', 'dpsChecked'],
    })
  })
})
