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

  override eraseAnswers(assessment: CsraAssessmentStageAnswers): CsraAssessmentStageAnswers {
    return { ...assessment, likelyToHarmCellmateDetail: null }
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

  it('shows checked sources separately and only offers unchecked sources after a provisional rating', () => {
    const question = new EvidenceCheckboxQuestion()
    const assessmentAnswers = makeAssessment()

    const attributes = question.componentAttributes(undefined, {}, assessmentAnswers, {
      provisionalRatingEntered: true,
      provisionalAnswers: makeAssessment({ pncChecked: true, dpsChecked: true }),
    }) as {
      fieldset: { legend: { text: string } }
      items: CheckboxItem[]
      checkedSources: Array<Pick<CheckboxItem, 'text' | 'hint'>>
    }

    expect(attributes.checkedSources).toEqual([
      { text: 'PNC', hint: { text: 'Current and previous convictions' } },
      { text: 'DPS', hint: { text: 'Current and historical adjudications' } },
    ])
    expect(attributes.fieldset.legend.text).toBe('Which remaining evidence sources have you checked?')
    expect(attributes.items.map(item => item.text)).toEqual(['Warrant', 'PER'])
  })

  it('keeps final-stage sources as checkboxes when revisiting the question', () => {
    const question = new EvidenceCheckboxQuestion()
    const assessmentAnswers = makeAssessment({ perChecked: true })

    const attributes = question.componentAttributes(undefined, { evidenceSources: ['perChecked'] }, assessmentAnswers, {
      provisionalRatingEntered: true,
      provisionalAnswers: makeAssessment({ pncChecked: true }),
    }) as {
      items: CheckboxItem[]
      values: string[]
      checkedSources: Array<Pick<CheckboxItem, 'text' | 'hint'>>
    }

    expect(attributes.checkedSources.map(source => source.text)).toEqual(['PNC'])
    expect(attributes.items.map(item => item.text)).toEqual(['Warrant', 'DPS', 'PER'])
    expect(attributes.values).toEqual(['perChecked'])
  })

  it('preserves provisional sources and updates final sources from the submitted selection', () => {
    const question = new EvidenceCheckboxQuestion()
    const assessmentAnswers = makeAssessment({ perChecked: true })

    const mutated = question.mutateAssessmentAnswers(
      assessmentAnswers,
      { evidenceSources: ['perChecked'] },
      {
        provisionalRatingEntered: true,
        provisionalAnswers: makeAssessment({ pncChecked: true, dpsChecked: true }),
      },
    )

    expect(mutated.pncChecked).toBe(true)
    expect(mutated.dpsChecked).toBe(true)
    expect(mutated.warrantChecked).toBe(false)
    expect(mutated.perChecked).toBe(true)
  })

  it('clears a final-stage source when it is unchecked on revisit', () => {
    const question = new EvidenceCheckboxQuestion()
    const assessmentAnswers = makeAssessment({ pncChecked: true, warrantChecked: true })

    const mutated = question.mutateAssessmentAnswers(
      assessmentAnswers,
      { evidenceSources: [] },
      {
        provisionalRatingEntered: true,
        provisionalAnswers: makeAssessment({ pncChecked: true }),
      },
    )

    expect(mutated.pncChecked).toBe(true)
    expect(mutated.warrantChecked).toBe(false)
  })

  it('does not require another selection when all sources were already checked', () => {
    const question = new EvidenceCheckboxQuestion()
    const context = {
      provisionalRatingEntered: true,
      assessmentAnswers: makeAssessment({
        pncChecked: true,
        warrantChecked: true,
        dpsChecked: true,
        perChecked: true,
      }),
    }

    expect(question.validations(context)).toEqual([])
  })

  it('clears all source flags and conditional answers without changing unrelated answers or the original', () => {
    const question = new EvidenceCheckboxQuestion()
    question.items[0] = {
      ...question.items[0],
      conditional: new ConditionalQuestion('Conditional', 'conditionalField', 'govukInput'),
    }
    const assessment = makeAssessment({
      pncChecked: true,
      warrantChecked: false,
      dpsChecked: true,
      perChecked: false,
      likelyToHarmCellmateDetail: 'Recorded detail',
      officerSpokeToPrisoner: true,
    })
    const original = structuredClone(assessment)

    expect(question.eraseAnswers(assessment)).toEqual({
      ...assessment,
      pncChecked: null,
      warrantChecked: null,
      dpsChecked: null,
      perChecked: null,
      likelyToHarmCellmateDetail: null,
    })
    expect(assessment).toEqual(original)
  })

  it('uses required validation', () => {
    const question = new EvidenceCheckboxQuestion()

    const [validate] = question.validations()

    expect(validate([])).toBe('Select at least one evidence source you have checked')
    expect(validate(['PNC'])).toBeNull()
  })

  it('uses remaining evidence source wording for a final assessment', () => {
    const question = new EvidenceCheckboxQuestion()

    const [validate] = question.validations({
      provisionalRatingEntered: true,
      assessmentAnswers: makeAssessment(),
      provisionalAnswers: makeAssessment({ pncChecked: true }),
    })

    expect(validate([])).toBe('Select at least one remaining evidence source you have checked')
  })
})
