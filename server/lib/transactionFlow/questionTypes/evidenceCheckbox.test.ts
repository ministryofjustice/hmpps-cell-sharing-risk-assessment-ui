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

  describe('after provisional submission', () => {
    const provisional = makeAssessment({ pncChecked: true })

    it('provides fixed sources with hints alongside editable checkbox attributes', () => {
      const question = new EvidenceCheckboxQuestion(provisional)
      const final = { ...provisional, stage: 'FINAL' as const, dpsChecked: true }
      const validationErrors = { evidenceSources: { text: 'Example validation error' } }
      const values = question.getFormValues(final)

      expect(question.component).toBe('appEvidenceSources')
      expect(question.componentAttributes(validationErrors, values, final)).toEqual({
        checkedSources: [{ text: 'PNC', hint: { text: 'Current and previous convictions' }, value: 'pncChecked' }],
        checkboxes: expect.objectContaining({
          values: ['dpsChecked'],
          errorMessage: validationErrors.evidenceSources,
          items: expect.arrayContaining([
            expect.objectContaining({
              text: 'DPS',
              hint: { text: 'Current and historical adjudications' },
            }),
          ]),
        }),
      })
    })

    it('retains the question and its fixed answers without rendering empty checkboxes', () => {
      const final = makeAssessment({
        stage: 'FINAL',
        pncChecked: true,
        warrantChecked: true,
        dpsChecked: true,
        perChecked: true,
      })
      const question = new EvidenceCheckboxQuestion(final)

      expect(question.componentAttributes(undefined, {}, final)).toEqual({
        checkedSources: expect.arrayContaining([
          expect.objectContaining({ text: 'DPS', hint: { text: 'Current and historical adjudications' } }),
        ]),
        checkboxes: undefined,
      })
      expect(question.mutateAssessmentAnswers(final, {})).toEqual(final)
      expect(question.isComplete(final)).toBe(true)
    })

    it('only offers sources not checked in the provisional assessment', () => {
      const question = new EvidenceCheckboxQuestion(provisional)
      const final = makeAssessment({ stage: 'FINAL', pncChecked: true, dpsChecked: true })

      expect(question.question).toBe('Which remaining evidence sources have you checked?')
      expect(question.checkedSources.map(source => source.text)).toEqual(['PNC'])
      expect(question.items.map(source => source.value)).toEqual(['warrantChecked', 'dpsChecked', 'perChecked'])
      expect(question.getFormValues(final)).toEqual({ evidenceSources: ['dpsChecked'] })
    })

    it('preserves baseline checks while allowing later selections to be corrected', () => {
      const question = new EvidenceCheckboxQuestion(provisional)
      const final = makeAssessment({ stage: 'FINAL', pncChecked: true, dpsChecked: true })
      const original = structuredClone(final)

      expect(question.mutateAssessmentAnswers(final, { evidenceSources: ['perChecked'] })).toEqual({
        ...final,
        pncChecked: true,
        dpsChecked: false,
        warrantChecked: false,
        perChecked: true,
      })
      expect(final).toEqual(original)
      expect(provisional.pncChecked).toBe(true)
    })

    it('allows continuing without another selection but still requires all sources for completion', () => {
      const question = new EvidenceCheckboxQuestion(provisional)
      const final = makeAssessment({ stage: 'FINAL', pncChecked: true })

      expect(question.validations()).toEqual([])
      expect(question.isAnswered(final)).toBe(true)
      expect(question.isComplete(final)).toBe(false)
      expect(question.mutateAssessmentAnswers(final, {}).pncChecked).toBe(true)
      expect(question.isComplete({ ...final, warrantChecked: true, dpsChecked: true, perChecked: true })).toBe(true)
    })

    it('does not erase baseline checks', () => {
      const question = new EvidenceCheckboxQuestion(provisional)
      const final = makeAssessment({ stage: 'FINAL', pncChecked: true, dpsChecked: true })

      expect(question.eraseAnswers(final)).toEqual({
        ...final,
        dpsChecked: null,
        warrantChecked: null,
        perChecked: null,
      })
    })
  })
})
